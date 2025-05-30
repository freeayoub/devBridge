import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  ChangeDetectorRef,
} from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { MessageService } from '../../../../services/message.service';
import { ToastService } from '../../../../services/toast.service';
import { CallType, Call, IncomingCall } from '../../../../models/message.model';

@Component({
  selector: 'app-message-chat',
  templateUrl: './message-chat.component.html',
})
export class MessageChatComponent implements OnInit, OnDestroy {
  // === RÉFÉRENCES DOM ===
  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;
  @ViewChild('fileInput', { static: false })
  fileInput!: ElementRef<HTMLInputElement>;

  // === DONNÉES PRINCIPALES ===
  conversation: any = null;
  messages: any[] = [];
  currentUserId: string | null = null;
  currentUsername = 'You';
  messageForm: FormGroup;
  otherParticipant: any = null;

  // === ÉTATS DE L'INTERFACE ===
  isLoading = false;
  isLoadingMore = false;
  hasMoreMessages = true;
  showEmojiPicker = false;
  showAttachmentMenu = false;
  showSearch = false;
  searchQuery = '';
  searchResults: any[] = [];
  searchMode = false;
  isSendingMessage = false;
  otherUserIsTyping = false;
  showMainMenu = false;
  showMessageContextMenu = false;
  selectedMessage: any = null;
  contextMenuPosition = { x: 0, y: 0 };
  showReactionPicker = false;
  reactionPickerMessage: any = null;

  showImageViewer = false;
  selectedImage: any = null;
  uploadProgress = 0;
  isUploading = false;
  isDragOver = false;

  // === GESTION VOCALE OPTIMISÉE ===
  isRecordingVoice = false;
  voiceRecordingDuration = 0;
  voiceRecordingState: 'idle' | 'recording' | 'processing' = 'idle';
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private recordingTimer: any = null;
  voiceWaves: number[] = [
    4, 8, 12, 16, 20, 16, 12, 8, 4, 8, 12, 16, 20, 16, 12, 8,
  ];

  // Lecture des messages vocaux
  private currentAudio: HTMLAudioElement | null = null;
  private playingMessageId: string | null = null;
  private voicePlayback: {
    [messageId: string]: {
      progress: number;
      duration: number;
      currentTime: number;
      speed: number;
    };
  } = {};

  // === APPELS WEBRTC ===
  isInCall = false;
  callType: 'VIDEO' | 'AUDIO' | null = null;
  callDuration = 0;
  private callTimer: any = null;

  // État de l'appel WebRTC
  activeCall: any = null;
  isCallConnected = false;
  isMuted = false;
  isVideoEnabled = true;
  localVideoElement: HTMLVideoElement | null = null;
  remoteVideoElement: HTMLVideoElement | null = null;

  // === ÉMOJIS ===
  emojiCategories: any[] = [
    {
      id: 'smileys',
      name: 'Smileys',
      icon: '😀',
      emojis: [
        { emoji: '😀', name: 'grinning face' },
        { emoji: '😃', name: 'grinning face with big eyes' },
        { emoji: '😄', name: 'grinning face with smiling eyes' },
        { emoji: '😁', name: 'beaming face with smiling eyes' },
        { emoji: '😆', name: 'grinning squinting face' },
        { emoji: '😅', name: 'grinning face with sweat' },
        { emoji: '😂', name: 'face with tears of joy' },
        { emoji: '🤣', name: 'rolling on the floor laughing' },
        { emoji: '😊', name: 'smiling face with smiling eyes' },
        { emoji: '😇', name: 'smiling face with halo' },
      ],
    },
    {
      id: 'people',
      name: 'People',
      icon: '👤',
      emojis: [
        { emoji: '👶', name: 'baby' },
        { emoji: '🧒', name: 'child' },
        { emoji: '👦', name: 'boy' },
        { emoji: '👧', name: 'girl' },
        { emoji: '🧑', name: 'person' },
        { emoji: '👨', name: 'man' },
        { emoji: '👩', name: 'woman' },
        { emoji: '👴', name: 'old man' },
        { emoji: '👵', name: 'old woman' },
      ],
    },
    {
      id: 'nature',
      name: 'Nature',
      icon: '🌿',
      emojis: [
        { emoji: '🐶', name: 'dog face' },
        { emoji: '🐱', name: 'cat face' },
        { emoji: '🐭', name: 'mouse face' },
        { emoji: '🐹', name: 'hamster' },
        { emoji: '🐰', name: 'rabbit face' },
        { emoji: '🦊', name: 'fox' },
        { emoji: '🐻', name: 'bear' },
        { emoji: '🐼', name: 'panda' },
      ],
    },
  ];
  selectedEmojiCategory = this.emojiCategories[0];

  // === PAGINATION ===
  private readonly MAX_MESSAGES_TO_LOAD = 10;
  private currentPage = 1;

