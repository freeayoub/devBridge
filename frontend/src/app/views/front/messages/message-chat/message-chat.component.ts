import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  AfterViewChecked,
  ChangeDetectorRef,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthuserService } from 'src/app/services/authuser.service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subscription, combineLatest } from 'rxjs';
import { User } from '@app/models/user.model';
import { UserStatusService } from 'src/app/services/user-status.service';
import {
  Message,
  Conversation,
  Attachment,
  MessageType,
} from 'src/app/models/message.model';
import { ToastService } from 'src/app/services/toast.service';
import { switchMap, distinctUntilChanged, filter } from 'rxjs/operators';
import { MessageService } from '@app/services/message.service';
import { LoggerService } from 'src/app/services/logger.service';
@Component({
  selector: 'app-message-chat',
  templateUrl: 'message-chat.component.html',
  styleUrls: ['./message-chat.component.css'],
})
export class MessageChatComponent
  implements OnInit, OnDestroy, AfterViewChecked
{
  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;
  @ViewChild('fileInput', { static: false })
  fileInput!: ElementRef<HTMLInputElement>;

  messages: Message[] = [];
  messageForm: FormGroup;
  conversation: Conversation | null = null;
  loading = true;
  error: any;
  currentUserId: string | null = null;
  currentUsername: string = 'You';
  otherParticipant: User | null = null;
  selectedFile: File | null = null;
  previewUrl: string | ArrayBuffer | null = null;
  isUploading = false;
  isTyping = false;
  typingTimeout: any;
  isRecordingVoice = false;
  voiceRecordingDuration = 0;

  private readonly MAX_MESSAGES_PER_SIDE = 5; // Nombre maximum de messages à afficher par côté (expéditeur/destinataire)
  private readonly MAX_MESSAGES_TO_LOAD = 10; // Nombre maximum de messages à charger à la fois (pagination)
  private readonly MAX_TOTAL_MESSAGES = 100; // Limite totale de messages à conserver en mémoire
  private currentPage = 1; // Page actuelle pour la pagination
  isLoadingMore = false; // Indicateur de chargement en cours (public pour le template)
  hasMoreMessages = true; // Indique s'il y a plus de messages à charger (public pour le template)
  private subscriptions: Subscription = new Subscription();

  constructor(
    private MessageService: MessageService,
    public route: ActivatedRoute,
    private authService: AuthuserService,
    private fb: FormBuilder,
    public statusService: UserStatusService,
    public router: Router,
    private toastService: ToastService,
    private logger: LoggerService,
    private cdr: ChangeDetectorRef
  ) {
    this.messageForm = this.fb.group({
      content: ['', [Validators.maxLength(1000)]],
    });
  }
  ngOnInit(): void {
    this.currentUserId = this.authService.getCurrentUserId();

    // Récupérer les messages vocaux pour assurer leur persistance
    this.loadVoiceMessages();

    const routeSub = this.route.params
      .pipe(
        filter((params) => params['id']),
        distinctUntilChanged(),
        switchMap((params) => {
          this.loading = true;
          this.messages = [];
          this.currentPage = 1; // Réinitialiser à la page 1
          this.hasMoreMessages = true; // Réinitialiser l'indicateur de messages supplémentaires

          this.logger.debug(
            'MessageChat',
            `Loading conversation with pagination: page=${this.currentPage}, limit=${this.MAX_MESSAGES_TO_LOAD}`
          );

          // Charger la conversation avec pagination (page 1, limit 10)
          return this.MessageService.getConversation(
            params['id'],
            this.MAX_MESSAGES_TO_LOAD,
            this.currentPage // Utiliser la page au lieu de l'offset
          );
        })
      )
      .subscribe({
        next: (conversation) => {
          this.handleConversationLoaded(conversation);
        },
        error: (error) => {
          this.handleError('Failed to load conversation', error);
        },
      });
    this.subscriptions.add(routeSub);
  }

  /**
   * Charge les messages vocaux pour assurer leur persistance
   */
  private loadVoiceMessages(): void {
    this.logger.debug('MessageChat', 'Loading voice messages for persistence');

    const sub = this.MessageService.getVoiceMessages().subscribe({
      next: (voiceMessages) => {
        this.logger.info(
          'MessageChat',
          `Retrieved ${voiceMessages.length} voice messages`
        );

        // Les messages vocaux sont maintenant chargés et disponibles dans le service
        // Ils seront automatiquement associés aux conversations correspondantes
        if (voiceMessages.length > 0) {
          this.logger.debug(
            'MessageChat',
            'Voice messages loaded successfully'
          );

          // Forcer le rafraîchissement de la vue après le chargement des messages vocaux
          setTimeout(() => {
            this.cdr.detectChanges();
            this.logger.debug(
              'MessageChat',
              'View refreshed after loading voice messages'
            );
          }, 100);
        }
      },
      error: (error) => {
        this.logger.error(
          'MessageChat',
          'Error loading voice messages:',
          error
        );
        // Ne pas bloquer l'expérience utilisateur si le chargement des messages vocaux échoue
      },
    });

    this.subscriptions.add(sub);
  }

  /**
   * Gère les erreurs et les affiche à l'utilisateur
   * @param message Message d'erreur à afficher
   * @param error Objet d'erreur
   */
  private handleError(message: string, error: any): void {
    this.logger.error('MessageChat', message, error);
    this.loading = false;
    this.error = error;
    this.toastService.showError(message);
  }

  // logique FileService
  getFileIcon(mimeType?: string): string {
    if (!mimeType) return 'fa-file';
    if (mimeType.startsWith('image/')) return 'fa-image';
    if (mimeType.includes('pdf')) return 'fa-file-pdf';
    if (mimeType.includes('word') || mimeType.includes('msword'))
      return 'fa-file-word';
    if (mimeType.includes('excel')) return 'fa-file-excel';
    if (mimeType.includes('powerpoint')) return 'fa-file-powerpoint';
    if (mimeType.includes('audio')) return 'fa-file-audio';
    if (mimeType.includes('video')) return 'fa-file-video';
    if (mimeType.includes('zip') || mimeType.includes('compressed'))
      return 'fa-file-archive';
    return 'fa-file';
  }
  getFileType(mimeType?: string): string {
    if (!mimeType) return 'File';

    const typeMap: Record<string, string> = {
      'image/': 'Image',
      'application/pdf': 'PDF',
      'application/msword': 'Word Doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        'Word Doc',
      'application/vnd.ms-excel': 'Excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        'Excel',
      'application/vnd.ms-powerpoint': 'PowerPoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation':
        'PowerPoint',
      'audio/': 'Audio',
      'video/': 'Video',
      'application/zip': 'ZIP Archive',
      'application/x-rar-compressed': 'RAR Archive',
    };
    for (const [key, value] of Object.entries(typeMap)) {
      if (mimeType.includes(key)) return value;
    }
    return 'File';
  }

  private handleConversationLoaded(conversation: Conversation): void {
    this.logger.info(
      'MessageChat',
      `Handling loaded conversation: ${conversation.id}`
    );
    this.logger.debug(
      'MessageChat',
      `Conversation has ${conversation?.messages?.length || 0} messages and ${
        conversation?.participants?.length || 0
      } participants`
    );

    // Log détaillé des messages pour le débogage
    if (conversation?.messages && conversation.messages.length > 0) {
      this.logger.debug(
        'MessageChat',
        `First message details: id=${
          conversation.messages[0].id
        }, content=${conversation.messages[0].content?.substring(
          0,
          20
        )}, sender=${conversation.messages[0].sender?.username}`
      );
    }

    this.conversation = conversation;

    // Si la conversation n'a pas de messages, initialiser un tableau vide
    if (!conversation?.messages || conversation.messages.length === 0) {
      this.logger.debug('MessageChat', 'No messages found in conversation');

      // Récupérer les participants
      this.otherParticipant =
        conversation?.participants?.find(
          (p) => p.id !== this.currentUserId && p._id !== this.currentUserId
        ) || null;

      // Initialiser un tableau vide pour les messages
      this.messages = [];

      this.logger.debug('MessageChat', 'Initialized empty messages array');
    } else {
      // Récupérer les messages de la conversation
      const conversationMessages = [...(conversation?.messages || [])];

      // Trier les messages par date (du plus ancien au plus récent)
      conversationMessages.sort((a, b) => {
        const timeA =
          a.timestamp instanceof Date
            ? a.timestamp.getTime()
            : new Date(a.timestamp as string).getTime();
        const timeB =
          b.timestamp instanceof Date
            ? b.timestamp.getTime()
            : new Date(b.timestamp as string).getTime();
        return timeA - timeB;
      });

      // Log détaillé pour comprendre la structure des messages
      if (conversationMessages.length > 0) {
        const firstMessage = conversationMessages[0];
        this.logger.debug(
          'MessageChat',
          `Message structure: sender.id=${firstMessage.sender?.id}, sender._id=${firstMessage.sender?._id}, senderId=${firstMessage.senderId}, receiver.id=${firstMessage.receiver?.id}, receiver._id=${firstMessage.receiver?._id}, receiverId=${firstMessage.receiverId}`
        );
      }

      // Utiliser directement tous les messages triés sans filtrage supplémentaire
      this.messages = conversationMessages;

      this.logger.debug(
        'MessageChat',
        `Using all ${this.messages.length} messages from conversation`
      );

      this.logger.debug(
        'MessageChat',
        `Using ${conversationMessages.length} messages from conversation, showing last ${this.messages.length}`
      );
    }

    this.otherParticipant =
      conversation?.participants?.find(
        (p) => p.id !== this.currentUserId && p._id !== this.currentUserId
      ) || null;

    this.logger.debug(
      'MessageChat',
      `Other participant identified: ${
        this.otherParticipant?.username || 'Unknown'
      }`
    );

    this.loading = false;
    setTimeout(() => this.scrollToBottom(), 100);

    this.logger.debug('MessageChat', `Marking unread messages as read`);
    this.markMessagesAsRead();

    if (this.conversation?.id) {
      this.logger.debug(
        'MessageChat',
        `Setting up subscriptions for conversation: ${this.conversation.id}`
      );
      this.subscribeToConversationUpdates(this.conversation.id);
      this.subscribeToNewMessages(this.conversation.id);
      this.subscribeToTypingIndicators(this.conversation.id);
    }

    this.logger.info('MessageChat', `Conversation loaded successfully`);
  }

  private subscribeToConversationUpdates(conversationId: string): void {
    const sub = this.MessageService.subscribeToConversationUpdates(
      conversationId
    ).subscribe({
      next: (updatedConversation) => {
        this.conversation = updatedConversation;
        this.messages = updatedConversation.messages
          ? [...updatedConversation.messages]
          : [];
        this.scrollToBottom();
      },
      error: (error) => {
        this.toastService.showError('Connection to conversation updates lost');
      },
    });
    this.subscriptions.add(sub);
  }

  private subscribeToNewMessages(conversationId: string): void {
    const sub = this.MessageService.subscribeToNewMessages(
      conversationId
    ).subscribe({
      next: (newMessage) => {
        if (newMessage?.conversationId === this.conversation?.id) {
          // Ajouter le nouveau message à la liste complète
          this.messages = [...this.messages, newMessage].sort((a, b) => {
            const timeA =
              a.timestamp instanceof Date
                ? a.timestamp.getTime()
                : new Date(a.timestamp as string).getTime();
            const timeB =
              b.timestamp instanceof Date
                ? b.timestamp.getTime()
                : new Date(b.timestamp as string).getTime();
            return timeA - timeB; // Tri par ordre croissant pour l'affichage
          });

          this.logger.debug(
            'MessageChat',
            `Added new message, now showing ${this.messages.length} messages`
          );

          setTimeout(() => this.scrollToBottom(), 100);

          // Marquer le message comme lu s'il vient d'un autre utilisateur
          if (
            newMessage.sender?.id !== this.currentUserId &&
            newMessage.sender?._id !== this.currentUserId
          ) {
            if (newMessage.id) {
              this.MessageService.markMessageAsRead(newMessage.id).subscribe();
            }
          }
        }
      },
      error: (error) => {
        this.toastService.showError('Connection to new messages lost');
      },
    });
    this.subscriptions.add(sub);
  }

  private subscribeToTypingIndicators(conversationId: string): void {
    const sub = this.MessageService.subscribeToTypingIndicator(
      conversationId
    ).subscribe({
      next: (event) => {
        if (event.userId !== this.currentUserId) {
          this.isTyping = event.isTyping;
          if (this.isTyping) {
            clearTimeout(this.typingTimeout);
            this.typingTimeout = setTimeout(() => {
              this.isTyping = false;
            }, 2000);
          }
        }
      },
    });
    this.subscriptions.add(sub);
  }

  private markMessagesAsRead(): void {
    const unreadMessages = this.messages.filter(
      (msg) =>
        !msg.isRead &&
        (msg.receiver?.id === this.currentUserId ||
          msg.receiver?._id === this.currentUserId)
    );

    unreadMessages.forEach((msg) => {
      if (msg.id) {
        const sub = this.MessageService.markMessageAsRead(msg.id).subscribe({
          error: (error) => {
            this.logger.error(
              'MessageChat',
              'Error marking message as read:',
              error
            );
          },
        });
        this.subscriptions.add(sub);
      }
    });
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file size (e.g., 5MB max)
    if (file.size > 5 * 1024 * 1024) {
      this.toastService.showError('File size should be less than 5MB');
      return;
    }

    // Validate file type
    const validTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (!validTypes.includes(file.type)) {
      this.toastService.showError(
        'Invalid file type. Only images, PDFs and Word docs are allowed'
      );
      return;
    }

    this.selectedFile = file;
    const reader = new FileReader();
    reader.onload = () => {
      this.previewUrl = reader.result;
    };
    reader.readAsDataURL(file);
  }

  removeAttachment(): void {
    this.selectedFile = null;
    this.previewUrl = null;
    if (this.fileInput?.nativeElement) {
      this.fileInput.nativeElement.value = '';
    }
  }

  onTyping(): void {
    // if (this.conversation?.id && this.currentUserId) {
    //   this.graphqlService
    //     .startTyping({
    //       userId: this.currentUserId,
    //       conversationId: this.conversation.id,
    //     })
    //     .subscribe();
    // }
  }

  sendMessage(): void {
    this.logger.info('MessageChat', `Attempting to send message`);

    // Vérifier l'authentification
    const token = localStorage.getItem('token');
    this.logger.debug(
      'MessageChat',
      `Authentication check: token=${!!token}, userId=${this.currentUserId}`
    );

    if (
      (this.messageForm.invalid && !this.selectedFile) ||
      !this.currentUserId ||
      !this.otherParticipant?.id
    ) {
      this.logger.warn(
        'MessageChat',
        `Cannot send message: form invalid or missing user IDs`
      );
      return;
    }

    const content = this.messageForm.get('content')?.value;

    // Créer un message temporaire pour l'affichage immédiat (comme dans Facebook Messenger)
    const tempMessage: Message = {
      id: 'temp-' + new Date().getTime(),
      content: content || '',
      sender: {
        id: this.currentUserId || '',
        username: this.currentUsername,
      },
      receiver: {
        id: this.otherParticipant.id,
        username: this.otherParticipant.username || 'Recipient',
      },
      timestamp: new Date(),
      isRead: false,
      isPending: true, // Marquer comme en attente
    };

    // Si un fichier est sélectionné, ajouter l'aperçu au message temporaire
    if (this.selectedFile) {
      // Déterminer le type de fichier
      let fileType = 'file';
      if (this.selectedFile.type.startsWith('image/')) {
        fileType = 'image';

        // Pour les images, ajouter un aperçu immédiat
        if (this.previewUrl) {
          tempMessage.attachments = [
            {
              id: 'temp-attachment',
              url: this.previewUrl ? this.previewUrl.toString() : '',
              type: MessageType.IMAGE,
              name: this.selectedFile.name,
              size: this.selectedFile.size,
            },
          ];
        }
      }

      // Définir le type de message en fonction du type de fichier
      if (fileType === 'image') {
        tempMessage.type = MessageType.IMAGE;
      } else if (fileType === 'file') {
        tempMessage.type = MessageType.FILE;
      }
    }

    // Ajouter immédiatement le message temporaire à la liste
    this.messages = [...this.messages, tempMessage];

    // Réinitialiser le formulaire immédiatement pour une meilleure expérience utilisateur
    const fileToSend = this.selectedFile; // Sauvegarder une référence
    this.messageForm.reset();
    this.removeAttachment();

    // Forcer le défilement vers le bas immédiatement
    setTimeout(() => this.scrollToBottom(true), 50);

    // Maintenant, envoyer le message au serveur
    this.isUploading = true;

    const sendSub = this.MessageService.sendMessage(
      this.otherParticipant.id,
      content,
      fileToSend || undefined,
      MessageType.TEXT
    ).subscribe({
      next: (message) => {
        this.logger.info(
          'MessageChat',
          `Message sent successfully: ${message?.id || 'unknown'}`
        );

        // Remplacer le message temporaire par le message réel
        this.messages = this.messages.map((msg) =>
          msg.id === tempMessage.id ? message : msg
        );

        this.isUploading = false;
      },
      error: (error) => {
        this.logger.error('MessageChat', `Error sending message:`, error);

        // Marquer le message temporaire comme échoué
        this.messages = this.messages.map((msg) => {
          if (msg.id === tempMessage.id) {
            return {
              ...msg,
              isPending: false,
              isError: true,
            };
          }
          return msg;
        });

        this.isUploading = false;
        this.toastService.showError('Failed to send message');
      },
    });

    this.subscriptions.add(sendSub);
  }

  formatMessageTime(timestamp: string | Date | undefined): string {
    if (!timestamp) {
      return 'Unknown time';
    }
    try {
      const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
      // Format heure:minute sans les secondes, comme dans l'image de référence
      return date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
    } catch (error) {
      this.logger.error('MessageChat', 'Error formatting message time:', error);
      return 'Invalid time';
    }
  }

  formatLastActive(lastActive: string | Date | undefined): string {
    if (!lastActive) return 'Offline';
    const lastActiveDate =
      lastActive instanceof Date ? lastActive : new Date(lastActive);
    const now = new Date();
    const diffHours =
      Math.abs(now.getTime() - lastActiveDate.getTime()) / (1000 * 60 * 60);

    if (diffHours < 24) {
      return `Active ${lastActiveDate.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })}`;
    }
    return `Active ${lastActiveDate.toLocaleDateString()}`;
  }

  formatMessageDate(timestamp: string | Date | undefined): string {
    if (!timestamp) {
      return 'Unknown date';
    }

    try {
      const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
      const today = new Date();

      // Format pour l'affichage comme dans l'image de référence
      const options: Intl.DateTimeFormatOptions = {
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
      };

      if (date.toDateString() === today.toDateString()) {
        return date.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });
      }

      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      if (date.toDateString() === yesterday.toDateString()) {
        return `LUN., ${date.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })}`;
      }

      // Format pour les autres jours (comme dans l'image)
      const day = date
        .toLocaleDateString('fr-FR', { weekday: 'short' })
        .toUpperCase();
      return `${day}., ${date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })}`;
    } catch (error) {
      this.logger.error('MessageChat', 'Error formatting message date:', error);
      return 'Invalid date';
    }
  }

  shouldShowDateHeader(index: number): boolean {
    if (index === 0) return true;

    try {
      const currentMsg = this.messages[index];
      const prevMsg = this.messages[index - 1];

      if (!currentMsg?.timestamp || !prevMsg?.timestamp) {
        return true;
      }

      const currentDate = this.getDateFromTimestamp(currentMsg.timestamp);
      const prevDate = this.getDateFromTimestamp(prevMsg.timestamp);

      return currentDate !== prevDate;
    } catch (error) {
      this.logger.error('MessageChat', 'Error checking date header:', error);
      return false;
    }
  }

  private getDateFromTimestamp(timestamp: string | Date | undefined): string {
    if (!timestamp) {
      return 'unknown-date';
    }

    try {
      return (
        timestamp instanceof Date ? timestamp : new Date(timestamp)
      ).toDateString();
    } catch (error) {
      this.logger.error(
        'MessageChat',
        'Error getting date from timestamp:',
        error
      );
      return 'invalid-date';
    }
  }
  getMessageType(message: Message | null | undefined): MessageType {
    if (!message) {
      return MessageType.TEXT;
    }

    try {
      // Vérifier d'abord le type de message explicite
      if (message.type) {
        // Convertir les types en minuscules en leurs équivalents en majuscules
        const msgType = message.type.toString();
        if (msgType === 'text' || msgType === 'TEXT') {
          return MessageType.TEXT;
        } else if (msgType === 'image' || msgType === 'IMAGE') {
          return MessageType.IMAGE;
        } else if (msgType === 'file' || msgType === 'FILE') {
          return MessageType.FILE;
        } else if (msgType === 'audio' || msgType === 'AUDIO') {
          return MessageType.AUDIO;
        } else if (msgType === 'video' || msgType === 'VIDEO') {
          return MessageType.VIDEO;
        } else if (msgType === 'system' || msgType === 'SYSTEM') {
          return MessageType.SYSTEM;
        }
      }

      // Ensuite, vérifier les pièces jointes
      if (message.attachments?.length) {
        const attachment = message.attachments[0];
        if (attachment && attachment.type) {
          const attachmentTypeStr = attachment.type.toString();

          // Gérer les différentes formes de types d'attachements
          if (attachmentTypeStr === 'image' || attachmentTypeStr === 'IMAGE') {
            return MessageType.IMAGE;
          } else if (
            attachmentTypeStr === 'file' ||
            attachmentTypeStr === 'FILE'
          ) {
            return MessageType.FILE;
          } else if (
            attachmentTypeStr === 'audio' ||
            attachmentTypeStr === 'AUDIO'
          ) {
            return MessageType.AUDIO;
          } else if (
            attachmentTypeStr === 'video' ||
            attachmentTypeStr === 'VIDEO'
          ) {
            return MessageType.VIDEO;
          }
        }

        // Type par défaut pour les pièces jointes
        return MessageType.FILE;
      }

      // Type par défaut
      return MessageType.TEXT;
    } catch (error) {
      this.logger.error('MessageChat', 'Error getting message type:', error);
      return MessageType.TEXT;
    }
  }

  // Méthode auxiliaire pour vérifier si un message contient une image
  hasImage(message: Message | null | undefined): boolean {
    if (!message || !message.attachments || message.attachments.length === 0) {
      return false;
    }

    const attachment = message.attachments[0];
    if (!attachment || !attachment.type) {
      return false;
    }

    const type = attachment.type.toString();
    return type === 'IMAGE' || type === 'image';
  }

  /**
   * Vérifie si le message est un message vocal
   */
  isVoiceMessage(message: Message | null | undefined): boolean {
    if (!message) {
      return false;
    }

    // Vérifier le type du message
    if (
      message.type === MessageType.VOICE_MESSAGE ||
      message.type === MessageType.VOICE_MESSAGE_LOWER
    ) {
      return true;
    }

    // Vérifier les pièces jointes
    if (message.attachments && message.attachments.length > 0) {
      return message.attachments.some((att) => {
        const type = att.type?.toString();
        return (
          type === 'VOICE_MESSAGE' ||
          type === 'voice_message' ||
          (message.metadata?.isVoiceMessage &&
            (type === 'AUDIO' || type === 'audio'))
        );
      });
    }

    // Vérifier les métadonnées
    return !!message.metadata?.isVoiceMessage;
  }

  /**
   * Récupère l'URL du message vocal
   */
  getVoiceMessageUrl(message: Message | null | undefined): string {
    if (!message || !message.attachments || message.attachments.length === 0) {
      return '';
    }

    // Chercher une pièce jointe de type message vocal ou audio
    const voiceAttachment = message.attachments.find((att) => {
      const type = att.type?.toString();
      return (
        type === 'VOICE_MESSAGE' ||
        type === 'voice_message' ||
        type === 'AUDIO' ||
        type === 'audio'
      );
    });

    return voiceAttachment?.url || '';
  }

  /**
   * Récupère la durée du message vocal
   */
  getVoiceMessageDuration(message: Message | null | undefined): number {
    if (!message) {
      return 0;
    }

    // Essayer d'abord de récupérer la durée depuis les métadonnées
    if (message.metadata?.duration) {
      return message.metadata.duration;
    }

    // Sinon, essayer de récupérer depuis les pièces jointes
    if (message.attachments && message.attachments.length > 0) {
      const voiceAttachment = message.attachments.find((att) => {
        const type = att.type?.toString();
        return (
          type === 'VOICE_MESSAGE' ||
          type === 'voice_message' ||
          type === 'AUDIO' ||
          type === 'audio'
        );
      });

      if (voiceAttachment && voiceAttachment.duration) {
        return voiceAttachment.duration;
      }
    }

    return 0;
  }

  // Méthode pour obtenir l'URL de l'image en toute sécurité
  getImageUrl(message: Message | null | undefined): string {
    if (!message || !message.attachments || message.attachments.length === 0) {
      return '';
    }

    const attachment = message.attachments[0];
    return attachment?.url || '';
  }

  getMessageTypeClass(message: Message | null | undefined): string {
    if (!message) {
      return 'bg-gray-100 rounded-lg px-4 py-2';
    }

    try {
      const isCurrentUser =
        message.sender?.id === this.currentUserId ||
        message.sender?._id === this.currentUserId ||
        message.senderId === this.currentUserId;

      // Utiliser une couleur plus foncée pour les messages de l'utilisateur actuel (à droite)
      // et une couleur plus claire pour les messages des autres utilisateurs (à gauche)
      // Couleurs et forme adaptées exactement à l'image de référence mobile
      const baseClass = isCurrentUser
        ? 'bg-blue-500 text-white rounded-2xl rounded-br-sm'
        : 'bg-gray-200 text-gray-800 rounded-2xl rounded-bl-sm';

      const messageType = this.getMessageType(message);

      // Vérifier si le message contient une image
      if (message.attachments && message.attachments.length > 0) {
        const attachment = message.attachments[0];
        if (attachment && attachment.type) {
          const attachmentTypeStr = attachment.type.toString();
          if (attachmentTypeStr === 'IMAGE' || attachmentTypeStr === 'image') {
            // Pour les images, on utilise un style sans bordure
            return `p-1 max-w-xs`;
          } else if (
            attachmentTypeStr === 'FILE' ||
            attachmentTypeStr === 'file'
          ) {
            return `${baseClass} p-3`;
          }
        }
      }

      // Vérifier le type de message
      if (
        messageType === MessageType.IMAGE ||
        messageType === MessageType.IMAGE_LOWER
      ) {
        // Pour les images, on utilise un style sans bordure
        return `p-1 max-w-xs`;
      } else if (
        messageType === MessageType.FILE ||
        messageType === MessageType.FILE_LOWER
      ) {
        return `${baseClass} p-3`;
      }

      // Type par défaut (texte)
      return `${baseClass} px-4 py-3 whitespace-normal break-words min-w-[120px]`;
    } catch (error) {
      this.logger.error(
        'MessageChat',
        'Error getting message type class:',
        error
      );
      return 'bg-gray-100 rounded-lg px-4 py-2 whitespace-normal break-words';
    }
  }

  // La méthode ngAfterViewChecked est implémentée plus bas dans le fichier

  // Méthode pour détecter le défilement vers le haut et charger plus de messages
  onScroll(event: any): void {
    const container = event.target;
    const scrollTop = container.scrollTop;

    // Si on est proche du haut de la liste et qu'on n'est pas déjà en train de charger
    if (
      scrollTop < 50 &&
      !this.isLoadingMore &&
      this.conversation?.id &&
      this.hasMoreMessages
    ) {
      // Afficher un indicateur de chargement en haut de la liste
      this.showLoadingIndicator();

      // Sauvegarder la hauteur actuelle et la position des messages
      const oldScrollHeight = container.scrollHeight;
      const firstVisibleMessage = this.getFirstVisibleMessage();

      // Marquer comme chargement en cours
      this.isLoadingMore = true;

      // Charger plus de messages avec un délai réduit
      this.loadMoreMessages();

      // Maintenir la position de défilement pour que l'utilisateur reste au même endroit
      // en utilisant le premier message visible comme ancre
      requestAnimationFrame(() => {
        const preserveScrollPosition = () => {
          if (firstVisibleMessage) {
            const messageElement = this.findMessageElement(
              firstVisibleMessage.id
            );
            if (messageElement) {
              // Faire défiler jusqu'à l'élément qui était visible avant
              messageElement.scrollIntoView({ block: 'center' });
            } else {
              // Fallback: utiliser la différence de hauteur
              const newScrollHeight = container.scrollHeight;
              const scrollDiff = newScrollHeight - oldScrollHeight;
              container.scrollTop = scrollTop + scrollDiff;
            }
          }

          // Masquer l'indicateur de chargement
          this.hideLoadingIndicator();
        };

        // Attendre que le DOM soit mis à jour
        setTimeout(preserveScrollPosition, 100);
      });
    }
  }

  // Méthode pour trouver le premier message visible dans la vue
  private getFirstVisibleMessage(): Message | null {
    if (!this.messagesContainer?.nativeElement || !this.messages.length)
      return null;

    const container = this.messagesContainer.nativeElement;
    const messageElements = container.querySelectorAll('.message-item');

    for (let i = 0; i < messageElements.length; i++) {
      const element = messageElements[i];
      const rect = element.getBoundingClientRect();

      // Si l'élément est visible dans la vue
      if (rect.top >= 0 && rect.bottom <= container.clientHeight) {
        const messageId = element.getAttribute('data-message-id');
        return this.messages.find((m) => m.id === messageId) || null;
      }
    }

    return null;
  }

  // Méthode pour trouver un élément de message par ID
  private findMessageElement(
    messageId: string | undefined
  ): HTMLElement | null {
    if (!this.messagesContainer?.nativeElement || !messageId) return null;
    return this.messagesContainer.nativeElement.querySelector(
      `[data-message-id="${messageId}"]`
    );
  }

  // Afficher un indicateur de chargement en haut de la liste
  private showLoadingIndicator(): void {
    // Créer l'indicateur s'il n'existe pas déjà
    if (!document.getElementById('message-loading-indicator')) {
      const indicator = document.createElement('div');
      indicator.id = 'message-loading-indicator';
      indicator.className = 'text-center py-2 text-gray-500 text-sm';
      indicator.innerHTML =
        '<i class="fas fa-spinner fa-spin mr-2"></i> Loading older messages...';

      if (this.messagesContainer?.nativeElement) {
        this.messagesContainer.nativeElement.prepend(indicator);
      }
    }
  }

  // Masquer l'indicateur de chargement
  private hideLoadingIndicator(): void {
    const indicator = document.getElementById('message-loading-indicator');
    if (indicator && indicator.parentNode) {
      indicator.parentNode.removeChild(indicator);
    }
  }

  // Méthode pour charger plus de messages (style Facebook Messenger)
  loadMoreMessages(): void {
    if (this.isLoadingMore || !this.conversation?.id || !this.hasMoreMessages)
      return;

    // Marquer comme chargement en cours
    this.isLoadingMore = true;

    // Augmenter la page pour charger les messages plus anciens
    this.currentPage++;

    // Charger plus de messages depuis le serveur avec pagination
    this.MessageService.getConversation(
      this.conversation.id,
      this.MAX_MESSAGES_TO_LOAD,
      this.currentPage
    ).subscribe({
      next: (conversation) => {
        if (
          conversation &&
          conversation.messages &&
          conversation.messages.length > 0
        ) {
          // Sauvegarder les messages actuels
          const oldMessages = [...this.messages];

          // Créer un Set des IDs existants pour une recherche de doublons plus rapide
          const existingIds = new Set(oldMessages.map((msg) => msg.id));

          // Filtrer et trier les nouveaux messages plus efficacement
          const newMessages = conversation.messages
            .filter((msg) => !existingIds.has(msg.id))
            .sort((a, b) => {
              const timeA = new Date(a.timestamp as string).getTime();
              const timeB = new Date(b.timestamp as string).getTime();
              return timeA - timeB;
            });

          if (newMessages.length > 0) {
            // Ajouter les nouveaux messages au début de la liste
            this.messages = [...newMessages, ...oldMessages];

            // Limiter le nombre total de messages pour éviter les problèmes de performance
            if (this.messages.length > this.MAX_TOTAL_MESSAGES) {
              this.messages = this.messages.slice(0, this.MAX_TOTAL_MESSAGES);
            }

            // Vérifier s'il y a plus de messages à charger
            this.hasMoreMessages =
              newMessages.length >= this.MAX_MESSAGES_TO_LOAD;
          } else {
            // Si aucun nouveau message n'est chargé, c'est qu'on a atteint le début de la conversation
            this.hasMoreMessages = false;
          }
        } else {
          this.hasMoreMessages = false;
        }

        // Désactiver le flag de chargement après un court délai
        // pour permettre au DOM de se mettre à jour
        setTimeout(() => {
          this.isLoadingMore = false;
        }, 200);
      },
      error: (error) => {
        this.logger.error('MessageChat', 'Error loading more messages:', error);
        this.isLoadingMore = false;
        this.hideLoadingIndicator();
        this.toastService.showError('Failed to load more messages');
      },
    });
  }

  // Méthode utilitaire pour comparer les timestamps
  private isSameTimestamp(
    timestamp1: string | Date | undefined,
    timestamp2: string | Date | undefined
  ): boolean {
    if (!timestamp1 || !timestamp2) return false;

    try {
      const time1 =
        timestamp1 instanceof Date
          ? timestamp1.getTime()
          : new Date(timestamp1 as string).getTime();
      const time2 =
        timestamp2 instanceof Date
          ? timestamp2.getTime()
          : new Date(timestamp2 as string).getTime();
      return Math.abs(time1 - time2) < 1000; // Tolérance d'une seconde
    } catch (error) {
      return false;
    }
  }

  scrollToBottom(force: boolean = false): void {
    try {
      if (!this.messagesContainer?.nativeElement) return;

      // Utiliser requestAnimationFrame pour s'assurer que le DOM est prêt
      requestAnimationFrame(() => {
        const container = this.messagesContainer.nativeElement;
        const isScrolledToBottom =
          container.scrollHeight - container.clientHeight <=
          container.scrollTop + 150;

        // Faire défiler vers le bas si:
        // - force est true (pour les nouveaux messages envoyés par l'utilisateur)
        // - ou si l'utilisateur est déjà proche du bas
        if (force || isScrolledToBottom) {
          // Utiliser une animation fluide pour le défilement (comme dans Messenger)
          container.scrollTo({
            top: container.scrollHeight,
            behavior: 'smooth',
          });
        }
      });
    } catch (err) {
      this.logger.error('MessageChat', 'Error scrolling to bottom:', err);
    }
  }

  // Méthode pour ouvrir l'image en plein écran (style Messenger)
  /**
   * Active/désactive l'enregistrement vocal
   */
  toggleVoiceRecording(): void {
    this.isRecordingVoice = !this.isRecordingVoice;

    if (!this.isRecordingVoice) {
      // Si on désactive l'enregistrement, réinitialiser la durée
      this.voiceRecordingDuration = 0;
    }
  }

  /**
   * Gère la fin de l'enregistrement vocal
   * @param audioBlob Blob audio enregistré
   */
  onVoiceRecordingComplete(audioBlob: Blob): void {
    this.logger.debug(
      'MessageChat',
      'Voice recording complete, size:',
      audioBlob.size
    );

    if (!this.conversation?.id && !this.otherParticipant?.id) {
      this.toastService.showError('No conversation or recipient selected');
      this.isRecordingVoice = false;
      return;
    }

    // Récupérer l'ID du destinataire
    const receiverId = this.otherParticipant?.id || '';

    // Envoyer le message vocal
    this.MessageService.sendVoiceMessage(
      receiverId,
      audioBlob,
      this.conversation?.id,
      this.voiceRecordingDuration
    ).subscribe({
      next: (message) => {
        this.logger.debug('MessageChat', 'Voice message sent:', message);
        this.isRecordingVoice = false;
        this.voiceRecordingDuration = 0;
        this.scrollToBottom(true);
      },
      error: (error) => {
        this.logger.error('MessageChat', 'Error sending voice message:', error);
        this.toastService.showError('Failed to send voice message');
        this.isRecordingVoice = false;
      },
    });
  }

  /**
   * Gère l'annulation de l'enregistrement vocal
   */
  onVoiceRecordingCancelled(): void {
    this.logger.debug('MessageChat', 'Voice recording cancelled');
    this.isRecordingVoice = false;
    this.voiceRecordingDuration = 0;
  }

  /**
   * Ouvre une image en plein écran (méthode conservée pour compatibilité)
   * @param imageUrl URL de l'image à afficher
   */
  openImageFullscreen(imageUrl: string): void {
    // Ouvrir l'image dans un nouvel onglet
    window.open(imageUrl, '_blank');
    this.logger.debug('MessageChat', `Image opened in new tab: ${imageUrl}`);
  }

  /**
   * Détecte les changements après chaque vérification de la vue
   * Cela permet de s'assurer que les messages vocaux sont correctement affichés
   * et que le défilement est maintenu
   */
  ngAfterViewChecked(): void {
    // Faire défiler vers le bas si nécessaire
    this.scrollToBottom();

    // Forcer la détection des changements pour les messages vocaux
    // Cela garantit que les messages vocaux sont correctement affichés même après avoir quitté la conversation
    if (this.messages.some((msg) => msg.type === MessageType.VOICE_MESSAGE)) {
      // Utiliser setTimeout pour éviter l'erreur ExpressionChangedAfterItHasBeenCheckedError
      setTimeout(() => {
        this.cdr.detectChanges();
      }, 0);
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    clearTimeout(this.typingTimeout);

    // Envoyer un stop typing au départ
    // if (this.conversation?.id && this.currentUserId) {
    //   this.graphqlService.stopTyping({
    //     userId: this.currentUserId,
    //     conversationId: this.conversation.id
    //   }).subscribe();
    // }
  }

  /**
   * Navigue vers la liste des conversations
   */
  goBackToConversations(): void {
    this.router.navigate(['/messages/conversations']);
  }
}
