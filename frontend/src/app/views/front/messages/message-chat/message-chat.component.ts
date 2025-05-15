import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  AfterViewChecked,
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
  otherParticipant: User | null = null;
  selectedFile: File | null = null;
  previewUrl: string | ArrayBuffer | null = null;
  isUploading = false;
  isTyping = false;
  typingTimeout: any;
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
    private logger: LoggerService
  ) {
    this.messageForm = this.fb.group({
      content: ['', [Validators.maxLength(1000)]],
    });
  }
  ngOnInit(): void {
    this.currentUserId = this.authService.getCurrentUserId();

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
      this.logger.debug(
        'MessageChat',
        `Form valid: ${!this.messageForm.invalid}, Has file: ${!!this
          .selectedFile}, Current user: ${this.currentUserId}, Recipient: ${
          this.otherParticipant?.id
        }`
      );
      return;
    }

    const content = this.messageForm.get('content')?.value;
    this.logger.info(
      'MessageChat',
      `Sending message to: ${
        this.otherParticipant.username || this.otherParticipant.id
      }`
    );
    this.logger.debug(
      'MessageChat',
      `Message content: "${content?.substring(0, 50)}${
        content?.length > 50 ? '...' : ''
      }", Has file: ${!!this.selectedFile}`
    );

    this.isUploading = true;
    this.logger.debug('MessageChat', `Setting isUploading to true`);

    const sendSub = this.MessageService.sendMessage(
      this.otherParticipant.id,
      content,
      this.selectedFile || undefined
    ).subscribe({
      next: (message) => {
        this.logger.info(
          'MessageChat',
          `Message sent successfully: ${message?.id || 'unknown'}`
        );

        // Ajouter le message envoyé à la liste des messages
        // (Ceci est un filet de sécurité au cas où la subscription ne le capte pas)
        this.messages = [...this.messages, message].sort((a, b) => {
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
          `Added sent message, now showing ${this.messages.length} messages`
        );

        this.messageForm.reset();
        this.removeAttachment();
        this.isUploading = false;
        this.logger.debug('MessageChat', `Form reset and upload state cleared`);

        // Forcer le défilement vers le bas après l'envoi d'un message
        setTimeout(() => {
          if (this.messagesContainer?.nativeElement) {
            this.messagesContainer.nativeElement.scrollTop =
              this.messagesContainer.nativeElement.scrollHeight;
          }
        }, 100);
      },
      error: (error) => {
        this.logger.error('MessageChat', `Error sending message:`, error);
        this.isUploading = false;
        this.toastService.showError('Failed to send message');
      },
    });
    this.subscriptions.add(sendSub);
    this.logger.debug('MessageChat', `Send message subscription added`);
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
      if (message.attachments?.length) {
        return message.attachments[0].type || MessageType.FILE;
      }
      return MessageType.TEXT;
    } catch (error) {
      this.logger.error('MessageChat', 'Error getting message type:', error);
      return MessageType.TEXT;
    }
  }

  getMessageTypeClass(message: Message | null | undefined): string {
    if (!message) {
      return 'bg-gray-100 rounded-lg px-4 py-2';
    }

    try {
      const isCurrentUser =
        message.sender?.id === this.currentUserId ||
        message.sender?._id === this.currentUserId;

      // Utiliser une couleur plus foncée pour les messages de l'utilisateur actuel (à droite)
      // et une couleur plus claire pour les messages des autres utilisateurs (à gauche)
      // Couleurs et forme adaptées exactement à l'image de référence mobile
      const baseClass = isCurrentUser
        ? 'bg-blue-500 text-white rounded-2xl rounded-br-sm'
        : 'bg-gray-200 text-gray-800 rounded-2xl rounded-bl-sm';

      switch (this.getMessageType(message)) {
        case MessageType.IMAGE:
          return `${baseClass} p-1 max-w-xs`;
        case MessageType.FILE:
          return `${baseClass} p-3`;
        default:
          return `${baseClass} px-4 py-3 whitespace-normal break-words min-w-[120px]`;
      }
    } catch (error) {
      this.logger.error(
        'MessageChat',
        'Error getting message type class:',
        error
      );
      return 'bg-gray-100 rounded-lg px-4 py-2 whitespace-normal break-words';
    }
  }

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  // Méthode pour détecter le défilement vers le haut et charger plus de messages
  onScroll(event: any): void {
    const container = event.target;
    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;

    // Calculer le pourcentage de défilement (0% = haut, 100% = bas)
    const scrollPercentage = (scrollTop / (scrollHeight - clientHeight)) * 100;

    // Si on est proche du haut de la liste (moins de 10% du défilement) et qu'on n'est pas déjà en train de charger
    if (
      scrollTop < 100 &&
      !this.isLoadingMore &&
      this.conversation?.id &&
      this.hasMoreMessages
    ) {
      this.logger.debug(
        'MessageChat',
        `Scroll detected near top: ${scrollTop}px, ${scrollPercentage.toFixed(
          2
        )}%`
      );

      // Sauvegarder la position de défilement actuelle et la hauteur
      const scrollPosition = scrollTop;
      const oldScrollHeight = scrollHeight;

      // Marquer comme chargement en cours
      this.isLoadingMore = true;

      // Charger plus de messages
      this.loadMoreMessages();

      // Maintenir la position de défilement relative après le chargement
      // pour que l'utilisateur reste au même endroit
      setTimeout(() => {
        const newScrollHeight = container.scrollHeight;
        const scrollDiff = newScrollHeight - oldScrollHeight;

        this.logger.debug(
          'MessageChat',
          `Adjusting scroll position: old=${oldScrollHeight}px, new=${newScrollHeight}px, diff=${scrollDiff}px`
        );

        // Ajuster la position de défilement pour maintenir la même vue
        container.scrollTop = scrollPosition + scrollDiff;
      }, 300);
    }
  }

  // Méthode pour charger plus de messages (style Facebook Messenger)
  loadMoreMessages(): void {
    if (this.isLoadingMore || !this.conversation?.id || !this.hasMoreMessages)
      return;

    // Marquer comme chargement en cours (déjà fait dans onScroll, mais par sécurité)
    this.isLoadingMore = true;

    // Augmenter la page pour charger les messages plus anciens
    this.currentPage++;

    this.logger.debug(
      'MessageChat',
      `Loading more messages, page: ${this.currentPage}, limit: ${this.MAX_MESSAGES_TO_LOAD}`
    );

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
          // Log détaillé des messages pour le débogage
          this.logger.debug(
            'MessageChat',
            `Loaded more messages: ${conversation.messages.length} messages`
          );
          this.logger.debug(
            'MessageChat',
            `First message details: id=${
              conversation.messages[0].id
            }, content=${conversation.messages[0].content?.substring(
              0,
              20
            )}, sender=${conversation.messages[0].sender?.username}`
          );

          // Sauvegarder les messages actuels
          const oldMessages = [...this.messages];

          // Normaliser et trier les nouveaux messages
          const newMessages = conversation.messages
            .filter((msg) => {
              // Filtrer pour éviter les doublons
              const isDuplicate = oldMessages.some(
                (oldMsg) =>
                  oldMsg.id === msg.id ||
                  (oldMsg.content === msg.content &&
                    this.isSameTimestamp(oldMsg.timestamp, msg.timestamp))
              );

              if (isDuplicate) {
                this.logger.debug(
                  'MessageChat',
                  `Filtered out duplicate message: ${msg.id}`
                );
              }

              return !isDuplicate;
            })
            .sort((a, b) => {
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

          if (newMessages.length > 0) {
            // Ajouter les nouveaux messages au début de la liste (comme Facebook Messenger)
            this.messages = [...newMessages, ...oldMessages];

            // Limiter le nombre total de messages pour éviter les problèmes de performance
            if (this.messages.length > this.MAX_TOTAL_MESSAGES) {
              this.messages = this.messages.slice(0, this.MAX_TOTAL_MESSAGES);
            }

            this.logger.debug(
              'MessageChat',
              `Loaded ${newMessages.length} more messages, total: ${this.messages.length}`
            );

            // Vérifier s'il y a plus de messages à charger
            this.hasMoreMessages =
              newMessages.length >= this.MAX_MESSAGES_TO_LOAD;
          } else {
            this.logger.debug('MessageChat', 'No new messages to load');
            // Si aucun nouveau message n'est chargé, c'est qu'on a atteint le début de la conversation
            this.hasMoreMessages = false;
          }

          if (!this.hasMoreMessages) {
            this.logger.debug(
              'MessageChat',
              'No more messages available to load - reached beginning of conversation'
            );
          }
        } else {
          this.logger.debug('MessageChat', 'No more messages to load');
          this.hasMoreMessages = false;
        }

        // Le flag isLoadingMore sera désactivé dans le setTimeout de onScroll
        // pour éviter les problèmes de timing avec l'ajustement du défilement
      },
      error: (error) => {
        this.logger.error('MessageChat', 'Error loading more messages:', error);
        this.isLoadingMore = false;
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

  scrollToBottom(): void {
    try {
      if (!this.messagesContainer?.nativeElement) return;

      // Utiliser requestAnimationFrame pour s'assurer que le DOM est prêt
      requestAnimationFrame(() => {
        const container = this.messagesContainer.nativeElement;
        const isScrolledToBottom =
          container.scrollHeight - container.clientHeight <=
          container.scrollTop + 150;

        // Ne faire défiler vers le bas que si l'utilisateur est déjà proche du bas
        // ou si c'est un nouveau message envoyé par l'utilisateur actuel
        if (isScrolledToBottom) {
          setTimeout(() => {
            container.scrollTop = container.scrollHeight;
          }, 100);
        }
      });
    } catch (err) {
      this.logger.error('MessageChat', 'Error scrolling to bottom:', err);
    }
  }

  private handleError(message: string, error?: any): void {
    this.error = message;
    this.loading = false;
    this.logger.error('MessageChat', message, error);
    this.toastService.showError(message);
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
}
