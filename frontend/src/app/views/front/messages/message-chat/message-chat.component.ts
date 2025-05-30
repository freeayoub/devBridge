import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  ChangeDetectorRef,
} from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
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

  // === ENREGISTREMENT VOCAL ===
  isRecordingVoice = false;
  voiceRecordingDuration = 0;
  voiceRecordingState: 'idle' | 'recording' | 'processing' = 'idle';
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private recordingTimer: any = null;

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

  // === MÉTHODES POUR LE TEMPLATE ===
  formatLastActive(lastActive: string | Date | null): string {
    if (!lastActive) return 'Hors ligne';

    const date = new Date(lastActive);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "À l'instant";
    if (diffMins < 60) return `Il y a ${diffMins} min`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `Il y a ${diffHours}h`;

    const diffDays = Math.floor(diffHours / 24);
    return `Il y a ${diffDays}j`;
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
    if (message.attachments && message.attachments.length > 0) {
      const attachment = message.attachments[0];
      if (attachment.type?.startsWith('image/')) return 'image';
      if (attachment.type?.startsWith('video/')) return 'video';
      if (attachment.type?.startsWith('audio/')) return 'audio';
      return 'file';
    }
    return 'text';
  }

  hasImage(message: any): boolean {
    return (
      message.attachments?.some((att: any) => att.type?.startsWith('image/')) ||
      false
    );
  }

  hasFile(message: any): boolean {
    return (
      message.attachments?.some(
        (att: any) => !att.type?.startsWith('image/')
      ) || false
    );
  }

  getImageUrl(message: any): string {
    const imageAttachment = message.attachments?.find((att: any) =>
      att.type?.startsWith('image/')
    );
    return imageAttachment?.url || '';
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

  onMessageContextMenu(message: any, event: any): void {
    event.preventDefault();
    console.log('Message context menu:', message);
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

  openImageViewer(message: any): void {
    const imageAttachment = message.attachments?.find((att: any) =>
      att.type?.startsWith('image/')
    );
    if (imageAttachment?.url) {
      window.open(imageAttachment.url, '_blank');
    }
  }

  downloadFile(message: any): void {
    const fileAttachment = message.attachments?.find(
      (att: any) => !att.type?.startsWith('image/')
    );
    if (fileAttachment?.url) {
      window.open(fileAttachment.url, '_blank');
    }
  }

  toggleReaction(messageId: string, emoji: string): void {
    console.log('Toggle reaction:', messageId, emoji);
  }

  hasUserReacted(reaction: any, userId: string): boolean {
    return reaction.users?.includes(userId) || false;
  }

  toggleSearch(): void {
    this.searchMode = !this.searchMode;
    if (!this.searchMode) {
      this.searchQuery = '';
      this.searchResults = [];
    }
  }

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

  toggleMainMenu(): void {
    console.log('Toggle main menu');
  }

  // === MÉTHODES DE TEST ===
  testAddMessage(): void {
    // Méthode de test pour ajouter un message simulé
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

    console.log('🧪 Adding test message:', testMessage);
    this.messages.push(testMessage);
    this.cdr.detectChanges();
    setTimeout(() => {
      this.scrollToBottom();
    }, 50);
  }

  toggleAttachmentMenu(): void {
    this.showAttachmentMenu = !this.showAttachmentMenu;
    this.showEmojiPicker = false;
  }

  toggleEmojiPicker(): void {
    this.showEmojiPicker = !this.showEmojiPicker;
    this.showAttachmentMenu = false;
  }

  triggerFileInput(type?: string): void {
    // Utiliser l'input caché existant dans le template
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

  openCamera(): void {
    console.log('Opening camera...');
    this.showAttachmentMenu = false;
  }

  // === MÉTHODES POUR LES ÉMOJIS ===
  getEmojisForCategory(category: any): any[] {
    return category?.emojis || [];
  }

  selectEmojiCategory(category: any): void {
    this.selectedEmojiCategory = category;
  }

  insertEmoji(emoji: any): void {
    const currentContent = this.messageForm.get('content')?.value || '';
    const newContent = currentContent + (emoji.emoji || emoji);
    this.messageForm.patchValue({ content: newContent });

    this.showEmojiPicker = false;

    setTimeout(() => {
      const textarea = document.querySelector(
        'textarea[formControlName="content"]'
      ) as HTMLTextAreaElement;
      if (textarea) {
        textarea.focus();
      }
    }, 100);
  }

  // === MÉTHODES MANQUANTES ===
  goBackToConversations(): void {
    window.history.back();
  }

  // === MÉTHODES D'APPEL WEBRTC ===
  startVideoCall(): void {
    this.initiateCall(CallType.VIDEO);
  }

  startVoiceCall(): void {
    this.initiateCall(CallType.AUDIO);
  }

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

  endCall(): void {
    console.log('🔄 Ending call');

    if (this.activeCall) {
      this.MessageService.endCall(this.activeCall.id).subscribe({
        next: () => {
          console.log('✅ Call ended successfully');
          this.resetCallState();
          this.toastService.showSuccess('Appel terminé');
        },
        error: (error) => {
          console.error('❌ Error ending call:', error);
          this.resetCallState();
          this.toastService.showError("Erreur lors de la fin de l'appel");
        },
      });
    } else {
      this.resetCallState();
    }
  }

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

  trackByMessageId(index: number, message: any): any {
    return message.id || index;
  }

  isGroupConversation(): boolean {
    return this.conversation?.participants?.length > 2 || false;
  }

  async startVoiceRecording(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      this.audioChunks = [];
      this.isRecordingVoice = true;
      this.voiceRecordingDuration = 0;
      this.voiceRecordingState = 'recording';

      this.recordingTimer = setInterval(() => {
        this.voiceRecordingDuration++;
        this.cdr.detectChanges();
      }, 1000);

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        this.processRecordedAudio();
      };

      this.mediaRecorder.start(100);
      this.toastService.showSuccess('Enregistrement vocal démarré');
    } catch (error) {
      console.error("Erreur lors du démarrage de l'enregistrement:", error);
      this.toastService.showError("Impossible d'accéder au microphone");
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
    try {
      if (this.audioChunks.length === 0) {
        this.toastService.showError('Aucun audio enregistré');
        this.cancelVoiceRecording();
        return;
      }

      const audioBlob = new Blob(this.audioChunks, {
        type: 'audio/webm;codecs=opus',
      });

      if (this.voiceRecordingDuration < 1) {
        this.toastService.showError(
          'Enregistrement trop court (minimum 1 seconde)'
        );
        this.cancelVoiceRecording();
        return;
      }

      const audioFile = new File([audioBlob], `voice_${Date.now()}.webm`, {
        type: 'audio/webm;codecs=opus',
      });

      await this.sendVoiceMessage(audioFile);
      this.toastService.showSuccess('Message vocal envoyé');
    } catch (error) {
      console.error("Erreur lors du traitement de l'audio:", error);
      this.toastService.showError("Erreur lors de l'envoi du message vocal");
    } finally {
      this.voiceRecordingState = 'idle';
      this.voiceRecordingDuration = 0;
      this.audioChunks = [];
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

    const messageType = this.getFileMessageType(file);
    console.log(`📁 [Upload] Message type determined: ${messageType}`);
    console.log(`📁 [Upload] Conversation ID: ${this.conversation.id}`);

    this.isSendingMessage = true;
    console.log('📁 [Upload] Calling MessageService.sendMessage...');

    this.MessageService.sendMessage(
      receiverId,
      '',
      file,
      messageType,
      this.conversation.id
    ).subscribe({
      next: (message: any) => {
        console.log('📁 [Upload] ✅ File sent successfully:', message);
        this.messages.push(message);
        this.scrollToBottom();
        this.toastService.showSuccess('Fichier envoyé avec succès');
        this.isSendingMessage = false;
      },
      error: (error: any) => {
        console.error('📁 [Upload] ❌ Error sending file:', error);
        this.toastService.showError("Erreur lors de l'envoi du fichier");
        this.isSendingMessage = false;
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

  closeAllMenus(): void {
    this.showEmojiPicker = false;
    this.showAttachmentMenu = false;
    this.showSearch = false;
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
  }
}