  // === AUTRES ÉTATS ===
  isTyping = false;
  isUserTyping = false;
  private typingTimeout: any = null;
  private subscriptions = new Subscription();

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private MessageService: MessageService,
    private toastService: ToastService,
    private cdr: ChangeDetectorRef
  ) {
    this.messageForm = this.fb.group({
      content: ['', [Validators.required, Validators.minLength(1)]],
    });
  }

  // Méthode pour vérifier si le champ de saisie doit être désactivé
  isInputDisabled(): boolean {
    return (
      !this.otherParticipant || this.isRecordingVoice || this.isSendingMessage
    );
  }

  // Méthode pour gérer l'état du contrôle de saisie
  private updateInputState(): void {
    const contentControl = this.messageForm.get('content');
    if (this.isInputDisabled()) {
      contentControl?.disable();
    } else {
      contentControl?.enable();
    }
  }

  ngOnInit(): void {
    console.log('🚀 MessageChatComponent initialized');
    this.initializeComponent();
  }

  private initializeComponent(): void {
    this.loadCurrentUser();
    this.loadConversation();
    this.setupCallSubscriptions();
  }

  private setupCallSubscriptions(): void {
    // S'abonner aux appels entrants
    this.subscriptions.add(
      this.MessageService.incomingCall$.subscribe({
        next: (incomingCall) => {
          if (incomingCall) {
            console.log('📞 Incoming call received:', incomingCall);
            this.handleIncomingCall(incomingCall);
          }
        },
        error: (error) => {
          console.error('❌ Error in incoming call subscription:', error);
        },
      })
    );

    // S'abonner aux changements d'état d'appel
    this.subscriptions.add(
      this.MessageService.activeCall$.subscribe({
        next: (call) => {
          if (call) {
            console.log('📞 Active call updated:', call);
            this.activeCall = call;
          }
        },
        error: (error) => {
          console.error('❌ Error in active call subscription:', error);
        },
      })
    );
  }

  private handleIncomingCall(incomingCall: IncomingCall): void {
    // Afficher une notification ou modal d'appel entrant
    // Pour l'instant, on log juste
    console.log(
      '🔔 Handling incoming call from:',
      incomingCall.caller.username
    );

    // Jouer la sonnerie
    this.MessageService.play('ringtone');

    // Ici on pourrait afficher une modal ou notification
    // Pour l'instant, on accepte automatiquement pour tester
    // this.acceptCall(incomingCall);
  }

  private loadCurrentUser(): void {
    try {
      const userString = localStorage.getItem('user');
      console.log('🔍 Raw user from localStorage:', userString);

      if (!userString || userString === 'null' || userString === 'undefined') {
        console.error('❌ No user data in localStorage');
        this.currentUserId = null;
        this.currentUsername = 'You';
        return;
      }

      const user = JSON.parse(userString);
      console.log('🔍 Parsed user object:', user);

      // Essayer différentes propriétés pour l'ID utilisateur
      const userId = user._id || user.id || user.userId;
      console.log('🔍 Trying to extract user ID:', {
        _id: user._id,
        id: user.id,
        userId: user.userId,
        extracted: userId,
      });

      if (userId) {
        this.currentUserId = userId;
        this.currentUsername = user.username || user.name || 'You';
        console.log('✅ Current user loaded successfully:', {
          id: this.currentUserId,
          username: this.currentUsername,
        });
      } else {
        console.error('❌ No valid user ID found in user object:', user);
        this.currentUserId = null;
        this.currentUsername = 'You';
      }
    } catch (error) {
      console.error('❌ Error parsing user from localStorage:', error);
      this.currentUserId = null;
      this.currentUsername = 'You';
    }
  }

  private loadConversation(): void {
    const conversationId = this.route.snapshot.paramMap.get('id');
    console.log('Loading conversation with ID:', conversationId);

    if (!conversationId) {
      this.toastService.showError('ID de conversation manquant');
      return;
    }

    this.isLoading = true;
    this.MessageService.getConversation(conversationId).subscribe({
      next: (conversation) => {
        console.log('🔍 Conversation loaded successfully:', conversation);
        console.log('🔍 Conversation structure:', {
          id: conversation?.id,
          participants: conversation?.participants,
          participantsCount: conversation?.participants?.length,
          isGroup: conversation?.isGroup,
          messages: conversation?.messages,
          messagesCount: conversation?.messages?.length,
        });
        this.conversation = conversation;
        this.setOtherParticipant();
        this.loadMessages();

        // Configurer les subscriptions temps réel après le chargement de la conversation
        this.setupSubscriptions();
      },
      error: (error) => {
        console.error('Erreur lors du chargement de la conversation:', error);
        this.toastService.showError(
          'Erreur lors du chargement de la conversation'
        );
        this.isLoading = false;
      },
    });
  }

  private setOtherParticipant(): void {
    if (
      !this.conversation?.participants ||
      this.conversation.participants.length === 0
    ) {
      console.warn('No participants found in conversation');
      this.otherParticipant = null;
      return;
    }

    console.log('Setting other participant...');
    console.log('Current user ID:', this.currentUserId);
    console.log('All participants:', this.conversation.participants);

    // Dans une conversation 1-à-1, on veut afficher l'autre personne (pas l'utilisateur actuel)
    // Dans une conversation de groupe, on peut afficher le nom du groupe ou le premier autre participant

    if (this.conversation.isGroup) {
      // Pour les groupes, on pourrait afficher le nom du groupe
      // Mais pour l'instant, on prend le premier participant qui n'est pas l'utilisateur actuel
      this.otherParticipant = this.conversation.participants.find((p: any) => {
        const participantId = p.id || p._id;
        return String(participantId) !== String(this.currentUserId);
      });
    } else {
      // Pour les conversations 1-à-1, on prend l'autre participant
      this.otherParticipant = this.conversation.participants.find((p: any) => {
        const participantId = p.id || p._id;
        console.log(
          'Comparing participant ID:',
          participantId,
          'with current user ID:',
          this.currentUserId
        );
        return String(participantId) !== String(this.currentUserId);
      });
    }

    // Fallback si aucun autre participant n'est trouvé
    if (!this.otherParticipant && this.conversation.participants.length > 0) {
      console.log('Fallback: using first participant');
      this.otherParticipant = this.conversation.participants[0];

      // Si le premier participant est l'utilisateur actuel et qu'il y en a d'autres
      if (this.conversation.participants.length > 1) {
        const firstParticipantId =
          this.otherParticipant.id || this.otherParticipant._id;
        if (String(firstParticipantId) === String(this.currentUserId)) {
          console.log(
            'First participant is current user, using second participant'
          );
          this.otherParticipant = this.conversation.participants[1];
        }
      }
    }

    // Vérification finale et logs
    if (this.otherParticipant) {
      console.log('✅ Other participant set successfully:', {
        id: this.otherParticipant.id || this.otherParticipant._id,
        username: this.otherParticipant.username,
        image: this.otherParticipant.image,
        isOnline: this.otherParticipant.isOnline,
      });

      // Log très visible pour debug
      console.log(
        '🎯 FINAL RESULT: otherParticipant =',
        this.otherParticipant.username
      );
      console.log(
        '🎯 Should display in sidebar:',
        this.otherParticipant.username
      );
    } else {
      console.error('❌ No other participant found! This should not happen.');
      console.log('Conversation participants:', this.conversation.participants);
      console.log('Current user ID:', this.currentUserId);

      // Log très visible pour debug
      console.log('🚨 ERROR: No otherParticipant found!');
    }

    // Mettre à jour l'état du champ de saisie
    this.updateInputState();
  }

  private loadMessages(): void {
    if (!this.conversation?.id) return;

    // Les messages sont déjà chargés avec la conversation
    let messages = this.conversation.messages || [];

    // Trier les messages par timestamp (plus anciens en premier)
    this.messages = messages.sort((a: any, b: any) => {
      const dateA = new Date(a.timestamp || a.createdAt).getTime();
      const dateB = new Date(b.timestamp || b.createdAt).getTime();
      return dateA - dateB; // Ordre croissant (plus anciens en premier)
    });

    console.log('📋 Messages loaded and sorted:', {
      total: this.messages.length,
      first: this.messages[0]?.content,
      last: this.messages[this.messages.length - 1]?.content,
    });

    this.hasMoreMessages = this.messages.length === this.MAX_MESSAGES_TO_LOAD;
    this.isLoading = false;
    this.scrollToBottom();
  }

  loadMoreMessages(): void {
    if (this.isLoadingMore || !this.hasMoreMessages || !this.conversation?.id)
      return;

    this.isLoadingMore = true;
    this.currentPage++;

    // Calculer l'offset basé sur les messages déjà chargés
    const offset = this.messages.length;

    this.MessageService.getMessages(
      this.currentUserId!, // senderId
      this.otherParticipant?.id || this.otherParticipant?._id!, // receiverId
      this.conversation.id,
      this.currentPage,
      this.MAX_MESSAGES_TO_LOAD
    ).subscribe({
      next: (newMessages: any[]) => {
        if (newMessages && newMessages.length > 0) {
          // Ajouter les nouveaux messages au début de la liste
          this.messages = [...newMessages.reverse(), ...this.messages];
          this.hasMoreMessages =
            newMessages.length === this.MAX_MESSAGES_TO_LOAD;
        } else {
          this.hasMoreMessages = false;
        }
        this.isLoadingMore = false;
      },
      error: (error) => {
        console.error('Erreur lors du chargement des messages:', error);
        this.toastService.showError('Erreur lors du chargement des messages');
        this.isLoadingMore = false;
        this.currentPage--; // Revenir à la page précédente en cas d'erreur
      },
    });
  }

  private setupSubscriptions(): void {
    if (!this.conversation?.id) {
      console.warn('❌ Cannot setup subscriptions: no conversation ID');
      return;
    }

    console.log(
      '🔄 Setting up real-time subscriptions for conversation:',
      this.conversation.id
    );

    // Subscription pour les nouveaux messages
    console.log('📨 Setting up message subscription...');
    this.subscriptions.add(
      this.MessageService.subscribeToNewMessages(
        this.conversation.id
      ).subscribe({
        next: (newMessage: any) => {
          console.log('📨 New message received via subscription:', newMessage);
          console.log('📨 Message structure:', {
            id: newMessage.id,
            type: newMessage.type,
            content: newMessage.content,
            sender: newMessage.sender,
            senderId: newMessage.senderId,
            receiverId: newMessage.receiverId,
            attachments: newMessage.attachments,
          });

          // Debug des attachments
          console.log(
            '📨 [Debug] Message type detected:',
            this.getMessageType(newMessage)
          );
          console.log('📨 [Debug] Has image:', this.hasImage(newMessage));
          console.log('📨 [Debug] Has file:', this.hasFile(newMessage));
          console.log('📨 [Debug] Image URL:', this.getImageUrl(newMessage));
          if (newMessage.attachments) {
            newMessage.attachments.forEach((att: any, index: number) => {
              console.log(`📨 [Debug] Attachment ${index}:`, {
                type: att.type,
                url: att.url,
                path: att.path,
                name: att.name,
                size: att.size,
              });
            });
          }

          // Ajouter le message à la liste s'il n'existe pas déjà
          const messageExists = this.messages.some(
            (msg) => msg.id === newMessage.id
          );
          if (!messageExists) {
            // Ajouter le nouveau message à la fin (en bas)
            this.messages.push(newMessage);
            console.log(
              '✅ Message added to list, total messages:',
              this.messages.length
            );

            // Forcer la détection de changements
            this.cdr.detectChanges();

            // Scroll vers le bas après un court délai
            setTimeout(() => {
              this.scrollToBottom();
            }, 50);

            // Marquer comme lu si ce n'est pas notre message
            const senderId = newMessage.sender?.id || newMessage.senderId;
            console.log('📨 Checking if message should be marked as read:', {
              senderId,
              currentUserId: this.currentUserId,
              shouldMarkAsRead: senderId !== this.currentUserId,
            });

            if (senderId && senderId !== this.currentUserId) {
              this.markMessageAsRead(newMessage.id);
            }
          }
        },
        error: (error) => {
          console.error('❌ Error in message subscription:', error);
        },
      })
    );

    // Subscription pour les indicateurs de frappe
    console.log('📝 Setting up typing indicator subscription...');
    this.subscriptions.add(
      this.MessageService.subscribeToTypingIndicator(
        this.conversation.id
      ).subscribe({
        next: (typingData: any) => {
          console.log('📝 Typing indicator received:', typingData);

          // Afficher l'indicateur seulement si c'est l'autre utilisateur qui tape
          if (typingData.userId !== this.currentUserId) {
            this.otherUserIsTyping = typingData.isTyping;
            this.cdr.detectChanges();
          }
        },
        error: (error: any) => {
          console.error('❌ Error in typing subscription:', error);
        },
      })
    );

    // Subscription pour les mises à jour de conversation
    this.subscriptions.add(
      this.MessageService.subscribeToConversationUpdates(
        this.conversation.id
      ).subscribe({
        next: (conversationUpdate: any) => {
          console.log('📋 Conversation update:', conversationUpdate);

          // Mettre à jour la conversation si nécessaire
          if (conversationUpdate.id === this.conversation.id) {
            this.conversation = { ...this.conversation, ...conversationUpdate };
            this.cdr.detectChanges();
          }
        },
        error: (error: any) => {
          console.error('❌ Error in conversation subscription:', error);
        },
      })
    );
  }

  private markMessageAsRead(messageId: string): void {
    this.MessageService.markMessageAsRead(messageId).subscribe({
      next: () => {
        console.log('✅ Message marked as read:', messageId);
      },
      error: (error) => {
        console.error('❌ Error marking message as read:', error);
      },
    });
  }

  // === ENVOI DE MESSAGES ===
  sendMessage(): void {
    if (!this.messageForm.valid || !this.conversation?.id) return;

    const content = this.messageForm.get('content')?.value?.trim();
    if (!content) return;

    const receiverId = this.otherParticipant?.id || this.otherParticipant?._id;

    if (!receiverId) {
      this.toastService.showError('Destinataire introuvable');
      return;
    }

    // Désactiver le bouton d'envoi
    this.isSendingMessage = true;
    this.updateInputState();

    console.log('📤 Sending message:', {
      content,
      receiverId,
      conversationId: this.conversation.id,
    });

    this.MessageService.sendMessage(
      receiverId,
      content,
      undefined,
      'TEXT' as any,
      this.conversation.id
    ).subscribe({
      next: (message: any) => {
        console.log('✅ Message sent successfully:', message);

        // Ajouter le message à la liste s'il n'y est pas déjà
        const messageExists = this.messages.some(
          (msg) => msg.id === message.id
        );
        if (!messageExists) {
          this.messages.push(message);
          console.log(
            '📋 Message added to local list, total:',
            this.messages.length
          );
        }

        // Réinitialiser le formulaire
        this.messageForm.reset();
        this.isSendingMessage = false;
        this.updateInputState();

        // Forcer la détection de changements et scroll
        this.cdr.detectChanges();
        setTimeout(() => {
          this.scrollToBottom();
        }, 50);
      },
      error: (error: any) => {
        console.error("❌ Erreur lors de l'envoi du message:", error);
        this.toastService.showError("Erreur lors de l'envoi du message");
        this.isSendingMessage = false;
        this.updateInputState();
      },
    });
  }

  scrollToBottom(): void {
    setTimeout(() => {
      if (this.messagesContainer) {
        const element = this.messagesContainer.nativeElement;
        element.scrollTop = element.scrollHeight;
      }
    }, 100);
  }

  // === MÉTHODES UTILITAIRES OPTIMISÉES ===
  formatLastActive(lastActive: string | Date | null): string {
    if (!lastActive) return 'Hors ligne';

    const diffMins = Math.floor(
      (Date.now() - new Date(lastActive).getTime()) / 60000
    );

    if (diffMins < 1) return "À l'instant";
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffMins < 1440) return `Il y a ${Math.floor(diffMins / 60)}h`;
    return `Il y a ${Math.floor(diffMins / 1440)}j`;
  }

  // Méthodes utilitaires pour les messages vocaux
  getVoicePlaybackData(messageId: string) {
    return (
      this.voicePlayback[messageId] || {
        progress: 0,
        duration: 0,
        currentTime: 0,
        speed: 1,
      }
    );
  }

  private setVoicePlaybackData(
    messageId: string,
    data: Partial<(typeof this.voicePlayback)[string]>
  ) {
    this.voicePlayback[messageId] = {
      ...this.getVoicePlaybackData(messageId),
      ...data,
    };
  }

  // === MÉTHODES POUR LES MESSAGES VOCAUX (TEMPLATE) ===

  // === MÉTHODES SUPPRIMÉES (DUPLICATIONS) ===
  // isVoicePlaying, playVoiceMessage, toggleVoicePlayback - définies plus loin

  // === MÉTHODES POUR LES APPELS (TEMPLATE) ===

  startVideoCall(): void {
    if (!this.otherParticipant?.id) {
      this.toastService.showError("Impossible de démarrer l'appel");
      return;
    }

    this.callType = 'VIDEO';
    this.isInCall = true;
    console.log('📹 Starting video call with:', this.otherParticipant.username);
  }

  startVoiceCall(): void {
    if (!this.otherParticipant?.id) {
      this.toastService.showError("Impossible de démarrer l'appel");
      return;
    }

    this.callType = 'AUDIO';
    this.isInCall = true;
    console.log('📞 Starting voice call with:', this.otherParticipant.username);
  }

  endCall(): void {
    this.isInCall = false;
    this.callType = null;
    this.activeCall = null;
    console.log('📞 Call ended');
  }

  // === MÉTHODES SUPPRIMÉES (DUPLICATIONS) ===
  // onCallAccepted, onCallRejected - définies plus loin

  // === MÉTHODES POUR LES FICHIERS (TEMPLATE) ===

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return Math.round(bytes / 1024) + ' KB';
    return Math.round(bytes / 1048576) + ' MB';
  }

  downloadFile(message: any): void {
    const fileAttachment = message.attachments?.find(
      (att: any) => !att.type?.startsWith('image/')
    );
    if (fileAttachment?.url) {
      const link = document.createElement('a');
      link.href = fileAttachment.url;
      link.download = fileAttachment.name || 'file';
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      this.toastService.showSuccess('Téléchargement démarré');
    }
  }

  // === MÉTHODES POUR L'INTERFACE UTILISATEUR (TEMPLATE) ===

  toggleSearch(): void {
    this.searchMode = !this.searchMode;
    this.showSearch = this.searchMode;
  }

  toggleMainMenu(): void {
    this.showMainMenu = !this.showMainMenu;
  }

  goBackToConversations(): void {
    console.log('🔙 Going back to conversations');
    // Naviguer vers la liste des conversations
    this.router
      .navigate(['/front/messages/conversations'])
      .then(() => {
        console.log('✅ Navigation to conversations successful');
      })
      .catch((error) => {
        console.error('❌ Navigation error:', error);
        // Fallback: essayer la route parent
        this.router.navigate(['/front/messages']).catch(() => {
          // Dernier recours: recharger la page
          window.location.href = '/front/messages/conversations';
        });
      });
  }

  // === MÉTHODES POUR LES MENUS ET INTERACTIONS ===

  closeAllMenus(): void {
    this.showEmojiPicker = false;
    this.showAttachmentMenu = false;
    this.showMainMenu = false;
    this.showMessageContextMenu = false;
    this.showReactionPicker = false;
  }

  onMessageContextMenu(message: any, event: MouseEvent): void {
    event.preventDefault();
    this.selectedMessage = message;
    this.contextMenuPosition = { x: event.clientX, y: event.clientY };
    this.showMessageContextMenu = true;
  }

  showQuickReactions(message: any, event: MouseEvent): void {
    event.stopPropagation();
    this.reactionPickerMessage = message;
    this.contextMenuPosition = { x: event.clientX, y: event.clientY };
    this.showReactionPicker = true;
  }

  quickReact(emoji: string): void {
    if (this.reactionPickerMessage) {
      this.toggleReaction(this.reactionPickerMessage.id, emoji);
    }
    this.showReactionPicker = false;
  }

  toggleReaction(messageId: string, emoji: string): void {
    console.log('👍 Toggling reaction:', emoji, 'for message:', messageId);
    // Implémentation de la réaction
  }

  hasUserReacted(reaction: any, userId: string): boolean {
    return reaction.userId === userId;
  }

  replyToMessage(message: any): void {
    console.log('↩️ Replying to message:', message.id);
    this.closeAllMenus();
  }

  forwardMessage(message: any): void {
    console.log('➡️ Forwarding message:', message.id);
    this.closeAllMenus();
  }

  deleteMessage(message: any): void {
    console.log('🗑️ Deleting message:', message.id);
    this.closeAllMenus();
  }

  // === MÉTHODES POUR LES ÉMOJIS ET PIÈCES JOINTES ===

  toggleEmojiPicker(): void {
    this.showEmojiPicker = !this.showEmojiPicker;
  }

  selectEmojiCategory(category: any): void {
    this.selectedEmojiCategory = category;
  }

  getEmojisForCategory(category: any): any[] {
    return category?.emojis || [];
  }

  insertEmoji(emoji: any): void {
    const currentContent = this.messageForm.get('content')?.value || '';
    const newContent = currentContent + emoji.emoji;
    this.messageForm.patchValue({ content: newContent });
    this.showEmojiPicker = false;
  }

  toggleAttachmentMenu(): void {
    this.showAttachmentMenu = !this.showAttachmentMenu;
  }

  // === MÉTHODES SUPPRIMÉES (DUPLICATIONS) ===
  // triggerFileInput, getFileAcceptTypes, onFileSelected - définies plus loin

  // === MÉTHODES SUPPRIMÉES (DUPLICATIONS) ===
  // Ces méthodes sont déjà définies plus loin dans le fichier

  // === MÉTHODES POUR LA GESTION DE LA FRAPPE ===

  // === MÉTHODE SUPPRIMÉE (DUPLICATION) ===
  // handleTypingIndicator - définie plus loin

  // === MÉTHODES UTILITAIRES POUR LE TEMPLATE ===

  trackByMessageId(index: number, message: any): string {
    return message.id || message._id || index.toString();
  }

  // === MÉTHODES MANQUANTES POUR LE TEMPLATE ===

  testAddMessage(): void {
    console.log('🧪 Test: Adding message');
    const testMessage = {
      id: `test-${Date.now()}`,
      content: `Message de test ${new Date().toLocaleTimeString()}`,
      timestamp: new Date().toISOString(),
      sender: {
        id: this.otherParticipant?.id || 'test-user',
        username: this.otherParticipant?.username || 'Test User',
        image:
          this.otherParticipant?.image || 'assets/images/default-avatar.png',
      },
      type: 'TEXT',
      isRead: false,
    };
    this.messages.push(testMessage);
    this.cdr.detectChanges();
    setTimeout(() => this.scrollToBottom(), 50);
  }

  isGroupConversation(): boolean {
    return (
      this.conversation?.isGroup ||
      this.conversation?.participants?.length > 2 ||
      false
    );
  }

  openCamera(): void {
    console.log('📷 Opening camera');
    this.showAttachmentMenu = false;
    // TODO: Implémenter l'ouverture de la caméra
  }

  zoomImage(factor: number): void {
    const imageElement = document.querySelector(
      '.image-viewer-zoom'
    ) as HTMLElement;
    if (imageElement) {
      const currentTransform = imageElement.style.transform || 'scale(1)';
      const currentScale = parseFloat(
        currentTransform.match(/scale\(([^)]+)\)/)?.[1] || '1'
      );
      const newScale = Math.max(0.5, Math.min(3, currentScale * factor));
      imageElement.style.transform = `scale(${newScale})`;
      if (newScale > 1) {
        imageElement.classList.add('zoomed');
      } else {
        imageElement.classList.remove('zoomed');
      }
    }
  }

  resetZoom(): void {
    const imageElement = document.querySelector(
      '.image-viewer-zoom'
    ) as HTMLElement;
    if (imageElement) {
      imageElement.style.transform = 'scale(1)';
      imageElement.classList.remove('zoomed');
    }
  }

  // === MÉTHODES SUPPRIMÉES (DUPLICATIONS) ===
  // formatFileSize, downloadFile, toggleReaction, hasUserReacted, showQuickReactions
  // toggleEmojiPicker, toggleAttachmentMenu, selectEmojiCategory, getEmojisForCategory, insertEmoji
  // Ces méthodes sont déjà définies plus loin dans le fichier

  triggerFileInput(type?: string): void {
    const input = this.fileInput?.nativeElement;
    if (!input) {
      console.error('File input element not found');
      return;
    }

    // Configurer le type de fichier accepté
    if (type === 'image') {
      input.accept = 'image/*';
    } else if (type === 'video') {
      input.accept = 'video/*';
    } else if (type === 'document') {
      input.accept = '.pdf,.doc,.docx,.xls,.xlsx,.txt';
    } else {
      input.accept = '*/*';
    }

    // Réinitialiser la valeur pour permettre la sélection du même fichier
    input.value = '';

    // Déclencher la sélection de fichier
    input.click();
    this.showAttachmentMenu = false;
  }

  formatMessageTime(timestamp: string | Date): string {
    if (!timestamp) return '';

    const date = new Date(timestamp);
    return date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  formatDateSeparator(timestamp: string | Date): string {
    if (!timestamp) return '';

    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Aujourd'hui";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Hier';
    } else {
      return date.toLocaleDateString('fr-FR');
    }
  }

  formatMessageContent(content: string): string {
    if (!content) return '';

    // Remplacer les URLs par des liens
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return content.replace(
      urlRegex,
      '<a href="$1" target="_blank" class="text-blue-500 underline">$1</a>'
    );
  }

  shouldShowDateSeparator(index: number): boolean {
    if (index === 0) return true;

    const currentMessage = this.messages[index];
    const previousMessage = this.messages[index - 1];

    if (!currentMessage?.timestamp || !previousMessage?.timestamp) return false;

    const currentDate = new Date(currentMessage.timestamp).toDateString();
    const previousDate = new Date(previousMessage.timestamp).toDateString();

    return currentDate !== previousDate;
  }

  shouldShowAvatar(index: number): boolean {
    const currentMessage = this.messages[index];
    const nextMessage = this.messages[index + 1];

    if (!nextMessage) return true;

    return currentMessage.sender?.id !== nextMessage.sender?.id;
  }

  shouldShowSenderName(index: number): boolean {
    const currentMessage = this.messages[index];
    const previousMessage = this.messages[index - 1];

    if (!previousMessage) return true;

    return currentMessage.sender?.id !== previousMessage.sender?.id;
  }

  getMessageType(message: any): string {
    // Vérifier d'abord le type de message explicite
    if (message.type) {
      if (message.type === 'IMAGE' || message.type === 'image') return 'image';
      if (message.type === 'VIDEO' || message.type === 'video') return 'video';
      if (message.type === 'AUDIO' || message.type === 'audio') return 'audio';
      if (message.type === 'VOICE_MESSAGE') return 'audio';
      if (message.type === 'FILE' || message.type === 'file') return 'file';
    }

    // Ensuite vérifier les attachments
    if (message.attachments && message.attachments.length > 0) {
      const attachment = message.attachments[0];
      if (attachment.type?.startsWith('image/')) return 'image';
      if (attachment.type?.startsWith('video/')) return 'video';
      if (attachment.type?.startsWith('audio/')) return 'audio';
      return 'file';
    }

    // Vérifier si c'est un message vocal basé sur les propriétés
    if (message.voiceUrl || message.audioUrl || message.voice) return 'audio';

    return 'text';
  }

  hasImage(message: any): boolean {
    // Vérifier le type de message
    if (message.type === 'IMAGE' || message.type === 'image') {
      return true;
    }

    // Vérifier les attachments
    const hasImageAttachment =
      message.attachments?.some((att: any) => {
        return att.type?.startsWith('image/') || att.type === 'IMAGE';
      }) || false;

    // Vérifier les propriétés directes d'image
    const hasImageUrl = !!(message.imageUrl || message.image);

    return hasImageAttachment || hasImageUrl;
  }

  hasFile(message: any): boolean {
    // Vérifier le type de message
    if (message.type === 'FILE' || message.type === 'file') {
      return true;
    }

    // Vérifier les attachments non-image
    const hasFileAttachment =
      message.attachments?.some((att: any) => {
        return !att.type?.startsWith('image/') && att.type !== 'IMAGE';
      }) || false;

    return hasFileAttachment;
  }

  getImageUrl(message: any): string {
    // Vérifier les propriétés directes d'image
    if (message.imageUrl) {
      return message.imageUrl;
    }
    if (message.image) {
      return message.image;
    }

    // Vérifier les attachments
    const imageAttachment = message.attachments?.find(
      (att: any) => att.type?.startsWith('image/') || att.type === 'IMAGE'
    );

    if (imageAttachment) {
      return imageAttachment.url || imageAttachment.path || '';
    }

    return '';
  }

  getFileName(message: any): string {
    const fileAttachment = message.attachments?.find(
      (att: any) => !att.type?.startsWith('image/')
    );
    return fileAttachment?.name || 'Fichier';
  }

  getFileSize(message: any): string {
    const fileAttachment = message.attachments?.find(
      (att: any) => !att.type?.startsWith('image/')
    );
    if (!fileAttachment?.size) return '';

    const bytes = fileAttachment.size;
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return Math.round(bytes / 1024) + ' KB';
    return Math.round(bytes / 1048576) + ' MB';
  }

  getFileIcon(message: any): string {
    const fileAttachment = message.attachments?.find(
      (att: any) => !att.type?.startsWith('image/')
    );
    if (!fileAttachment?.type) return 'fas fa-file';

    if (fileAttachment.type.startsWith('audio/')) return 'fas fa-file-audio';
    if (fileAttachment.type.startsWith('video/')) return 'fas fa-file-video';
    if (fileAttachment.type.includes('pdf')) return 'fas fa-file-pdf';
    if (fileAttachment.type.includes('word')) return 'fas fa-file-word';
    if (fileAttachment.type.includes('excel')) return 'fas fa-file-excel';
    return 'fas fa-file';
  }

  getUserColor(userId: string): string {
    // Générer une couleur basée sur l'ID utilisateur
    const colors = [
      '#FF6B6B',
      '#4ECDC4',
      '#45B7D1',
      '#96CEB4',
      '#FFEAA7',
      '#DDA0DD',
      '#98D8C8',
    ];
    const index = userId.charCodeAt(0) % colors.length;
    return colors[index];
  }

  // === MÉTHODES D'INTERACTION ===
  onMessageClick(message: any, event: any): void {
    console.log('Message clicked:', message);
  }

  onInputChange(event: any): void {
    // Gérer les changements dans le champ de saisie
    this.handleTypingIndicator();
  }

  onInputKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  onInputFocus(): void {
    // Gérer le focus sur le champ de saisie
  }

  onInputBlur(): void {
    // Gérer la perte de focus sur le champ de saisie
  }

  onScroll(event: any): void {
    // Gérer le scroll pour charger plus de messages
    const element = event.target;
    if (
      element.scrollTop === 0 &&
      this.hasMoreMessages &&
      !this.isLoadingMore
    ) {
      this.loadMoreMessages();
    }
  }

  openUserProfile(userId: string): void {
    console.log('Opening user profile for:', userId);
  }

  onImageLoad(event: any, message: any): void {
    console.log(
      '🖼️ [Debug] Image loaded successfully for message:',
      message.id,
      event.target.src
    );
  }

  onImageError(event: any, message: any): void {
    console.error('🖼️ [Debug] Image failed to load for message:', message.id, {
      src: event.target.src,
      error: event,
    });
    // Optionnel : afficher une image de remplacement
    event.target.src =
      'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzZiNzI4MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIG5vbiBkaXNwb25pYmxlPC90ZXh0Pjwvc3ZnPg==';
  }

  openImageViewer(message: any): void {
    const imageAttachment = message.attachments?.find((att: any) =>
      att.type?.startsWith('image/')
    );
    if (imageAttachment?.url) {
      this.selectedImage = {
        url: imageAttachment.url,
        name: imageAttachment.name || 'Image',
        size: this.formatFileSize(imageAttachment.size || 0),
        message: message,
      };
      this.showImageViewer = true;
      console.log('🖼️ [ImageViewer] Opening image:', this.selectedImage);
    }
  }

  closeImageViewer(): void {
    this.showImageViewer = false;
    this.selectedImage = null;
    console.log('🖼️ [ImageViewer] Closed');
  }

  downloadImage(): void {
    if (this.selectedImage?.url) {
      const link = document.createElement('a');
      link.href = this.selectedImage.url;
      link.download = this.selectedImage.name || 'image';
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      this.toastService.showSuccess('Téléchargement démarré');
      console.log(
        '🖼️ [ImageViewer] Download started:',
        this.selectedImage.name
      );
    }
  }

  // === MÉTHODES SUPPRIMÉES (DUPLICATIONS) ===
  // zoomImage, resetZoom, formatFileSize, downloadFile, toggleReaction, hasUserReacted, toggleSearch
  // Ces méthodes sont déjà définies plus loin dans le fichier

  searchMessages(): void {
    if (!this.searchQuery.trim()) {
      this.searchResults = [];
      return;
    }

    this.searchResults = this.messages.filter(
      (message) =>
        message.content
          ?.toLowerCase()
          .includes(this.searchQuery.toLowerCase()) ||
        message.sender?.username
          ?.toLowerCase()
          .includes(this.searchQuery.toLowerCase())
    );
  }

  onSearchQueryChange(): void {
    this.searchMessages();
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.searchResults = [];
  }

  jumpToMessage(messageId: string): void {
    const messageElement = document.getElementById(`message-${messageId}`);
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Highlight temporairement le message
      messageElement.classList.add('highlight');
      setTimeout(() => {
        messageElement.classList.remove('highlight');
      }, 2000);
    }
  }

  // === MÉTHODES SUPPRIMÉES (DUPLICATIONS) ===
  // toggleMainMenu, toggleTheme, onMessageContextMenu
  // Ces méthodes sont déjà définies plus loin dans le fichier

  closeContextMenu(): void {
    this.showMessageContextMenu = false;
    this.selectedMessage = null;
  }

  // === MÉTHODES SUPPRIMÉES (DUPLICATIONS) ===
  // replyToMessage, forwardMessage, deleteMessage, showQuickReactions, closeReactionPicker
  // quickReact, closeAllMenus, testAddMessage, toggleAttachmentMenu, toggleEmojiPicker
  // Ces méthodes sont déjà définies plus loin dans le fichier

  // === MÉTHODE SUPPRIMÉE (DUPLICATION) ===
  // triggerFileInput - définie plus loin

  // === MÉTHODES SUPPRIMÉES (DUPLICATIONS) ===
  // openCamera, getEmojisForCategory, selectEmojiCategory, insertEmoji
  // goBackToConversations, startVideoCall, startVoiceCall
  // Ces méthodes sont déjà définies plus loin dans le fichier

  private initiateCall(callType: CallType): void {
    if (!this.otherParticipant) {
      this.toastService.showError('Aucun destinataire sélectionné');
      return;
    }

    const recipientId = this.otherParticipant.id || this.otherParticipant._id;
    if (!recipientId) {
      this.toastService.showError('ID du destinataire introuvable');
      return;
    }

    console.log(`🔄 Initiating ${callType} call to user:`, recipientId);

    this.isInCall = true;
    this.callType = callType === CallType.VIDEO ? 'VIDEO' : 'AUDIO';
    this.callDuration = 0;

    // Démarrer le timer d'appel
    this.startCallTimer();

    // Utiliser le vrai service WebRTC
    this.MessageService.initiateCall(
      recipientId,
      callType,
      this.conversation?.id
    ).subscribe({
      next: (call: Call) => {
        console.log('✅ Call initiated successfully:', call);
        this.activeCall = call;
        this.isCallConnected = false;
        this.toastService.showSuccess(
          `Appel ${callType === CallType.VIDEO ? 'vidéo' : 'audio'} initié`
        );
      },
      error: (error) => {
        console.error('❌ Error initiating call:', error);
        this.endCall();
        this.toastService.showError("Erreur lors de l'initiation de l'appel");
      },
    });
  }

  acceptCall(incomingCall: IncomingCall): void {
    console.log('🔄 Accepting incoming call:', incomingCall);

    this.MessageService.acceptCall(incomingCall).subscribe({
      next: (call: Call) => {
        console.log('✅ Call accepted successfully:', call);
        this.activeCall = call;
        this.isInCall = true;
        this.isCallConnected = true;
        this.callType = call.type === CallType.VIDEO ? 'VIDEO' : 'AUDIO';
        this.startCallTimer();
        this.toastService.showSuccess('Appel accepté');
      },
      error: (error) => {
        console.error('❌ Error accepting call:', error);
        this.toastService.showError("Erreur lors de l'acceptation de l'appel");
      },
    });
  }

  rejectCall(incomingCall: IncomingCall): void {
    console.log('🔄 Rejecting incoming call:', incomingCall);

    this.MessageService.rejectCall(incomingCall.id, 'User rejected').subscribe({
      next: () => {
        console.log('✅ Call rejected successfully');
        this.toastService.showSuccess('Appel rejeté');
      },
      error: (error) => {
        console.error('❌ Error rejecting call:', error);
        this.toastService.showError("Erreur lors du rejet de l'appel");
      },
    });
  }

  // === MÉTHODE SUPPRIMÉE (DUPLICATION) ===
  // endCall - Cette méthode est déjà définie plus loin dans le fichier

  private startCallTimer(): void {
    this.callDuration = 0;
    this.callTimer = setInterval(() => {
      this.callDuration++;
      this.cdr.detectChanges();
    }, 1000);
  }

  private resetCallState(): void {
    if (this.callTimer) {
      clearInterval(this.callTimer);
      this.callTimer = null;
    }

    this.isInCall = false;
    this.callType = null;
    this.callDuration = 0;
    this.activeCall = null;
    this.isCallConnected = false;
    this.isMuted = false;
    this.isVideoEnabled = true;
  }

  // === CONTRÔLES D'APPEL ===
  toggleMute(): void {
    if (!this.activeCall) return;

    this.isMuted = !this.isMuted;

    // Utiliser la méthode toggleMedia du service
    this.MessageService.toggleMedia(
      this.activeCall.id,
      undefined, // video unchanged
      !this.isMuted // audio state
    ).subscribe({
      next: () => {
        this.toastService.showSuccess(
          this.isMuted ? 'Micro coupé' : 'Micro activé'
        );
      },
      error: (error) => {
        console.error('❌ Error toggling mute:', error);
        // Revert state on error
        this.isMuted = !this.isMuted;
        this.toastService.showError('Erreur lors du changement du micro');
      },
    });
  }

  toggleVideo(): void {
    if (!this.activeCall) return;

    this.isVideoEnabled = !this.isVideoEnabled;

    // Utiliser la méthode toggleMedia du service
    this.MessageService.toggleMedia(
      this.activeCall.id,
      this.isVideoEnabled, // video state
      undefined // audio unchanged
    ).subscribe({
      next: () => {
        this.toastService.showSuccess(
          this.isVideoEnabled ? 'Caméra activée' : 'Caméra désactivée'
        );
      },
      error: (error) => {
        console.error('❌ Error toggling video:', error);
        // Revert state on error
        this.isVideoEnabled = !this.isVideoEnabled;
        this.toastService.showError('Erreur lors du changement de la caméra');
      },
    });
  }

  formatCallDuration(duration: number): string {
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    const seconds = duration % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds
        .toString()
        .padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  // === MÉTHODES SUPPRIMÉES (DUPLICATIONS) ===
  // trackByMessageId, isGroupConversation - Ces méthodes sont déjà définies plus loin dans le fichier

  async startVoiceRecording(): Promise<void> {
    console.log('🎤 [Voice] Starting voice recording...');

    try {
      // Vérifier le support du navigateur
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error(
          "Votre navigateur ne supporte pas l'enregistrement audio"
        );
      }

      // Vérifier si MediaRecorder est supporté
      if (!window.MediaRecorder) {
        throw new Error(
          "MediaRecorder n'est pas supporté par votre navigateur"
        );
      }

      console.log('🎤 [Voice] Requesting microphone access...');

      // Demander l'accès au microphone avec des contraintes optimisées
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
          channelCount: 1,
        },
      });

      console.log('🎤 [Voice] Microphone access granted');

      // Vérifier les types MIME supportés
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'audio/mp4';
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = ''; // Laisser le navigateur choisir
          }
        }
      }

      console.log('🎤 [Voice] Using MIME type:', mimeType);

      // Créer le MediaRecorder
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeType || undefined,
      });

      // Initialiser les variables
      this.audioChunks = [];
      this.isRecordingVoice = true;
      this.voiceRecordingDuration = 0;
      this.voiceRecordingState = 'recording';

      console.log('🎤 [Voice] MediaRecorder created, starting timer...');

      // Démarrer le timer
      this.recordingTimer = setInterval(() => {
        this.voiceRecordingDuration++;
        // Animer les waves
        this.animateVoiceWaves();
        this.cdr.detectChanges();
      }, 1000);

      // Gérer les événements du MediaRecorder
      this.mediaRecorder.ondataavailable = (event) => {
        console.log('🎤 [Voice] Data available:', event.data.size, 'bytes');
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        console.log('🎤 [Voice] MediaRecorder stopped, processing audio...');
        this.processRecordedAudio();
      };

      this.mediaRecorder.onerror = (event: any) => {
        console.error('🎤 [Voice] MediaRecorder error:', event.error);
        this.toastService.showError("Erreur lors de l'enregistrement");
        this.cancelVoiceRecording();
      };

      // Démarrer l'enregistrement
      this.mediaRecorder.start(100); // Collecter les données toutes les 100ms
      console.log('🎤 [Voice] Recording started successfully');

      this.toastService.showSuccess('🎤 Enregistrement vocal démarré');
    } catch (error: any) {
      console.error('🎤 [Voice] Error starting recording:', error);

      let errorMessage = "Impossible de démarrer l'enregistrement vocal";

      if (error.name === 'NotAllowedError') {
        errorMessage =
          "Accès au microphone refusé. Veuillez autoriser l'accès dans les paramètres de votre navigateur.";
      } else if (error.name === 'NotFoundError') {
        errorMessage =
          'Aucun microphone détecté. Veuillez connecter un microphone.';
      } else if (error.name === 'NotSupportedError') {
        errorMessage =
          "Votre navigateur ne supporte pas l'enregistrement audio.";
      } else if (error.message) {
        errorMessage = error.message;
      }

      this.toastService.showError(errorMessage);
      this.cancelVoiceRecording();
    }
  }

  stopVoiceRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
      this.mediaRecorder.stream.getTracks().forEach((track) => track.stop());
    }

    if (this.recordingTimer) {
      clearInterval(this.recordingTimer);
      this.recordingTimer = null;
    }

    this.isRecordingVoice = false;
    this.voiceRecordingState = 'processing';
  }

  cancelVoiceRecording(): void {
    if (this.mediaRecorder) {
      if (this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.stop();
      }
      this.mediaRecorder.stream.getTracks().forEach((track) => track.stop());
      this.mediaRecorder = null;
    }

    if (this.recordingTimer) {
      clearInterval(this.recordingTimer);
      this.recordingTimer = null;
    }

    this.isRecordingVoice = false;
    this.voiceRecordingDuration = 0;
    this.voiceRecordingState = 'idle';
    this.audioChunks = [];
  }

  private async processRecordedAudio(): Promise<void> {
    console.log('🎤 [Voice] Processing recorded audio...');

    try {
      // Vérifier qu'on a des données audio
      if (this.audioChunks.length === 0) {
        console.error('🎤 [Voice] No audio chunks available');
        this.toastService.showError('Aucun audio enregistré');
        this.cancelVoiceRecording();
        return;
      }

      console.log(
        '🎤 [Voice] Audio chunks:',
        this.audioChunks.length,
        'Duration:',
        this.voiceRecordingDuration
      );

      // Vérifier la durée minimale
      if (this.voiceRecordingDuration < 1) {
        console.error(
          '🎤 [Voice] Recording too short:',
          this.voiceRecordingDuration
        );
        this.toastService.showError(
          'Enregistrement trop court (minimum 1 seconde)'
        );
        this.cancelVoiceRecording();
        return;
      }

      // Déterminer le type MIME du blob
      let mimeType = 'audio/webm;codecs=opus';
      if (this.mediaRecorder?.mimeType) {
        mimeType = this.mediaRecorder.mimeType;
      }

      console.log('🎤 [Voice] Creating audio blob with MIME type:', mimeType);

      // Créer le blob audio
      const audioBlob = new Blob(this.audioChunks, {
        type: mimeType,
      });

      console.log('🎤 [Voice] Audio blob created:', {
        size: audioBlob.size,
        type: audioBlob.type,
      });

      // Déterminer l'extension du fichier
      let extension = '.webm';
      if (mimeType.includes('mp4')) {
        extension = '.mp4';
      } else if (mimeType.includes('wav')) {
        extension = '.wav';
      } else if (mimeType.includes('ogg')) {
        extension = '.ogg';
      }

      // Créer le fichier
      const audioFile = new File(
        [audioBlob],
        `voice_${Date.now()}${extension}`,
        {
          type: mimeType,
        }
      );

      console.log('🎤 [Voice] Audio file created:', {
        name: audioFile.name,
        size: audioFile.size,
        type: audioFile.type,
      });

      // Envoyer le message vocal
      this.voiceRecordingState = 'processing';
      await this.sendVoiceMessage(audioFile);

      console.log('🎤 [Voice] Voice message sent successfully');
      this.toastService.showSuccess('🎤 Message vocal envoyé');
    } catch (error: any) {
      console.error('🎤 [Voice] Error processing audio:', error);
      this.toastService.showError(
        "Erreur lors de l'envoi du message vocal: " +
          (error.message || 'Erreur inconnue')
      );
    } finally {
      // Nettoyer l'état
      this.voiceRecordingState = 'idle';
      this.voiceRecordingDuration = 0;
      this.audioChunks = [];
      this.isRecordingVoice = false;

      console.log('🎤 [Voice] Audio processing completed, state reset');
    }
  }

  private async sendVoiceMessage(audioFile: File): Promise<void> {
    const receiverId = this.otherParticipant?.id || this.otherParticipant?._id;

    if (!receiverId) {
      throw new Error('Destinataire introuvable');
    }

    return new Promise((resolve, reject) => {
      this.MessageService.sendMessage(
        receiverId,
        '',
        audioFile,
        'AUDIO' as any,
        this.conversation.id
      ).subscribe({
        next: (message: any) => {
          this.messages.push(message);
          this.scrollToBottom();
          resolve();
        },
        error: (error: any) => {
          console.error("Erreur lors de l'envoi du message vocal:", error);
          reject(error);
        },
      });
    });
  }

  formatRecordingDuration(duration: number): string {
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  // === MÉTHODES D'ENREGISTREMENT VOCAL AMÉLIORÉES ===

  onRecordStart(event: Event): void {
    event.preventDefault();
    console.log('🎤 [Voice] Record start triggered');
    console.log('🎤 [Voice] Current state:', {
      isRecordingVoice: this.isRecordingVoice,
      voiceRecordingState: this.voiceRecordingState,
      voiceRecordingDuration: this.voiceRecordingDuration,
      mediaRecorder: !!this.mediaRecorder,
    });

    // Vérifier si on peut enregistrer
    if (this.voiceRecordingState === 'processing') {
      console.log('🎤 [Voice] Already processing, ignoring start');
      this.toastService.showWarning('Traitement en cours...');
      return;
    }

    if (this.isRecordingVoice) {
      console.log('🎤 [Voice] Already recording, ignoring start');
      this.toastService.showWarning('Enregistrement déjà en cours...');
      return;
    }

    // Afficher un message de début
    this.toastService.showInfo("🎤 Démarrage de l'enregistrement vocal...");

    // Démarrer l'enregistrement
    this.startVoiceRecording().catch((error) => {
      console.error('🎤 [Voice] Failed to start recording:', error);
      this.toastService.showError(
        "Impossible de démarrer l'enregistrement vocal: " +
          (error.message || 'Erreur inconnue')
      );
    });
  }

  onRecordEnd(event: Event): void {
    event.preventDefault();
    console.log('🎤 [Voice] Record end triggered');

    if (!this.isRecordingVoice) {
      console.log('🎤 [Voice] Not recording, ignoring end');
      return;
    }

    // Arrêter l'enregistrement et envoyer
    this.stopVoiceRecording();
  }

  onRecordCancel(event: Event): void {
    event.preventDefault();
    console.log('🎤 [Voice] Record cancel triggered');

    if (!this.isRecordingVoice) {
      console.log('🎤 [Voice] Not recording, ignoring cancel');
      return;
    }

    // Annuler l'enregistrement
    this.cancelVoiceRecording();
  }

  getRecordingFormat(): string {
    if (this.mediaRecorder?.mimeType) {
      if (this.mediaRecorder.mimeType.includes('webm')) return 'WebM';
      if (this.mediaRecorder.mimeType.includes('mp4')) return 'MP4';
      if (this.mediaRecorder.mimeType.includes('wav')) return 'WAV';
      if (this.mediaRecorder.mimeType.includes('ogg')) return 'OGG';
    }
    return 'Auto';
  }

  // === ANIMATION DES WAVES VOCALES ===

  private animateVoiceWaves(): void {
    // Animer les waves pendant l'enregistrement
    this.voiceWaves = this.voiceWaves.map(() => {
      return Math.floor(Math.random() * 20) + 4; // Hauteur entre 4 et 24px
    });
  }

  onFileSelected(event: any): void {
    console.log('📁 [Upload] File selection triggered');
    const files = event.target.files;

    if (!files || files.length === 0) {
      console.log('📁 [Upload] No files selected');
      return;
    }

    console.log(`📁 [Upload] ${files.length} file(s) selected:`, files);

    for (let file of files) {
      console.log(
        `📁 [Upload] Processing file: ${file.name}, size: ${file.size}, type: ${file.type}`
      );
      this.uploadFile(file);
    }
  }

  private uploadFile(file: File): void {
    console.log(`📁 [Upload] Starting upload for file: ${file.name}`);

    const receiverId = this.otherParticipant?.id || this.otherParticipant?._id;

    if (!receiverId) {
      console.error('📁 [Upload] No receiver ID found');
      this.toastService.showError('Destinataire introuvable');
      return;
    }

    console.log(`📁 [Upload] Receiver ID: ${receiverId}`);

    // Vérifier la taille du fichier (max 50MB)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      console.error(`📁 [Upload] File too large: ${file.size} bytes`);
      this.toastService.showError('Fichier trop volumineux (max 50MB)');
      return;
    }

    // 🖼️ Compression d'image si nécessaire
    if (file.type.startsWith('image/') && file.size > 1024 * 1024) {
      // > 1MB
      console.log(
        '🖼️ [Compression] Compressing image:',
        file.name,
        'Original size:',
        file.size
      );
      this.compressImage(file)
        .then((compressedFile) => {
          console.log(
            '🖼️ [Compression] ✅ Image compressed successfully. New size:',
            compressedFile.size
          );
          this.sendFileToServer(compressedFile, receiverId);
        })
        .catch((error) => {
          console.error('🖼️ [Compression] ❌ Error compressing image:', error);
          // Envoyer le fichier original en cas d'erreur
          this.sendFileToServer(file, receiverId);
        });
      return;
    }

    // Envoyer le fichier sans compression
    this.sendFileToServer(file, receiverId);
  }

  private sendFileToServer(file: File, receiverId: string): void {
    const messageType = this.getFileMessageType(file);
    console.log(`📁 [Upload] Message type determined: ${messageType}`);
    console.log(`📁 [Upload] Conversation ID: ${this.conversation.id}`);

    this.isSendingMessage = true;
    this.isUploading = true;
    this.uploadProgress = 0;
    console.log('📁 [Upload] Calling MessageService.sendMessage...');

    // Simuler la progression d'upload
    const progressInterval = setInterval(() => {
      this.uploadProgress += Math.random() * 15;
      if (this.uploadProgress >= 90) {
        clearInterval(progressInterval);
      }
      this.cdr.detectChanges();
    }, 300);

    this.MessageService.sendMessage(
      receiverId,
      '',
      file,
      messageType,
      this.conversation.id
    ).subscribe({
      next: (message: any) => {
        console.log('📁 [Upload] ✅ File sent successfully:', message);
        console.log('📁 [Debug] Sent message structure:', {
          id: message.id,
          type: message.type,
          attachments: message.attachments,
          hasImage: this.hasImage(message),
          hasFile: this.hasFile(message),
          imageUrl: this.getImageUrl(message),
        });

        clearInterval(progressInterval);
        this.uploadProgress = 100;

        setTimeout(() => {
          this.messages.push(message);
          this.scrollToBottom();
          this.toastService.showSuccess('Fichier envoyé avec succès');
          this.resetUploadState();
        }, 500);
      },
      error: (error: any) => {
        console.error('📁 [Upload] ❌ Error sending file:', error);
        clearInterval(progressInterval);
        this.toastService.showError("Erreur lors de l'envoi du fichier");
        this.resetUploadState();
      },
    });
  }

  private getFileMessageType(file: File): any {
    if (file.type.startsWith('image/')) return 'IMAGE' as any;
    if (file.type.startsWith('video/')) return 'VIDEO' as any;
    if (file.type.startsWith('audio/')) return 'AUDIO' as any;
    return 'FILE' as any;
  }

  getFileAcceptTypes(): string {
    return '*/*';
  }

  resetUploadState(): void {
    this.isSendingMessage = false;
    this.isUploading = false;
    this.uploadProgress = 0;
  }

  // === DRAG & DROP ===

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    // Vérifier si on quitte vraiment la zone (pas un enfant)
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const x = event.clientX;
    const y = event.clientY;

    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      this.isDragOver = false;
    }
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      console.log('📁 [Drag&Drop] Files dropped:', files.length);

      // Traiter chaque fichier
      Array.from(files).forEach((file) => {
        console.log(
          '📁 [Drag&Drop] Processing file:',
          file.name,
          file.type,
          file.size
        );
        this.uploadFile(file);
      });

      this.toastService.showSuccess(
        `${files.length} fichier(s) en cours d'envoi`
      );
    }
  }

  // === COMPRESSION D'IMAGES ===

  private compressImage(file: File, quality: number = 0.8): Promise<File> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        // Calculer les nouvelles dimensions (max 1920x1080)
        const maxWidth = 1920;
        const maxHeight = 1080;
        let { width, height } = img;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width *= ratio;
          height *= ratio;
        }

        canvas.width = width;
        canvas.height = height;

        // Dessiner l'image redimensionnée
        ctx?.drawImage(img, 0, 0, width, height);

        // Convertir en blob avec compression
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: file.type,
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              reject(new Error('Failed to compress image'));
            }
          },
          file.type,
          quality
        );
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  }

  // === MÉTHODES DE FORMATAGE SUPPLÉMENTAIRES ===

  private handleTypingIndicator(): void {
    if (!this.isTyping) {
      this.isTyping = true;
      // Envoyer l'indicateur de frappe à l'autre utilisateur
      this.sendTypingIndicator(true);
    }

    // Reset le timer
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }

    this.typingTimeout = setTimeout(() => {
      this.isTyping = false;
      // Arrêter l'indicateur de frappe
      this.sendTypingIndicator(false);
    }, 2000);
  }

  private sendTypingIndicator(isTyping: boolean): void {
    // Envoyer l'indicateur de frappe via WebSocket/GraphQL
    const receiverId = this.otherParticipant?.id || this.otherParticipant?._id;
    if (receiverId && this.conversation?.id) {
      console.log(
        `📝 Sending typing indicator: ${isTyping} to user ${receiverId}`
      );
      // TODO: Implémenter l'envoi via WebSocket/GraphQL subscription
      // this.MessageService.sendTypingIndicator(this.conversation.id, receiverId, isTyping);
    }
  }

  // === MÉTHODES POUR L'INTERFACE D'APPEL ===

  onCallAccepted(call: Call): void {
    console.log('🔄 Call accepted from interface:', call);
    this.activeCall = call;
    this.isInCall = true;
    this.isCallConnected = true;
    this.startCallTimer();
    this.toastService.showSuccess('Appel accepté');
  }

  onCallRejected(): void {
    console.log('🔄 Call rejected from interface');
    this.endCall();
    this.toastService.showInfo('Appel rejeté');
  }

  // === MÉTHODES POUR LA LECTURE DES MESSAGES VOCAUX ===

  playVoiceMessage(message: any): void {
    console.log('🎵 [Voice] Playing voice message:', message.id);
    this.toggleVoicePlayback(message);
  }

  isVoicePlaying(messageId: string): boolean {
    return this.playingMessageId === messageId;
  }

  toggleVoicePlayback(message: any): void {
    const messageId = message.id;
    const audioUrl = this.getVoiceUrl(message);

    if (!audioUrl) {
      console.error('🎵 [Voice] No audio URL found for message:', messageId);
      this.toastService.showError('Fichier audio introuvable');
      return;
    }

    // Si c'est déjà en cours de lecture, arrêter
    if (this.isVoicePlaying(messageId)) {
      this.stopVoicePlayback();
      return;
    }

    // Arrêter toute autre lecture en cours
    this.stopVoicePlayback();

    // Démarrer la nouvelle lecture
    this.startVoicePlayback(message, audioUrl);
  }

  private startVoicePlayback(message: any, audioUrl: string): void {
    const messageId = message.id;

    try {
      console.log(
        '🎵 [Voice] Starting playback for:',
        messageId,
        'URL:',
        audioUrl
      );

      this.currentAudio = new Audio(audioUrl);
      this.playingMessageId = messageId;

      // Initialiser les valeurs par défaut avec la nouvelle structure
      const currentData = this.getVoicePlaybackData(messageId);
      this.setVoicePlaybackData(messageId, {
        progress: 0,
        currentTime: 0,
        speed: currentData.speed || 1,
        duration: currentData.duration || 0,
      });

      // Configurer la vitesse de lecture
      this.currentAudio.playbackRate = currentData.speed || 1;

      // Événements audio
      this.currentAudio.addEventListener('loadedmetadata', () => {
        if (this.currentAudio) {
          this.setVoicePlaybackData(messageId, {
            duration: this.currentAudio.duration,
          });
          console.log(
            '🎵 [Voice] Audio loaded, duration:',
            this.currentAudio.duration
          );
        }
      });

      this.currentAudio.addEventListener('timeupdate', () => {
        if (this.currentAudio && this.playingMessageId === messageId) {
          const currentTime = this.currentAudio.currentTime;
          const progress = (currentTime / this.currentAudio.duration) * 100;
          this.setVoicePlaybackData(messageId, { currentTime, progress });
          this.cdr.detectChanges();
        }
      });

      this.currentAudio.addEventListener('ended', () => {
        console.log('🎵 [Voice] Playback ended for:', messageId);
        this.stopVoicePlayback();
      });

      this.currentAudio.addEventListener('error', (error) => {
        console.error('🎵 [Voice] Audio error:', error);
        this.toastService.showError('Erreur lors de la lecture audio');
        this.stopVoicePlayback();
      });

      // Démarrer la lecture
      this.currentAudio
        .play()
        .then(() => {
          console.log('🎵 [Voice] Playback started successfully');
          this.toastService.showSuccess('🎵 Lecture du message vocal');
        })
        .catch((error) => {
          console.error('🎵 [Voice] Error starting playback:', error);
          this.toastService.showError('Impossible de lire le message vocal');
          this.stopVoicePlayback();
        });
    } catch (error) {
      console.error('🎵 [Voice] Error creating audio:', error);
      this.toastService.showError('Erreur lors de la lecture audio');
      this.stopVoicePlayback();
    }
  }

  private stopVoicePlayback(): void {
    if (this.currentAudio) {
      console.log('🎵 [Voice] Stopping playback for:', this.playingMessageId);
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    this.playingMessageId = null;
    this.cdr.detectChanges();
  }

  getVoiceUrl(message: any): string {
    // Vérifier les propriétés directes d'audio
    if (message.voiceUrl) return message.voiceUrl;
    if (message.audioUrl) return message.audioUrl;
    if (message.voice) return message.voice;

    // Vérifier les attachments audio
    const audioAttachment = message.attachments?.find(
      (att: any) => att.type?.startsWith('audio/') || att.type === 'AUDIO'
    );

    if (audioAttachment) {
      return audioAttachment.url || audioAttachment.path || '';
    }

    return '';
  }

  getVoiceWaves(message: any): number[] {
    // Générer des waves basées sur l'ID du message pour la cohérence
    const messageId = message.id || '';
    const seed = messageId
      .split('')
      .reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
    const waves: number[] = [];

    for (let i = 0; i < 16; i++) {
      const height = 4 + ((seed + i * 7) % 20);
      waves.push(height);
    }

    return waves;
  }

  getVoiceProgress(message: any): number {
    const data = this.getVoicePlaybackData(message.id);
    const totalWaves = 16;
    return Math.floor((data.progress / 100) * totalWaves);
  }

  getVoiceCurrentTime(message: any): string {
    const data = this.getVoicePlaybackData(message.id);
    return this.formatAudioTime(data.currentTime);
  }

  getVoiceDuration(message: any): string {
    const data = this.getVoicePlaybackData(message.id);
    const duration = data.duration || message.metadata?.duration || 0;

    if (typeof duration === 'string') {
      return duration; // Déjà formaté
    }

    return this.formatAudioTime(duration);
  }

  private formatAudioTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  seekVoiceMessage(message: any, waveIndex: number): void {
    const messageId = message.id;

    if (!this.currentAudio || this.playingMessageId !== messageId) {
      return;
    }

    const totalWaves = 16;
    const seekPercentage = (waveIndex / totalWaves) * 100;
    const seekTime = (seekPercentage / 100) * this.currentAudio.duration;

    this.currentAudio.currentTime = seekTime;
    console.log('🎵 [Voice] Seeking to:', seekTime, 'seconds');
  }

  toggleVoiceSpeed(message: any): void {
    const messageId = message.id;
    const data = this.getVoicePlaybackData(messageId);

    // Cycle entre 1x, 1.5x, 2x
    const newSpeed = data.speed === 1 ? 1.5 : data.speed === 1.5 ? 2 : 1;

    this.setVoicePlaybackData(messageId, { speed: newSpeed });

    if (this.currentAudio && this.playingMessageId === messageId) {
      this.currentAudio.playbackRate = newSpeed;
    }

    this.toastService.showSuccess(`Vitesse: ${newSpeed}x`);
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();

    // Nettoyer les timers
    if (this.callTimer) {
      clearInterval(this.callTimer);
    }
    if (this.recordingTimer) {
      clearInterval(this.recordingTimer);
    }
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }

    // Nettoyer les ressources audio
    if (this.mediaRecorder) {
      if (this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.stop();
      }
      this.mediaRecorder.stream?.getTracks().forEach((track) => track.stop());
    }

    // Nettoyer la lecture audio
    this.stopVoicePlayback();
  }
}
