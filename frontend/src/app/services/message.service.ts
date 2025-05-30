import { Injectable, OnDestroy, NgZone } from '@angular/core';
import { Apollo } from 'apollo-angular';
import {
  BehaviorSubject,
  Observable,
  of,
  Subscription,
  throwError,
  retry,
  EMPTY,
} from 'rxjs';
import {
  map,
  catchError,
  tap,
  filter,
  switchMap,
  concatMap,
  toArray,
} from 'rxjs/operators';
import { from } from 'rxjs';
import {
  MessageType,
  Call,
  CallType,
  CallStatus,
  IncomingCall,
  CallSignal,
  CallOptions,
  CallFeedback,
  CallSuccess,
} from '../models/message.model';
import {
  GET_CONVERSATIONS_QUERY,
  GET_NOTIFICATIONS_QUERY,
  NOTIFICATION_SUBSCRIPTION,
  GET_CONVERSATION_QUERY,
  SEND_MESSAGE_MUTATION,
  MARK_AS_READ_MUTATION,
  MESSAGE_SENT_SUBSCRIPTION,
  USER_STATUS_SUBSCRIPTION,
  GET_USER_QUERY,
  GET_ALL_USER_QUERY,
  CONVERSATION_UPDATED_SUBSCRIPTION,
  SEARCH_MESSAGES_QUERY,
  GET_UNREAD_MESSAGES_QUERY,
  SET_USER_ONLINE_MUTATION,
  SET_USER_OFFLINE_MUTATION,
  START_TYPING_MUTATION,
  STOP_TYPING_MUTATION,
  TYPING_INDICATOR_SUBSCRIPTION,
  GET_CURRENT_USER_QUERY,
  REACT_TO_MESSAGE_MUTATION,
  FORWARD_MESSAGE_MUTATION,
  PIN_MESSAGE_MUTATION,
  CREATE_GROUP_MUTATION,
  UPDATE_GROUP_MUTATION,
  DELETE_GROUP_MUTATION,
  ADD_GROUP_PARTICIPANTS_MUTATION,
  REMOVE_GROUP_PARTICIPANTS_MUTATION,
  LEAVE_GROUP_MUTATION,
  GET_GROUP_QUERY,
  GET_USER_GROUPS_QUERY,
  EDIT_MESSAGE_MUTATION,
  DELETE_MESSAGE_MUTATION,
  GET_MESSAGES_QUERY,
  GET_NOTIFICATIONS_ATTACHAMENTS,
  MARK_NOTIFICATION_READ_MUTATION,
  NOTIFICATIONS_READ_SUBSCRIPTION,
  CREATE_CONVERSATION_MUTATION,
  DELETE_NOTIFICATION_MUTATION,
  DELETE_MULTIPLE_NOTIFICATIONS_MUTATION,
  DELETE_ALL_NOTIFICATIONS_MUTATION,
  // Requêtes et mutations pour les appels
  CALL_HISTORY_QUERY,
  CALL_DETAILS_QUERY,
  CALL_STATS_QUERY,
  INITIATE_CALL_MUTATION,
  SEND_CALL_SIGNAL_MUTATION,
  ACCEPT_CALL_MUTATION,
  REJECT_CALL_MUTATION,
  END_CALL_MUTATION,
  TOGGLE_CALL_MEDIA_MUTATION,
  CALL_SIGNAL_SUBSCRIPTION,
  INCOMING_CALL_SUBSCRIPTION,
  CALL_STATUS_CHANGED_SUBSCRIPTION,
  GET_VOICE_MESSAGES_QUERY,
} from '../graphql/message.graphql';
import {
  Conversation,
  Message,
  Notification,
  User,
  Attachment,
  getNotificationAttachmentsEvent,
  Group,
  MessageFilter,
  TypingIndicatorEvent,
  GetConversationsResponse,
  GetConversationResponse,
  MarkAsReadResponse,
  ReactToMessageResponse,
  ForwardMessageResponse,
  PinMessageResponse,
  SearchMessagesResponse,
  SendMessageResponse,
  GetUnreadMessagesResponse,
  GetAllUsersResponse,
  GetOneUserResponse,
  getCurrentUserResponse,
  SetUserOnlineResponse,
  SetUserOfflineResponse,
  GetGroupResponse,
  GetUserGroupsResponse,
  CreateGroupResponse,
  UpdateGroupResponse,
  StartTupingResponse,
  StopTypingResponse,
  TypingIndicatorEvents,
  getUserNotificationsResponse,
  NotificationType,
  MarkNotificationsAsReadResponse,
  NotificationReceivedEvent,
  NotificationsReadEvent,
} from '../models/message.model';
import { LoggerService } from './logger.service';
@Injectable({
  providedIn: 'root',
})
export class MessageService implements OnDestroy {
  // État partagé
  private activeConversation = new BehaviorSubject<string | null>(null);
  private notifications = new BehaviorSubject<Notification[]>([]);
  private notificationCache = new Map<string, Notification>();
  private cleanupInterval: any;
  private notificationCount = new BehaviorSubject<number>(0);
  private onlineUsers = new Map<string, User>();
  private subscriptions: Subscription[] = [];
  private readonly CACHE_DURATION = 300000;
  private lastFetchTime = 0;

  // Propriétés pour les appels
  private activeCall = new BehaviorSubject<Call | null>(null);
  private incomingCall = new BehaviorSubject<IncomingCall | null>(null);
  private callSignals = new BehaviorSubject<CallSignal | null>(null);
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private peerConnection: RTCPeerConnection | null = null;

  // Observables publics pour les appels
  public activeCall$ = this.activeCall.asObservable();
  public incomingCall$ = this.incomingCall.asObservable();
  public callSignals$ = this.callSignals.asObservable();
  public localStream$ = new BehaviorSubject<MediaStream | null>(null);
  public remoteStream$ = new BehaviorSubject<MediaStream | null>(null);

  // Configuration WebRTC
  private readonly rtcConfig: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  };
  private usersCache: User[] = [];

  // Pagination metadata for user list
  public currentUserPagination: {
    totalCount: number;
    totalPages: number;
    currentPage: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  } = {
    totalCount: 0,
    totalPages: 0,
    currentPage: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  };

  // Observables publics
  public activeConversation$ = this.activeConversation.asObservable();
  public notifications$ = this.notifications.asObservable();
  public notificationCount$ = this.notificationCount.asObservable();

  // Propriétés pour la gestion des sons
  private sounds: { [key: string]: HTMLAudioElement } = {};
  private isPlaying: { [key: string]: boolean } = {};
  private muted = false;

  constructor(
    private apollo: Apollo,
    private logger: LoggerService,
    private zone: NgZone
  ) {
    this.loadNotificationsFromLocalStorage();
    this.initSubscriptions();
    this.startCleanupInterval();
    this.preloadSounds();
  }

  /**
   * Charge les notifications depuis le localStorage
   * @private
   */
  private loadNotificationsFromLocalStorage(): void {
    try {
      const savedNotifications = localStorage.getItem('notifications');
      if (savedNotifications) {
        const notifications = JSON.parse(savedNotifications) as Notification[];

        this.notificationCache.clear();

        notifications.forEach((notification) => {
          if (notification && notification.id) {
            this.notificationCache.set(notification.id, notification);
          }
        });

        this.notifications.next(Array.from(this.notificationCache.values()));
        this.updateUnreadCount();
      }
    } catch (error) {
      // Handle error silently
    }
  }
  private initSubscriptions(): void {
    this.zone.runOutsideAngular(() => {
      this.subscribeToNewNotifications().subscribe();
      this.subscribeToNotificationsRead().subscribe();
      this.subscribeToIncomingCalls().subscribe();
      // 🔥 AJOUT: Subscription générale pour l'utilisateur
    });
    this.subscribeToUserStatus();
  }

  /**
   * S'abonne aux appels entrants
   */
  private subscribeToIncomingCalls(): Observable<IncomingCall | null> {
    return this.apollo
      .subscribe<{ incomingCall: IncomingCall }>({
        query: INCOMING_CALL_SUBSCRIPTION,
      })
      .pipe(
        map(({ data }) => {
          if (!data?.incomingCall) {
            return null;
          }

          // Gérer l'appel entrant
          this.handleIncomingCall(data.incomingCall);
          return data.incomingCall;
        }),
        catchError((error) => {
          this.logger.error('Error in incoming call subscription', error);
          return of(null);
        })
      );
  }

  /**
   * Gère un appel entrant
   */
  private handleIncomingCall(call: IncomingCall): void {
    this.incomingCall.next(call);
    this.play('ringtone', true);
  }

  // --------------------------------------------------------------------------
  // Section: Gestion des sons (intégré depuis SoundService)
  // --------------------------------------------------------------------------

  /**
   * Précharge les sons utilisés dans l'application
   */
  private preloadSounds(): void {
    this.loadSound('ringtone', 'assets/sounds/ringtone.mp3');
    this.loadSound('call-end', 'assets/sounds/call-end.mp3');
    this.loadSound('call-connected', 'assets/sounds/call-connected.mp3');
    this.loadSound('notification', 'assets/sounds/notification.mp3');
  }

  /**
   * Charge un fichier audio
   * @param name Nom du son
   * @param path Chemin du fichier
   */
  private loadSound(name: string, path: string): void {
    try {
      const audio = new Audio(path);
      audio.load();
      this.sounds[name] = audio;
      this.isPlaying[name] = false;

      audio.addEventListener('ended', () => {
        this.isPlaying[name] = false;
      });
    } catch (error) {
      // Handle error silently
    }
  }

  /**
   * Joue un son
   * @param name Nom du son
   * @param loop Lecture en boucle
   */
  play(name: string, loop: boolean = false): void {
    if (this.muted) {
      return;
    }

    try {
      const sound = this.sounds[name];
      if (!sound) {
        return;
      }

      sound.loop = loop;

      if (!this.isPlaying[name]) {
        sound.currentTime = 0;
        sound.play().catch((error) => {
          // Handle error silently
        });
        this.isPlaying[name] = true;
      }
    } catch (error) {
      // Handle error silently
    }
  }

  /**
   * Arrête un son
   * @param name Nom du son
   */
  stop(name: string): void {
    try {
      const sound = this.sounds[name];
      if (!sound) {
        return;
      }

      if (this.isPlaying[name]) {
        sound.pause();
        sound.currentTime = 0;
        this.isPlaying[name] = false;
      }
    } catch (error) {
      // Handle error silently
    }
  }

  /**
   * Arrête tous les sons
   */
  stopAllSounds(): void {
    Object.keys(this.sounds).forEach((name) => {
      this.stop(name);
    });
  }

  /**
   * Active ou désactive le son
   * @param muted True pour désactiver le son, false pour l'activer
   */
  setMuted(muted: boolean): void {
    this.muted = muted;

    if (muted) {
      this.stopAllSounds();
    }
  }

  /**
   * Vérifie si le son est désactivé
   * @returns True si le son est désactivé, false sinon
   */
  isMuted(): boolean {
    return this.muted;
  }

  /**
   * Joue le son de notification
   */
  playNotificationSound(): void {
    console.log('MessageService: Tentative de lecture du son de notification');

    if (this.muted) {
      console.log('MessageService: Son désactivé, notification ignorée');
      return;
    }

    // Créer une mélodie agréable avec l'API Web Audio
    try {
      // Créer un contexte audio
      const audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();

      // 🎵 TESTEZ DIFFÉRENTS SONS - Décommentez celui que vous voulez tester !

      // SON 1: Mélodie douce (WhatsApp style) - ACTUEL
      this.playNotificationMelody1(audioContext);

      // SON 2: Mélodie montante (iPhone style) - Décommentez pour tester
      // this.playNotificationMelody2(audioContext);

      // SON 3: Mélodie descendante (Messenger style) - Décommentez pour tester
      // this.playNotificationMelody3(audioContext);

      // SON 4: Triple note (Discord style) - Décommentez pour tester
      // this.playNotificationMelody4(audioContext);

      // SON 5: Cloche douce (Slack style) - Décommentez pour tester
      // this.playNotificationMelody5(audioContext);

      console.log(
        'MessageService: Son de notification mélodieux généré avec succès'
      );
    } catch (error) {
      console.error(
        'MessageService: Erreur lors de la génération du son:',
        error
      );

      // Fallback à la méthode originale en cas d'erreur
      try {
        const audio = new Audio('assets/sounds/notification.mp3');
        audio.volume = 0.7; // Volume plus doux
        audio.play().catch((err) => {
          console.error(
            'MessageService: Erreur lors de la lecture du fichier son:',
            err
          );
        });
      } catch (audioError) {
        console.error(
          'MessageService: Exception lors de la lecture du fichier son:',
          audioError
        );
      }
    }
  }

  // 🎵 SON 1: Mélodie douce (WhatsApp style)
  private playNotificationMelody1(audioContext: AudioContext): void {
    this.playNotificationTone(audioContext, 0, 659.25, 0.15); // E5
    this.playNotificationTone(audioContext, 0.15, 523.25, 0.15); // C5
  }

  // 🎵 SON 2: Mélodie montante (iPhone style)
  private playNotificationMelody2(audioContext: AudioContext): void {
    this.playNotificationTone(audioContext, 0, 523.25, 0.12); // C5
    this.playNotificationTone(audioContext, 0.12, 659.25, 0.12); // E5
    this.playNotificationTone(audioContext, 0.24, 783.99, 0.16); // G5
  }

  // 🎵 SON 3: Mélodie descendante (Messenger style)
  private playNotificationMelody3(audioContext: AudioContext): void {
    this.playNotificationTone(audioContext, 0, 880, 0.1); // A5
    this.playNotificationTone(audioContext, 0.1, 659.25, 0.1); // E5
    this.playNotificationTone(audioContext, 0.2, 523.25, 0.15); // C5
  }

  // 🎵 SON 4: Triple note (Discord style)
  private playNotificationMelody4(audioContext: AudioContext): void {
    this.playNotificationTone(audioContext, 0, 698.46, 0.08); // F5
    this.playNotificationTone(audioContext, 0.08, 698.46, 0.08); // F5
    this.playNotificationTone(audioContext, 0.16, 880, 0.12); // A5
  }

  // 🎵 SON 5: Cloche douce (Slack style)
  private playNotificationMelody5(audioContext: AudioContext): void {
    this.playBellTone(audioContext, 0, 1046.5, 0.4); // C6 - son de cloche
  }

  /**
   * Joue une note individuelle pour la mélodie de notification
   */
  private playNotificationTone(
    audioContext: AudioContext,
    startTime: number,
    frequency: number,
    duration: number
  ): void {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    // Configurer l'oscillateur pour un son plus doux
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(
      frequency,
      audioContext.currentTime + startTime
    );

    // Configurer le volume avec une enveloppe douce
    gainNode.gain.setValueAtTime(0, audioContext.currentTime + startTime);
    gainNode.gain.linearRampToValueAtTime(
      0.3,
      audioContext.currentTime + startTime + 0.02
    );
    gainNode.gain.linearRampToValueAtTime(
      0.2,
      audioContext.currentTime + startTime + duration * 0.7
    );
    gainNode.gain.linearRampToValueAtTime(
      0,
      audioContext.currentTime + startTime + duration
    );

    // Connecter les nœuds
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Démarrer et arrêter l'oscillateur
    oscillator.start(audioContext.currentTime + startTime);
    oscillator.stop(audioContext.currentTime + startTime + duration);
  }

  /**
   * Joue un son de cloche pour les notifications
   */
  private playBellTone(
    audioContext: AudioContext,
    startTime: number,
    frequency: number,
    duration: number
  ): void {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    // Configurer l'oscillateur pour un son de cloche
    oscillator.type = 'triangle'; // Son plus doux que sine
    oscillator.frequency.setValueAtTime(
      frequency,
      audioContext.currentTime + startTime
    );

    // Enveloppe de cloche (attaque rapide, déclin lent)
    gainNode.gain.setValueAtTime(0, audioContext.currentTime + startTime);
    gainNode.gain.linearRampToValueAtTime(
      0.4,
      audioContext.currentTime + startTime + 0.01
    );
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      audioContext.currentTime + startTime + duration
    );

    // Connecter les nœuds
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Démarrer et arrêter l'oscillateur
    oscillator.start(audioContext.currentTime + startTime);
    oscillator.stop(audioContext.currentTime + startTime + duration);
  }
  // --------------------------------------------------------------------------
  // Section 1: Méthodes pour les Messages
  // --------------------------------------------------------------------------

  /**
   * Joue un fichier audio
   * @param audioUrl URL du fichier audio à jouer
   * @returns Promise qui se résout lorsque la lecture est terminée
   */
  playAudio(audioUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const audio = new Audio(audioUrl);

      audio.onended = () => {
        resolve();
      };

      audio.onerror = (error) => {
        this.logger.error(`[MessageService] Error playing audio:`, error);
        reject(error);
      };

      audio.play().catch((error) => {
        this.logger.error(`[MessageService] Error playing audio:`, error);
        reject(error);
      });
    });
  }

  /**
   * Récupère tous les messages vocaux de l'utilisateur
   * @returns Observable avec la liste des messages vocaux
   */
  getVoiceMessages(): Observable<Call[]> {
    this.logger.debug('[MessageService] Getting voice messages');

    return this.apollo
      .watchQuery<{ getVoiceMessages: Call[] }>({
        query: GET_VOICE_MESSAGES_QUERY,
        fetchPolicy: 'network-only', // Ne pas utiliser le cache pour cette requête
      })
      .valueChanges.pipe(
        map((result) => {
          const voiceMessages = result.data?.getVoiceMessages || [];
          this.logger.debug(
            `[MessageService] Retrieved ${voiceMessages.length} voice messages`
          );
          return voiceMessages;
        }),
        catchError((error) => {
          this.logger.error(
            '[MessageService] Error fetching voice messages:',
            error
          );
          return throwError(() => new Error('Failed to fetch voice messages'));
        })
      );
  }
  // Message methods
  getMessages(
    senderId: string,
    receiverId: string,
    conversationId: string,
    page: number = 1,
    limit: number = 10
  ): Observable<Message[]> {
    return this.apollo
      .watchQuery<{ getMessages: Message[] }>({
        query: GET_MESSAGES_QUERY,
        variables: { senderId, receiverId, conversationId, limit, page },
        fetchPolicy: 'network-only',
      })
      .valueChanges.pipe(
        map((result) => {
          const messages = result.data?.getMessages || [];
          return messages.map((msg) => this.normalizeMessage(msg));
        }),
        catchError((error) => {
          this.logger.error('Error fetching messages:', error);
          return throwError(() => new Error('Failed to fetch messages'));
        })
      );
  }
  editMessage(messageId: string, newContent: string): Observable<Message> {
    return this.apollo
      .mutate<{ editMessage: Message }>({
        mutation: EDIT_MESSAGE_MUTATION,
        variables: { messageId, newContent },
      })
      .pipe(
        map((result) => {
          if (!result.data?.editMessage) {
            throw new Error('Failed to edit message');
          }
          return this.normalizeMessage(result.data.editMessage);
        }),
        catchError((error) => {
          this.logger.error('Error editing message:', error);
          return throwError(() => new Error('Failed to edit message'));
        })
      );
  }

  deleteMessage(messageId: string): Observable<Message> {
    return this.apollo
      .mutate<{ deleteMessage: Message }>({
        mutation: DELETE_MESSAGE_MUTATION,
        variables: { messageId },
      })
      .pipe(
        map((result) => {
          if (!result.data?.deleteMessage) {
            throw new Error('Failed to delete message');
          }
          return this.normalizeMessage(result.data.deleteMessage);
        }),
        catchError((error) => {
          this.logger.error('Error deleting message:', error);
          return throwError(() => new Error('Failed to delete message'));
        })
      );
  }

  markMessageAsRead(messageId: string): Observable<Message> {
    return this.apollo
      .mutate<MarkAsReadResponse>({
        mutation: MARK_AS_READ_MUTATION,
        variables: { messageId },
      })
      .pipe(
        map((result) => {
          if (!result.data?.markMessageAsRead)
            throw new Error('Failed to mark message as read');
          return {
            ...result.data.markMessageAsRead,
            readAt: new Date(),
          };
        }),
        catchError((error) => {
          console.error('Error marking message as read:', error);
          return throwError(() => new Error('Failed to mark message as read'));
        })
      );
  }

  reactToMessage(messageId: string, emoji: string): Observable<Message> {
    return this.apollo
      .mutate<ReactToMessageResponse>({
        mutation: REACT_TO_MESSAGE_MUTATION,
        variables: { messageId, emoji },
      })
      .pipe(
        map((result) => {
          if (!result.data?.reactToMessage)
            throw new Error('Failed to react to message');
          return result.data.reactToMessage;
        }),
        catchError((error) => {
          console.error('Error reacting to message:', error);
          return throwError(() => new Error('Failed to react to message'));
        })
      );
  }

  forwardMessage(
    messageId: string,
    conversationIds: string[]
  ): Observable<Message[]> {
    return this.apollo
      .mutate<ForwardMessageResponse>({
        mutation: FORWARD_MESSAGE_MUTATION,
        variables: { messageId, conversationIds },
      })
      .pipe(
        map((result) => {
          if (!result.data?.forwardMessage)
            throw new Error('Failed to forward message');
          return result.data.forwardMessage.map((msg) => ({
            ...msg,
            timestamp: msg.timestamp
              ? this.normalizeDate(msg.timestamp)
              : new Date(),
          }));
        }),
        catchError((error) => {
          console.error('Error forwarding message:', error);
          return throwError(() => new Error('Failed to forward message'));
        })
      );
  }

  pinMessage(messageId: string, conversationId: string): Observable<Message> {
    return this.apollo
      .mutate<PinMessageResponse>({
        mutation: PIN_MESSAGE_MUTATION,
        variables: { messageId, conversationId },
      })
      .pipe(
        map((result) => {
          if (!result.data?.pinMessage)
            throw new Error('Failed to pin message');
          return {
            ...result.data.pinMessage,
            pinnedAt: new Date(),
          };
        }),
        catchError((error) => {
          console.error('Error pinning message:', error);
          return throwError(() => new Error('Failed to pin message'));
        })
      );
  }

  searchMessages(
    query: string,
    conversationId?: string,
    filters: MessageFilter = {}
  ): Observable<Message[]> {
    return this.apollo
      .watchQuery<SearchMessagesResponse>({
        query: SEARCH_MESSAGES_QUERY,
        variables: {
          query,
          conversationId,
          ...filters,
          dateFrom: this.toSafeISOString(filters.dateFrom),
          dateTo: this.toSafeISOString(filters.dateTo),
        },
        fetchPolicy: 'network-only',
      })
      .valueChanges.pipe(
        map(
          (result) =>
            result.data?.searchMessages?.map((msg) => ({
              ...msg,
              timestamp: this.safeDate(msg.timestamp),
              sender: this.normalizeUser(msg.sender),
            })) || []
        ),
        catchError((error) => {
          console.error('Error searching messages:', error);
          return throwError(() => new Error('Failed to search messages'));
        })
      );
  }

  getUnreadMessages(userId: string): Observable<Message[]> {
    return this.apollo
      .watchQuery<GetUnreadMessagesResponse>({
        query: GET_UNREAD_MESSAGES_QUERY,
        variables: { userId },
        fetchPolicy: 'network-only',
      })
      .valueChanges.pipe(
        map(
          (result) =>
            result.data?.getUnreadMessages?.map((msg) => ({
              ...msg,
              timestamp: this.safeDate(msg.timestamp),
              sender: this.normalizeUser(msg.sender),
            })) || []
        ),
        catchError((error) => {
          console.error('Error fetching unread messages:', error);
          return throwError(() => new Error('Failed to fetch unread messages'));
        })
      );
  }

  setActiveConversation(conversationId: string): void {
    this.activeConversation.next(conversationId);
  }

  getConversations(): Observable<Conversation[]> {
    return this.apollo
      .watchQuery<GetConversationsResponse>({
        query: GET_CONVERSATIONS_QUERY,
        fetchPolicy: 'network-only',
      })
      .valueChanges.pipe(
        map((result) => {
          const conversations = result.data?.getConversations || [];
          return conversations.map((conv) => this.normalizeConversation(conv));
        }),
        catchError((error) => {
          console.error('Error fetching conversations:', error);
          return throwError(() => new Error('Failed to load conversations'));
        })
      );
  }

  getConversation(
    conversationId: string,
    limit?: number,
    page?: number
  ): Observable<Conversation> {
    this.logger.info(
      `[MessageService] Getting conversation: ${conversationId}, limit: ${limit}, page: ${page}`
    );

    const variables: any = { conversationId };

    // Ajouter les paramètres de pagination s'ils sont fournis
    if (limit !== undefined) {
      variables.limit = limit;
    } else {
      variables.limit = 10; // Valeur par défaut
    }

    // Calculer l'offset à partir de la page si elle est fournie
    if (page !== undefined) {
      // La requête GraphQL utilise offset, donc nous devons convertir la page en offset
      const offset = (page - 1) * variables.limit;
      variables.offset = offset;
      this.logger.debug(
        `[MessageService] Calculated offset: ${offset} from page: ${page} and limit: ${variables.limit}`
      );
    } else {
      variables.offset = 0; // Valeur par défaut
    }

    this.logger.debug(
      `[MessageService] Final pagination parameters: limit=${variables.limit}, offset=${variables.offset}`
    );

    return this.apollo
      .watchQuery<GetConversationResponse>({
        query: GET_CONVERSATION_QUERY,
        variables: variables,
        fetchPolicy: 'network-only',
      })
      .valueChanges.pipe(
        map((result) => {
          this.logger.debug(
            `[MessageService] Conversation response received:`,
            result
          );

          const conv = result.data?.getConversation;
          if (!conv) {
            this.logger.error(
              `[MessageService] Conversation not found: ${conversationId}`
            );
            throw new Error('Conversation not found');
          }

          this.logger.debug(
            `[MessageService] Normalizing conversation: ${conversationId}`
          );
          const normalizedConversation = this.normalizeConversation(conv);

          this.logger.info(
            `[MessageService] Conversation loaded successfully: ${conversationId}, participants: ${
              normalizedConversation.participants?.length || 0
            }, messages: ${normalizedConversation.messages?.length || 0}`
          );
          return normalizedConversation;
        }),
        catchError((error) => {
          this.logger.error(
            `[MessageService] Error fetching conversation:`,
            error
          );
          return throwError(() => new Error('Failed to load conversation'));
        })
      );
  }

  createConversation(userId: string): Observable<Conversation> {
    this.logger.info(
      `[MessageService] Creating conversation with user: ${userId}`
    );

    if (!userId) {
      this.logger.error(
        `[MessageService] Cannot create conversation: userId is undefined`
      );
      return throwError(
        () => new Error('User ID is required to create a conversation')
      );
    }

    return this.apollo
      .mutate<{ createConversation: Conversation }>({
        mutation: CREATE_CONVERSATION_MUTATION,
        variables: { userId },
      })
      .pipe(
        map((result) => {
          this.logger.debug(
            `[MessageService] Conversation creation response:`,
            result
          );

          const conversation = result.data?.createConversation;
          if (!conversation) {
            this.logger.error(
              `[MessageService] Failed to create conversation with user: ${userId}`
            );
            throw new Error('Failed to create conversation');
          }

          try {
            const normalizedConversation =
              this.normalizeConversation(conversation);
            this.logger.info(
              `[MessageService] Conversation created successfully: ${normalizedConversation.id}`
            );
            return normalizedConversation;
          } catch (error) {
            this.logger.error(
              `[MessageService] Error normalizing created conversation:`,
              error
            );
            throw new Error('Error processing created conversation');
          }
        }),
        catchError((error) => {
          this.logger.error(
            `[MessageService] Error creating conversation with user ${userId}:`,
            error
          );
          return throwError(
            () => new Error(`Failed to create conversation: ${error.message}`)
          );
        })
      );
  }

  /**
   * Récupère une conversation existante ou en crée une nouvelle si elle n'existe pas
   * @param userId ID de l'utilisateur avec qui créer/récupérer une conversation
   * @returns Observable avec la conversation
   */
  getOrCreateConversation(userId: string): Observable<Conversation> {
    this.logger.info(
      `[MessageService] Getting or creating conversation with user: ${userId}`
    );

    if (!userId) {
      this.logger.error(
        `[MessageService] Cannot get/create conversation: userId is undefined`
      );
      return throwError(
        () => new Error('User ID is required to get/create a conversation')
      );
    }

    // D'abord, essayons de trouver une conversation existante entre les deux utilisateurs
    return this.getConversations().pipe(
      map((conversations) => {
        // Récupérer l'ID de l'utilisateur actuel
        const currentUserId = this.getCurrentUserId();

        // Chercher une conversation directe (non groupe) entre les deux utilisateurs
        const existingConversation = conversations.find((conv) => {
          if (conv.isGroup) return false;

          // Vérifier si la conversation contient les deux utilisateurs
          const participantIds =
            conv.participants?.map((p) => p.id || p._id) || [];
          return (
            participantIds.includes(userId) &&
            participantIds.includes(currentUserId)
          );
        });

        if (existingConversation) {
          this.logger.info(
            `[MessageService] Found existing conversation: ${existingConversation.id}`
          );
          return existingConversation;
        }

        // Si aucune conversation n'est trouvée, en créer une nouvelle
        throw new Error('No existing conversation found');
      }),
      catchError((error) => {
        this.logger.info(
          `[MessageService] No existing conversation found, creating new one: ${error.message}`
        );
        return this.createConversation(userId);
      })
    );
  }

  // --------------------------------------------------------------------------
  // Section 2: Méthodes pour les Notifications
  // --------------------------------------------------------------------------
  // Propriétés pour la pagination des notifications
  private notificationPagination = {
    currentPage: 1,
    limit: 10,
    hasMoreNotifications: true,
  };

  getNotifications(
    refresh = false,
    page = 1,
    limit = 10
  ): Observable<Notification[]> {
    this.logger.info(
      'MessageService',
      `Fetching notifications, refresh: ${refresh}, page: ${page}, limit: ${limit}`
    );
    this.logger.debug('MessageService', 'Using query', {
      query: GET_NOTIFICATIONS_QUERY,
    });

    // Si refresh est true, réinitialiser la pagination mais ne pas vider le cache
    // pour conserver les suppressions locales
    if (refresh) {
      this.logger.debug(
        'MessageService',
        'Resetting pagination due to refresh'
      );
      this.notificationPagination.currentPage = 1;
      this.notificationPagination.hasMoreNotifications = true;
    }

    // Mettre à jour les paramètres de pagination
    this.notificationPagination.currentPage = page;
    this.notificationPagination.limit = limit;

    // Récupérer les IDs des notifications supprimées du localStorage
    const deletedNotificationIds = this.getDeletedNotificationIds();
    this.logger.debug(
      'MessageService',
      `Found ${deletedNotificationIds.size} deleted notification IDs in localStorage`
    );

    return this.apollo
      .watchQuery<getUserNotificationsResponse>({
        query: GET_NOTIFICATIONS_QUERY,
        variables: {
          page: page,
          limit: limit,
        },
        fetchPolicy: refresh ? 'network-only' : 'cache-first',
      })
      .valueChanges.pipe(
        map((result) => {
          this.logger.debug(
            'MessageService',
            'Notifications response received'
          );

          if (result.errors) {
            this.logger.error(
              'MessageService',
              'GraphQL errors:',
              result.errors
            );
            throw new Error(result.errors.map((e) => e.message).join(', '));
          }

          const notifications = result.data?.getUserNotifications || [];
          this.logger.debug(
            'MessageService',
            `Received ${notifications.length} notifications from server for page ${page}`
          );

          // Vérifier s'il y a plus de notifications à charger
          this.notificationPagination.hasMoreNotifications =
            notifications.length >= limit;

          if (notifications.length === 0) {
            this.logger.info(
              'MessageService',
              'No notifications received from server'
            );
            this.notificationPagination.hasMoreNotifications = false;
          }

          // Filtrer les notifications supprimées
          const filteredNotifications = notifications.filter(
            (notif) => !deletedNotificationIds.has(notif.id)
          );

          this.logger.debug(
            'MessageService',
            `Filtered out ${
              notifications.length - filteredNotifications.length
            } deleted notifications`
          );

          // Afficher les notifications reçues pour le débogage
          filteredNotifications.forEach((notif, index) => {
            console.log(`Notification ${index + 1} (page ${page}):`, {
              id: notif.id || (notif as any)._id,
              type: notif.type,
              content: notif.content,
              isRead: notif.isRead,
            });
          });

          // Vérifier si les notifications existent déjà dans le cache avant de les ajouter
          // Mettre à jour le cache avec les nouvelles notifications
          this.updateCache(filteredNotifications);

          // Récupérer toutes les notifications du cache et les TRIER
          const cachedNotifications = Array.from(
            this.notificationCache.values()
          );

          // 🚀 TRI OPTIMISÉ: Les notifications les plus récentes en premier
          const sortedNotifications =
            this.sortNotificationsByDate(cachedNotifications);

          console.log(
            `📊 SORTED: ${sortedNotifications.length} notifications triées (plus récentes en premier)`
          );

          // Mettre à jour le BehaviorSubject avec les notifications TRIÉES
          this.notifications.next(sortedNotifications);

          // Mettre à jour le compteur de notifications non lues
          this.updateUnreadCount();

          // Sauvegarder les notifications dans le localStorage
          this.saveNotificationsToLocalStorage();

          return cachedNotifications;
        }),
        catchError((error) => {
          this.logger.error(
            'MessageService',
            'Error loading notifications:',
            error
          );

          if (error.graphQLErrors) {
            this.logger.error(
              'MessageService',
              'GraphQL errors:',
              error.graphQLErrors
            );
          }

          if (error.networkError) {
            this.logger.error(
              'MessageService',
              'Network error:',
              error.networkError
            );
          }

          return throwError(() => new Error('Failed to load notifications'));
        })
      );
  }

  /**
   * Récupère les IDs des notifications supprimées du localStorage
   * @private
   * @returns Set contenant les IDs des notifications supprimées
   */
  private getDeletedNotificationIds(): Set<string> {
    try {
      const deletedIds = new Set<string>();
      const savedNotifications = localStorage.getItem('notifications');

      // Si aucune notification n'est sauvegardée, retourner un ensemble vide
      if (!savedNotifications) {
        return deletedIds;
      }

      // Récupérer les IDs des notifications sauvegardées
      const savedNotificationIds = new Set(
        JSON.parse(savedNotifications).map((n: Notification) => n.id)
      );

      // Récupérer les notifications du serveur (si disponibles dans le cache Apollo)
      const serverNotifications =
        this.apollo.client.readQuery<getUserNotificationsResponse>({
          query: GET_NOTIFICATIONS_QUERY,
        })?.getUserNotifications || [];

      // Pour chaque notification du serveur, vérifier si elle est dans les notifications sauvegardées
      serverNotifications.forEach((notification) => {
        if (!savedNotificationIds.has(notification.id)) {
          deletedIds.add(notification.id);
        }
      });

      return deletedIds;
    } catch (error) {
      this.logger.error(
        'MessageService',
        'Erreur lors de la récupération des IDs de notifications supprimées:',
        error
      );
      return new Set<string>();
    }
  }

  // Méthode pour vérifier s'il y a plus de notifications à charger
  hasMoreNotifications(): boolean {
    return this.notificationPagination.hasMoreNotifications;
  }

  // Méthode pour charger la page suivante de notifications
  loadMoreNotifications(): Observable<Notification[]> {
    const nextPage = this.notificationPagination.currentPage + 1;
    return this.getNotifications(
      false,
      nextPage,
      this.notificationPagination.limit
    );
  }
  getNotificationById(id: string): Observable<Notification | undefined> {
    return this.notifications$.pipe(
      map((notifications) => notifications.find((n) => n.id === id)),
      catchError((error) => {
        this.logger.error('Error finding notification:', error);
        return throwError(() => new Error('Failed to find notification'));
      })
    );
  }
  getNotificationCount(): number {
    return this.notifications.value?.length || 0;
  }
  getNotificationAttachments(notificationId: string): Observable<Attachment[]> {
    return this.apollo
      .query<getNotificationAttachmentsEvent>({
        query: GET_NOTIFICATIONS_ATTACHAMENTS,
        variables: { id: notificationId },
        fetchPolicy: 'network-only',
      })
      .pipe(
        map((result) => result.data?.getNotificationAttachments || []),
        catchError((error) => {
          this.logger.error('Error fetching notification attachments:', error);
          return throwError(() => new Error('Failed to fetch attachments'));
        })
      );
  }
  getUnreadNotifications(): Observable<Notification[]> {
    return this.notifications$.pipe(
      map((notifications) => notifications.filter((n) => !n.isRead))
    );
  }

  /**
   * Supprime une notification
   * @param notificationId ID de la notification à supprimer
   * @returns Observable avec le résultat de l'opération
   */
  deleteNotification(
    notificationId: string
  ): Observable<{ success: boolean; message: string }> {
    this.logger.debug(
      'MessageService',
      `Suppression de la notification ${notificationId}`
    );

    if (!notificationId) {
      this.logger.warn('MessageService', 'ID de notification invalide');
      return throwError(() => new Error('ID de notification invalide'));
    }

    // Supprimer localement d'abord pour une meilleure expérience utilisateur
    const removedCount = this.removeNotificationsFromCache([notificationId]);

    // Appeler le backend pour supprimer la notification
    return this.apollo
      .mutate<{ deleteNotification: { success: boolean; message: string } }>({
        mutation: DELETE_NOTIFICATION_MUTATION,
        variables: { notificationId },
      })
      .pipe(
        map((result) => {
          const response = result.data?.deleteNotification;
          if (!response) {
            throw new Error('Réponse de suppression invalide');
          }

          this.logger.debug(
            'MessageService',
            'Résultat de la suppression:',
            response
          );

          return response;
        }),
        catchError((error) =>
          this.handleDeletionError(error, 'la suppression de la notification', {
            success: true,
            message: 'Notification supprimée localement (erreur serveur)',
          })
        )
      );
  }

  /**
   * Sauvegarde les notifications dans le localStorage
   * @private
   */
  private saveNotificationsToLocalStorage(): void {
    try {
      const notifications = Array.from(this.notificationCache.values());
      localStorage.setItem('notifications', JSON.stringify(notifications));
      this.logger.debug(
        'MessageService',
        'Notifications sauvegardées localement'
      );
    } catch (error) {
      this.logger.error(
        'MessageService',
        'Erreur lors de la sauvegarde des notifications:',
        error
      );
    }
  }

  /**
   * Supprime toutes les notifications de l'utilisateur
   * @returns Observable avec le résultat de l'opération
   */
  deleteAllNotifications(): Observable<{
    success: boolean;
    count: number;
    message: string;
  }> {
    this.logger.debug(
      'MessageService',
      'Suppression de toutes les notifications'
    );

    // Supprimer localement d'abord pour une meilleure expérience utilisateur
    const count = this.notificationCache.size;
    const allNotificationIds = Array.from(this.notificationCache.keys());
    this.removeNotificationsFromCache(allNotificationIds);

    // Appeler le backend pour supprimer toutes les notifications
    return this.apollo
      .mutate<{
        deleteAllNotifications: {
          success: boolean;
          count: number;
          message: string;
        };
      }>({
        mutation: DELETE_ALL_NOTIFICATIONS_MUTATION,
      })
      .pipe(
        map((result) => {
          const response = result.data?.deleteAllNotifications;
          if (!response) {
            throw new Error('Réponse de suppression invalide');
          }

          this.logger.debug(
            'MessageService',
            'Résultat de la suppression de toutes les notifications:',
            response
          );

          return response;
        }),
        catchError((error) =>
          this.handleDeletionError(
            error,
            'la suppression de toutes les notifications',
            {
              success: true,
              count,
              message: `${count} notifications supprimées localement (erreur serveur)`,
            }
          )
        )
      );
  }

  /**
   * Supprime plusieurs notifications
   * @param notificationIds IDs des notifications à supprimer
   * @returns Observable avec le résultat de l'opération
   */
  deleteMultipleNotifications(
    notificationIds: string[]
  ): Observable<{ success: boolean; count: number; message: string }> {
    this.logger.debug(
      'MessageService',
      `Suppression de ${notificationIds.length} notifications`
    );

    if (!notificationIds || notificationIds.length === 0) {
      this.logger.warn('MessageService', 'Aucun ID de notification fourni');
      return throwError(() => new Error('Aucun ID de notification fourni'));
    }

    // Supprimer localement d'abord pour une meilleure expérience utilisateur
    const count = this.removeNotificationsFromCache(notificationIds);

    // Appeler le backend pour supprimer les notifications
    return this.apollo
      .mutate<{
        deleteMultipleNotifications: {
          success: boolean;
          count: number;
          message: string;
        };
      }>({
        mutation: DELETE_MULTIPLE_NOTIFICATIONS_MUTATION,
        variables: { notificationIds },
      })
      .pipe(
        map((result) => {
          const response = result.data?.deleteMultipleNotifications;
          if (!response) {
            throw new Error('Réponse de suppression invalide');
          }

          this.logger.debug(
            'MessageService',
            'Résultat de la suppression multiple:',
            response
          );

          return response;
        }),
        catchError((error) =>
          this.handleDeletionError(
            error,
            'la suppression multiple de notifications',
            {
              success: count > 0,
              count,
              message: `${count} notifications supprimées localement (erreur serveur)`,
            }
          )
        )
      );
  }
  groupNotificationsByType(): Observable<
    Map<NotificationType, Notification[]>
  > {
    return this.notifications$.pipe(
      map((notifications) => {
        const groups = new Map<NotificationType, Notification[]>();
        notifications.forEach((notif) => {
          if (!groups.has(notif.type)) {
            groups.set(notif.type, []);
          }
          groups.get(notif.type)?.push(notif);
        });
        return groups;
      })
    );
  }
  markAsRead(notificationIds: string[]): Observable<{
    success: boolean;
    readCount: number;
    remainingCount: number;
  }> {
    this.logger.debug(
      'MessageService',
      `Marking notifications as read: ${notificationIds?.join(', ') || 'none'}`
    );

    if (!notificationIds || notificationIds.length === 0) {
      this.logger.warn('MessageService', 'No notification IDs provided');
      return of({
        success: false,
        readCount: 0,
        remainingCount: this.notificationCount.value,
      });
    }

    // Vérifier que tous les IDs sont valides
    const validIds = notificationIds.filter(
      (id) => id && typeof id === 'string' && id.trim() !== ''
    );

    if (validIds.length !== notificationIds.length) {
      this.logger.error('MessageService', 'Some notification IDs are invalid', {
        provided: notificationIds,
        valid: validIds,
      });
      return throwError(() => new Error('Some notification IDs are invalid'));
    }

    this.logger.debug(
      'MessageService',
      'Sending mutation to mark notifications as read',
      validIds
    );

    // Mettre à jour localement d'abord pour une meilleure expérience utilisateur
    this.updateNotificationStatus(validIds, true);

    // Créer une réponse optimiste
    const optimisticResponse = {
      markNotificationsAsRead: {
        success: true,
        readCount: validIds.length,
        remainingCount: Math.max(
          0,
          this.notificationCount.value - validIds.length
        ),
      },
    };

    // Afficher des informations de débogage supplémentaires
    console.log('Sending markNotificationsAsRead mutation with variables:', {
      notificationIds: validIds,
    });
    console.log('Using mutation:', MARK_NOTIFICATION_READ_MUTATION);

    return this.apollo
      .mutate<MarkNotificationsAsReadResponse>({
        mutation: MARK_NOTIFICATION_READ_MUTATION,
        variables: { notificationIds: validIds },
        optimisticResponse: optimisticResponse,
        errorPolicy: 'all', // Continuer même en cas d'erreur
        fetchPolicy: 'no-cache', // Ne pas utiliser le cache pour cette mutation
      })
      .pipe(
        map((result) => {
          this.logger.debug('MessageService', 'Mutation result', result);
          console.log('Mutation result:', result);

          // Si nous avons des erreurs GraphQL, les logger mais continuer
          if (result.errors) {
            this.logger.error(
              'MessageService',
              'GraphQL errors:',
              result.errors
            );
            console.error('GraphQL errors:', result.errors);
          }

          // Utiliser la réponse du serveur ou notre réponse optimiste
          const response =
            result.data?.markNotificationsAsRead ??
            optimisticResponse.markNotificationsAsRead;

          return response;
        }),
        catchError((error: Error) => {
          this.logger.error(
            'MessageService',
            'Error marking notifications as read:',
            error
          );
          console.error('Error in markAsRead:', error);

          // En cas d'erreur, retourner quand même un succès simulé
          // puisque nous avons déjà mis à jour l'interface utilisateur
          return of({
            success: true,
            readCount: validIds.length,
            remainingCount: Math.max(
              0,
              this.notificationCount.value - validIds.length
            ),
          });
        })
      );
  }
  // --------------------------------------------------------------------------
  // Section 3: Méthodes pour les Appels
  // --------------------------------------------------------------------------

  /**
   * Initie un appel avec un autre utilisateur
   * @param recipientId ID de l'utilisateur à appeler
   * @param callType Type d'appel (audio, vidéo)
   * @param conversationId ID de la conversation (optionnel)
   * @param options Options d'appel (optionnel)
   * @returns Observable avec les informations de l'appel
   */
  initiateCall(
    recipientId: string,
    callType: CallType,
    conversationId?: string,
    options?: CallOptions
  ): Observable<Call> {
    return this.setupMediaDevices(callType).pipe(
      switchMap((stream) => {
        this.localStream = stream;
        this.localStream$.next(stream);

        // Créer une connexion peer
        this.peerConnection = new RTCPeerConnection(this.rtcConfig);

        // Ajouter les pistes audio/vidéo
        stream.getTracks().forEach((track) => {
          this.peerConnection!.addTrack(track, stream);
        });

        // Écouter les candidats ICE
        this.peerConnection.onicecandidate = (event) => {
          if (event.candidate) {
            this.sendCallSignal(
              this.generateCallId(),
              'ice-candidate',
              JSON.stringify(event.candidate)
            );
          }
        };

        // Écouter les pistes distantes
        this.peerConnection.ontrack = (event) => {
          if (!this.remoteStream) {
            this.remoteStream = new MediaStream();
            this.remoteStream$.next(this.remoteStream);
          }
          event.streams[0].getTracks().forEach((track) => {
            this.remoteStream!.addTrack(track);
          });
        };

        // Créer l'offre SDP
        return from(this.peerConnection.createOffer()).pipe(
          switchMap((offer) => {
            return from(this.peerConnection!.setLocalDescription(offer)).pipe(
              map(() => offer)
            );
          })
        );
      }),
      switchMap((offer) => {
        // Générer un ID d'appel unique
        const callId = this.generateCallId();

        // Envoyer l'offre au serveur
        return this.apollo
          .mutate<{ initiateCall: Call }>({
            mutation: INITIATE_CALL_MUTATION,
            variables: {
              recipientId,
              callType,
              callId,
              offer: JSON.stringify(offer),
              conversationId,
              options,
            },
          })
          .pipe(
            map((result) => {
              const call = result.data?.initiateCall;
              if (!call) {
                throw new Error('Failed to initiate call');
              }

              // Mettre à jour l'état de l'appel actif
              this.activeCall.next(call);

              // S'abonner aux signaux d'appel
              const signalSub = this.subscribeToCallSignals(
                call.id
              ).subscribe();
              this.subscriptions.push(signalSub);

              return call;
            })
          );
      }),
      catchError((error) => {
        this.logger.error('Error initiating call', error);
        this.cleanupCall();
        return throwError(() => new Error('Failed to initiate call'));
      })
    );
  }

  /**
   * Accepte un appel entrant
   * @param incomingCall Appel entrant à accepter
   * @returns Observable avec les informations de l'appel
   */
  acceptCall(incomingCall: IncomingCall): Observable<Call> {
    this.stop('ringtone');

    return this.setupMediaDevices(incomingCall.type).pipe(
      switchMap((stream) => {
        this.localStream = stream;
        this.localStream$.next(stream);

        // Créer une connexion peer
        this.peerConnection = new RTCPeerConnection(this.rtcConfig);

        // Ajouter les pistes audio/vidéo
        stream.getTracks().forEach((track) => {
          this.peerConnection!.addTrack(track, stream);
        });

        // Écouter les candidats ICE
        this.peerConnection.onicecandidate = (event) => {
          if (event.candidate) {
            this.sendCallSignal(
              incomingCall.id,
              'ice-candidate',
              JSON.stringify(event.candidate)
            );
          }
        };

        // Écouter les pistes distantes
        this.peerConnection.ontrack = (event) => {
          if (!this.remoteStream) {
            this.remoteStream = new MediaStream();
            this.remoteStream$.next(this.remoteStream);
          }
          event.streams[0].getTracks().forEach((track) => {
            this.remoteStream!.addTrack(track);
          });
        };

        // Définir l'offre distante
        const offer = JSON.parse(incomingCall.offer);
        return from(
          this.peerConnection.setRemoteDescription(
            new RTCSessionDescription(offer)
          )
        ).pipe(
          switchMap(() => from(this.peerConnection!.createAnswer())),
          switchMap((answer) => {
            return from(this.peerConnection!.setLocalDescription(answer)).pipe(
              map(() => answer)
            );
          })
        );
      }),
      switchMap((answer) => {
        // Envoyer la réponse au serveur
        return this.apollo
          .mutate<{ acceptCall: Call }>({
            mutation: ACCEPT_CALL_MUTATION,
            variables: {
              callId: incomingCall.id,
              answer: JSON.stringify(answer),
            },
          })
          .pipe(
            map((result) => {
              const call = result.data?.acceptCall;
              if (!call) {
                throw new Error('Failed to accept call');
              }

              // Jouer le son de connexion
              this.play('call-connected');

              // Mettre à jour l'état de l'appel actif
              this.activeCall.next({
                ...call,
                caller: incomingCall.caller,
                type: incomingCall.type,
                conversationId: incomingCall.conversationId,
              });

              // S'abonner aux signaux d'appel
              const signalSub = this.subscribeToCallSignals(
                incomingCall.id
              ).subscribe();
              this.subscriptions.push(signalSub);

              // Effacer l'appel entrant
              this.incomingCall.next(null);

              return call;
            })
          );
      }),
      catchError((error) => {
        this.logger.error('Error accepting call', error);
        this.cleanupCall();
        return throwError(() => new Error('Failed to accept call'));
      })
    );
  }

  /**
   * Rejette un appel entrant
   * @param callId ID de l'appel à rejeter
   * @param reason Raison du rejet (optionnel)
   * @returns Observable avec les informations de l'appel
   */
  rejectCall(callId: string, reason?: string): Observable<Call> {
    this.stop('ringtone');

    return this.apollo
      .mutate<{ rejectCall: Call }>({
        mutation: REJECT_CALL_MUTATION,
        variables: {
          callId,
          reason,
        },
      })
      .pipe(
        map((result) => {
          const call = result.data?.rejectCall;
          if (!call) {
            throw new Error('Failed to reject call');
          }

          // Effacer l'appel entrant
          this.incomingCall.next(null);

          return call;
        }),
        catchError((error) => {
          this.logger.error('Error rejecting call', error);
          return throwError(() => new Error('Failed to reject call'));
        })
      );
  }

  /**
   * Termine un appel en cours
   * @param callId ID de l'appel à terminer
   * @param feedback Commentaires sur l'appel (optionnel)
   * @returns Observable avec les informations de l'appel
   */
  endCall(callId: string, feedback?: CallFeedback): Observable<Call> {
    this.stop('ringtone');
    this.play('call-end');

    return this.apollo
      .mutate<{ endCall: Call }>({
        mutation: END_CALL_MUTATION,
        variables: {
          callId,
          feedback,
        },
      })
      .pipe(
        map((result) => {
          const call = result.data?.endCall;
          if (!call) {
            throw new Error('Failed to end call');
          }

          // Nettoyer les ressources
          this.cleanupCall();

          // Mettre à jour l'état de l'appel actif
          this.activeCall.next(null);

          return call;
        }),
        catchError((error) => {
          this.logger.error('Error ending call', error);
          this.cleanupCall();
          return throwError(() => new Error('Failed to end call'));
        })
      );
  }

  /**
   * Active ou désactive la caméra ou le micro
   * @param callId ID de l'appel
   * @param video État de la caméra (optionnel)
   * @param audio État du micro (optionnel)
   * @returns Observable avec le résultat de l'opération
   */
  toggleMedia(
    callId: string,
    video?: boolean,
    audio?: boolean
  ): Observable<CallSuccess> {
    if (this.localStream) {
      // Mettre à jour les pistes locales
      if (video !== undefined) {
        this.localStream.getVideoTracks().forEach((track) => {
          track.enabled = video;
        });
      }

      if (audio !== undefined) {
        this.localStream.getAudioTracks().forEach((track) => {
          track.enabled = audio;
        });
      }
    }

    return this.apollo
      .mutate<{ toggleCallMedia: CallSuccess }>({
        mutation: TOGGLE_CALL_MEDIA_MUTATION,
        variables: {
          callId,
          video,
          audio,
        },
      })
      .pipe(
        map((result) => {
          const success = result.data?.toggleCallMedia;
          if (!success) {
            throw new Error('Failed to toggle media');
          }
          return success;
        }),
        catchError((error) => {
          this.logger.error('Error toggling media', error);
          return throwError(() => new Error('Failed to toggle media'));
        })
      );
  }

  /**
   * S'abonne aux signaux d'appel
   * @param callId ID de l'appel
   * @returns Observable avec les signaux d'appel
   */
  subscribeToCallSignals(callId: string): Observable<CallSignal> {
    return this.apollo
      .subscribe<{ callSignal: CallSignal }>({
        query: CALL_SIGNAL_SUBSCRIPTION,
        variables: { callId },
      })
      .pipe(
        map(({ data }) => {
          if (!data?.callSignal) {
            throw new Error('No call signal received');
          }
          return data.callSignal;
        }),
        tap((signal) => {
          this.callSignals.next(signal);
          this.handleCallSignal(signal);
        }),
        catchError((error) => {
          this.logger.error('Error in call signal subscription', error);
          return throwError(() => new Error('Call signal subscription failed'));
        })
      );
  }

  /**
   * Envoie un signal d'appel
   * @param callId ID de l'appel
   * @param signalType Type de signal
   * @param signalData Données du signal
   * @returns Observable avec le résultat de l'opération
   */
  sendCallSignal(
    callId: string,
    signalType: string,
    signalData: string
  ): Observable<CallSuccess> {
    return this.apollo
      .mutate<{ sendCallSignal: CallSuccess }>({
        mutation: SEND_CALL_SIGNAL_MUTATION,
        variables: {
          callId,
          signalType,
          signalData,
        },
      })
      .pipe(
        map((result) => {
          const success = result.data?.sendCallSignal;
          if (!success) {
            throw new Error('Failed to send call signal');
          }
          return success;
        }),
        catchError((error) => {
          this.logger.error('Error sending call signal', error);
          return throwError(() => new Error('Failed to send call signal'));
        })
      );
  }

  /**
   * Récupère l'historique des appels avec filtres
   * @param limit Nombre d'appels à récupérer
   * @param offset Décalage pour la pagination
   * @param status Filtres de statut
   * @param type Filtres de type
   * @param startDate Date de début
   * @param endDate Date de fin
   * @returns Observable avec l'historique des appels
   */
  getCallHistory(
    limit: number = 20,
    offset: number = 0,
    status?: string[],
    type?: string[],
    startDate?: string | null,
    endDate?: string | null
  ): Observable<Call[]> {
    return this.apollo
      .watchQuery<{ callHistory: Call[] }>({
        query: CALL_HISTORY_QUERY,
        variables: {
          limit,
          offset,
          status,
          type,
          startDate,
          endDate,
        },
        fetchPolicy: 'network-only',
      })
      .valueChanges.pipe(
        map((result) => {
          const history = result.data?.callHistory || [];
          this.logger.debug(`Retrieved ${history.length} call history items`);
          return history;
        }),
        catchError((error) => {
          this.logger.error('Error fetching call history:', error);
          return throwError(() => new Error('Failed to fetch call history'));
        })
      );
  }

  /**
   * Récupère les détails d'un appel spécifique
   * @param callId ID de l'appel
   * @returns Observable avec les détails de l'appel
   */
  getCallDetails(callId: string): Observable<Call> {
    return this.apollo
      .watchQuery<{ callDetails: Call }>({
        query: CALL_DETAILS_QUERY,
        variables: { callId },
        fetchPolicy: 'network-only',
      })
      .valueChanges.pipe(
        map((result) => {
          const details = result.data?.callDetails;
          if (!details) {
            throw new Error('Call details not found');
          }
          this.logger.debug(`Retrieved call details for: ${callId}`);
          return details;
        }),
        catchError((error) => {
          this.logger.error('Error fetching call details:', error);
          return throwError(() => new Error('Failed to fetch call details'));
        })
      );
  }

  /**
   * Récupère les statistiques d'appels
   * @returns Observable avec les statistiques d'appels
   */
  getCallStats(): Observable<any> {
    return this.apollo
      .watchQuery<{ callStats: any }>({
        query: CALL_STATS_QUERY,
        fetchPolicy: 'network-only',
      })
      .valueChanges.pipe(
        map((result) => {
          const stats = result.data?.callStats;
          if (!stats) {
            throw new Error('Call stats not found');
          }
          this.logger.debug('Retrieved call stats:', stats);
          return stats;
        }),
        catchError((error) => {
          this.logger.error('Error fetching call stats:', error);
          return throwError(() => new Error('Failed to fetch call stats'));
        })
      );
  }

  /**
   * Gère un signal d'appel reçu
   * @param signal Signal d'appel
   */
  private handleCallSignal(signal: CallSignal): void {
    switch (signal.type) {
      case 'ice-candidate':
        this.handleIceCandidate(signal);
        break;
      case 'answer':
        this.handleAnswer(signal);
        break;
      case 'end-call':
        this.handleEndCall(signal);
        break;
      case 'reject':
        this.handleRejectCall(signal);
        break;
      default:
        this.logger.debug(`Unhandled signal type: ${signal.type}`, signal);
    }
  }

  /**
   * Gère un candidat ICE reçu
   * @param signal Signal d'appel contenant un candidat ICE
   */
  private handleIceCandidate(signal: CallSignal): void {
    if (!this.peerConnection) {
      this.logger.error('No peer connection available for ICE candidate');
      return;
    }

    try {
      const candidate = JSON.parse(signal.data);
      this.peerConnection
        .addIceCandidate(new RTCIceCandidate(candidate))
        .catch((error) => {
          this.logger.error('Error adding ICE candidate', error as Error);
        });
    } catch (error) {
      this.logger.error('Error parsing ICE candidate', error as Error);
    }
  }

  /**
   * Gère une réponse SDP reçue
   * @param signal Signal d'appel contenant une réponse SDP
   */
  private handleAnswer(signal: CallSignal): void {
    if (!this.peerConnection) {
      this.logger.error('No peer connection available for answer');
      return;
    }

    try {
      const answer = JSON.parse(signal.data);
      this.peerConnection
        .setRemoteDescription(new RTCSessionDescription(answer))
        .catch((error) => {
          this.logger.error('Error setting remote description', error as Error);
        });
    } catch (error) {
      this.logger.error('Error parsing answer', error as Error);
    }
  }

  /**
   * Gère la fin d'un appel
   * @param signal Signal d'appel indiquant la fin de l'appel
   */
  private handleEndCall(signal: CallSignal): void {
    this.stop('ringtone');
    this.cleanupCall();

    // Mettre à jour l'état de l'appel actif
    const currentCall = this.activeCall.value;
    if (currentCall && currentCall.id === signal.callId) {
      this.activeCall.next({
        ...currentCall,
        status: CallStatus.ENDED,
        endTime: new Date().toISOString(),
      });
    }
  }

  /**
   * Gère le rejet d'un appel
   * @param signal Signal d'appel indiquant le rejet de l'appel
   */
  private handleRejectCall(signal: CallSignal): void {
    this.stop('ringtone');
    this.cleanupCall();

    // Mettre à jour l'état de l'appel actif
    const currentCall = this.activeCall.value;
    if (currentCall && currentCall.id === signal.callId) {
      this.activeCall.next({
        ...currentCall,
        status: CallStatus.REJECTED,
        endTime: new Date().toISOString(),
      });
    }
  }

  /**
   * Nettoie les ressources d'appel
   */
  private cleanupCall(): void {
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
      this.localStream$.next(null);
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.remoteStream = null;
    this.remoteStream$.next(null);
  }

  /**
   * Configure les périphériques média pour un appel
   * @param callType Type d'appel (audio, vidéo)
   * @returns Observable avec le flux média
   */
  private setupMediaDevices(callType: CallType): Observable<MediaStream> {
    const constraints: MediaStreamConstraints = {
      audio: true,
      video:
        callType !== CallType.AUDIO
          ? {
              width: { ideal: 1280 },
              height: { ideal: 720 },
            }
          : false,
    };

    return new Observable<MediaStream>((observer) => {
      navigator.mediaDevices
        .getUserMedia(constraints)
        .then((stream) => {
          observer.next(stream);
          observer.complete();
        })
        .catch((error) => {
          this.logger.error('Error accessing media devices', error);
          observer.error(new Error('Failed to access media devices'));
        });
    });
  }

  /**
   * Génère un ID d'appel unique
   * @returns ID d'appel unique
   */
  private generateCallId(): string {
    return Date.now().toString() + Math.random().toString(36).substring(2, 9);
  }

  // --------------------------------------------------------------------------
  // Section 4: Méthodes pour les Utilisateurs/Groupes
  // --------------------------------------------------------------------------
  // User methods
  getAllUsers(
    forceRefresh = false,
    search?: string,
    page: number = 1,
    limit: number = 10,
    sortBy: string = 'username',
    sortOrder: string = 'asc',
    isOnline?: boolean
  ): Observable<User[]> {
    this.logger.info(
      'MessageService',
      `Getting users with params: forceRefresh=${forceRefresh}, search=${
        search || '(empty)'
      }, page=${page}, limit=${limit}, sortBy=${sortBy}, sortOrder=${sortOrder}, isOnline=${isOnline}`
    );

    const now = Date.now();
    const cacheValid =
      !forceRefresh &&
      this.usersCache.length > 0 &&
      now - this.lastFetchTime <= this.CACHE_DURATION &&
      !search &&
      page === 1 &&
      limit >= this.usersCache.length;

    // Use cache only for first page with no filters
    if (cacheValid) {
      this.logger.debug(
        'MessageService',
        `Using cached users (${this.usersCache.length} users)`
      );
      return of([...this.usersCache]);
    }

    this.logger.debug(
      'MessageService',
      `Fetching users from server with pagination, fetchPolicy=${
        forceRefresh ? 'network-only' : 'cache-first'
      }`
    );

    return this.apollo
      .watchQuery<any>({
        query: GET_ALL_USER_QUERY,
        variables: {
          search,
          page,
          limit,
          sortBy,
          sortOrder,
          isOnline: isOnline !== undefined ? isOnline : null,
        },
        fetchPolicy: forceRefresh ? 'network-only' : 'cache-first',
      })
      .valueChanges.pipe(
        map((result) => {
          this.logger.debug(
            'MessageService',
            'Users response received',
            result
          );

          if (result.errors) {
            this.logger.error(
              'MessageService',
              'GraphQL errors in getAllUsers:',
              result.errors
            );
            throw new Error(result.errors.map((e) => e.message).join(', '));
          }

          if (!result.data?.getAllUsers) {
            this.logger.warn(
              'MessageService',
              'No users data received from server'
            );
            return [];
          }

          const paginatedResponse = result.data.getAllUsers;

          // Log pagination metadata
          this.logger.debug('MessageService', 'Pagination metadata:', {
            totalCount: paginatedResponse.totalCount,
            totalPages: paginatedResponse.totalPages,
            currentPage: paginatedResponse.currentPage,
            hasNextPage: paginatedResponse.hasNextPage,
            hasPreviousPage: paginatedResponse.hasPreviousPage,
          });

          // Normalize users with error handling
          const users: User[] = [];
          for (const user of paginatedResponse.users) {
            try {
              if (user) {
                users.push(this.normalizeUser(user));
              }
            } catch (error) {
              this.logger.warn(
                'MessageService',
                `Error normalizing user, skipping:`,
                error
              );
            }
          }

          this.logger.info(
            'MessageService',
            `Received ${users.length} users from server (page ${paginatedResponse.currentPage} of ${paginatedResponse.totalPages})`
          );

          // Update cache only for first page with no filters
          if (!search && page === 1 && !isOnline) {
            this.usersCache = [...users];
            this.lastFetchTime = Date.now();
            this.logger.debug(
              'MessageService',
              `User cache updated with ${users.length} users`
            );
          }

          // Store pagination metadata in a property for component access
          this.currentUserPagination = {
            totalCount: paginatedResponse.totalCount,
            totalPages: paginatedResponse.totalPages,
            currentPage: paginatedResponse.currentPage,
            hasNextPage: paginatedResponse.hasNextPage,
            hasPreviousPage: paginatedResponse.hasPreviousPage,
          };

          return users;
        }),
        catchError((error) => {
          this.logger.error('MessageService', 'Error fetching users:', error);

          if (error.graphQLErrors) {
            this.logger.error(
              'MessageService',
              'GraphQL errors:',
              error.graphQLErrors
            );
          }

          if (error.networkError) {
            this.logger.error(
              'MessageService',
              'Network error:',
              error.networkError
            );
          }

          // Return cache if available (only for first page)
          if (
            this.usersCache.length > 0 &&
            page === 1 &&
            !search &&
            !isOnline
          ) {
            this.logger.warn(
              'MessageService',
              `Returning ${this.usersCache.length} cached users due to fetch error`
            );
            return of([...this.usersCache]);
          }

          return throwError(
            () =>
              new Error(
                `Failed to fetch users: ${error.message || 'Unknown error'}`
              )
          );
        })
      );
  }
  getOneUser(userId: string): Observable<User> {
    return this.apollo
      .watchQuery<GetOneUserResponse>({
        query: GET_USER_QUERY,
        variables: { id: userId },
        fetchPolicy: 'network-only',
      })
      .valueChanges.pipe(
        map((result) => this.normalizeUser(result.data?.getOneUser)),
        catchError((error) => {
          this.logger.error('MessageService', 'Error fetching user:', error);
          return throwError(() => new Error('Failed to fetch user'));
        })
      );
  }
  getCurrentUser(): Observable<User> {
    return this.apollo
      .watchQuery<getCurrentUserResponse>({
        query: GET_CURRENT_USER_QUERY,
        fetchPolicy: 'network-only',
      })
      .valueChanges.pipe(
        map((result) => this.normalizeUser(result.data?.getCurrentUser)),
        catchError((error) => {
          this.logger.error(
            'MessageService',
            'Error fetching current user:',
            error
          );
          return throwError(() => new Error('Failed to fetch current user'));
        })
      );
  }
  setUserOnline(userId: string): Observable<User> {
    return this.apollo
      .mutate<SetUserOnlineResponse>({
        mutation: SET_USER_ONLINE_MUTATION,
        variables: { userId },
      })
      .pipe(
        map((result) => {
          if (!result.data?.setUserOnline)
            throw new Error('Failed to set user online');
          return this.normalizeUser(result.data.setUserOnline);
        }),
        catchError((error) => {
          this.logger.error(
            'MessageService',
            'Error setting user online:',
            error
          );
          return throwError(() => new Error('Failed to set user online'));
        })
      );
  }
  setUserOffline(userId: string): Observable<User> {
    return this.apollo
      .mutate<SetUserOfflineResponse>({
        mutation: SET_USER_OFFLINE_MUTATION,
        variables: { userId },
      })
      .pipe(
        map((result) => {
          if (!result.data?.setUserOffline)
            throw new Error('Failed to set user offline');
          return this.normalizeUser(result.data.setUserOffline);
        }),
        catchError((error) => {
          this.logger.error(
            'MessageService',
            'Error setting user offline:',
            error
          );
          return throwError(() => new Error('Failed to set user offline'));
        })
      );
  }

  // --------------------------------------------------------------------------
  // Section: Gestion des Groupes
  // --------------------------------------------------------------------------

  /**
   * Crée un nouveau groupe
   */
  createGroup(
    name: string,
    participantIds: string[],
    photo?: File,
    description?: string
  ): Observable<any> {
    this.logger.debug(
      'MessageService',
      `Creating group: ${name} with ${participantIds.length} participants`
    );

    if (!name || !participantIds || participantIds.length === 0) {
      return throwError(
        () => new Error('Nom du groupe et participants requis')
      );
    }

    return this.apollo
      .mutate({
        mutation: CREATE_GROUP_MUTATION,
        variables: { name, participantIds, photo, description },
      })
      .pipe(
        map((result: any) => {
          const group = result.data?.createGroup;
          if (!group) {
            throw new Error('Échec de la création du groupe');
          }
          this.logger.info(
            'MessageService',
            `Group created successfully: ${group.id}`
          );
          return group;
        }),
        catchError((error) => {
          this.logger.error('MessageService', 'Error creating group:', error);
          return throwError(() => new Error('Échec de la création du groupe'));
        })
      );
  }

  /**
   * Met à jour un groupe existant
   */
  updateGroup(groupId: string, input: any): Observable<any> {
    this.logger.debug('MessageService', `Updating group: ${groupId}`);

    if (!groupId) {
      return throwError(() => new Error('ID du groupe requis'));
    }

    return this.apollo
      .mutate({
        mutation: UPDATE_GROUP_MUTATION,
        variables: { id: groupId, input },
      })
      .pipe(
        map((result: any) => {
          const group = result.data?.updateGroup;
          if (!group) {
            throw new Error('Échec de la mise à jour du groupe');
          }
          this.logger.info(
            'MessageService',
            `Group updated successfully: ${group.id}`
          );
          return group;
        }),
        catchError((error) => {
          this.logger.error('MessageService', 'Error updating group:', error);
          return throwError(
            () => new Error('Échec de la mise à jour du groupe')
          );
        })
      );
  }

  /**
   * Supprime un groupe
   */
  deleteGroup(
    groupId: string
  ): Observable<{ success: boolean; message: string }> {
    this.logger.debug('MessageService', `Deleting group: ${groupId}`);

    if (!groupId) {
      return throwError(() => new Error('ID du groupe requis'));
    }

    return this.apollo
      .mutate({
        mutation: DELETE_GROUP_MUTATION,
        variables: { id: groupId },
      })
      .pipe(
        map((result: any) => {
          const response = result.data?.deleteGroup;
          if (!response) {
            throw new Error('Échec de la suppression du groupe');
          }
          this.logger.info(
            'MessageService',
            `Group deleted successfully: ${groupId}`
          );
          return response;
        }),
        catchError((error) => {
          this.logger.error('MessageService', 'Error deleting group:', error);
          return throwError(
            () => new Error('Échec de la suppression du groupe')
          );
        })
      );
  }

  /**
   * Quitte un groupe
   */
  leaveGroup(
    groupId: string
  ): Observable<{ success: boolean; message: string }> {
    this.logger.debug('MessageService', `Leaving group: ${groupId}`);

    if (!groupId) {
      return throwError(() => new Error('ID du groupe requis'));
    }

    return this.apollo
      .mutate({
        mutation: LEAVE_GROUP_MUTATION,
        variables: { groupId },
      })
      .pipe(
        map((result: any) => {
          const response = result.data?.leaveGroup;
          if (!response) {
            throw new Error('Échec de la sortie du groupe');
          }
          this.logger.info(
            'MessageService',
            `Left group successfully: ${groupId}`
          );
          return response;
        }),
        catchError((error) => {
          this.logger.error('MessageService', 'Error leaving group:', error);
          return throwError(() => new Error('Échec de la sortie du groupe'));
        })
      );
  }

  /**
   * Récupère les informations d'un groupe
   */
  getGroup(groupId: string): Observable<any> {
    this.logger.debug('MessageService', `Getting group: ${groupId}`);

    if (!groupId) {
      return throwError(() => new Error('ID du groupe requis'));
    }

    return this.apollo
      .query({
        query: GET_GROUP_QUERY,
        variables: { id: groupId },
        fetchPolicy: 'network-only',
      })
      .pipe(
        map((result: any) => {
          const group = result.data?.getGroup;
          if (!group) {
            throw new Error('Groupe non trouvé');
          }
          this.logger.info(
            'MessageService',
            `Group retrieved successfully: ${groupId}`
          );
          return group;
        }),
        catchError((error) => {
          this.logger.error('MessageService', 'Error getting group:', error);
          return throwError(
            () => new Error('Échec de la récupération du groupe')
          );
        })
      );
  }

  /**
   * Récupère les groupes d'un utilisateur
   */
  getUserGroups(userId: string): Observable<any[]> {
    this.logger.debug('MessageService', `Getting groups for user: ${userId}`);

    if (!userId) {
      return throwError(() => new Error("ID de l'utilisateur requis"));
    }

    return this.apollo
      .query({
        query: GET_USER_GROUPS_QUERY,
        variables: { userId },
        fetchPolicy: 'network-only',
      })
      .pipe(
        map((result: any) => {
          const groups = result.data?.getUserGroups || [];
          this.logger.info(
            'MessageService',
            `Retrieved ${groups.length} groups for user: ${userId}`
          );
          return groups;
        }),
        catchError((error) => {
          this.logger.error(
            'MessageService',
            'Error getting user groups:',
            error
          );
          return throwError(
            () => new Error('Échec de la récupération des groupes')
          );
        })
      );
  }

  // --------------------------------------------------------------------------
  // Section 4: Subscriptions et Gestion Temps Réel
  // --------------------------------------------------------------------------
  subscribeToNewMessages(conversationId: string): Observable<Message> {
    console.log(
      `🔍 DEBUG: subscribeToNewMessages called with conversationId: ${conversationId}`
    );

    // Vérifier si l'utilisateur est connecté avec un token valide
    const tokenValid = this.isTokenValid();
    console.log(`🔍 DEBUG: Token validation result: ${tokenValid}`);

    if (!tokenValid) {
      console.warn(
        '❌ DEBUG: Token invalid - subscription will not be established'
      );
      this.logger.warn(
        "Tentative d'abonnement aux messages avec un token invalide ou expiré"
      );
      return of(null as unknown as Message);
    }

    console.log(
      `✅ DEBUG: Token valid - proceeding with subscription setup for conversation: ${conversationId}`
    );
    this.logger.debug(
      `🚀 INSTANT MESSAGE: Setting up real-time subscription for conversation: ${conversationId}`
    );

    console.log(`🔍 DEBUG: Creating Apollo subscription with variables:`, {
      conversationId,
    });
    console.log(
      `🔍 DEBUG: MESSAGE_SENT_SUBSCRIPTION query:`,
      MESSAGE_SENT_SUBSCRIPTION
    );
    console.log(`🔍 DEBUG: Subscription variables:`, { conversationId });

    const sub$ = this.apollo
      .subscribe<{ messageSent: Message }>({
        query: MESSAGE_SENT_SUBSCRIPTION,
        variables: { conversationId },
      })
      .pipe(
        tap((result) => {
          console.log(`🔍 DEBUG: Raw subscription result received:`, result);
          console.log(`🔍 DEBUG: result.data:`, result.data);
          console.log(
            `🔍 DEBUG: result.data?.messageSent:`,
            result.data?.messageSent
          );
        }),
        map((result) => {
          const msg = result.data?.messageSent;
          if (!msg) {
            console.log(
              `❌ DEBUG: No message payload received in result:`,
              result
            );
            this.logger.warn('⚠️ No message payload received');
            throw new Error('No message payload received');
          }

          this.logger.debug(
            '⚡ INSTANT: New message received via WebSocket',
            msg
          );

          // Vérifier que l'ID est présent
          if (!msg.id && !msg._id) {
            this.logger.warn(
              '⚠️ Message without ID received, generating temp ID'
            );
            msg.id = `temp-${Date.now()}`;
          }

          try {
            // NORMALISATION RAPIDE du message
            const normalizedMessage = this.normalizeMessage(msg);

            this.logger.debug(
              '✅ INSTANT: Message normalized successfully',
              normalizedMessage
            );

            // TRAITEMENT INSTANTANÉ selon le type
            if (
              normalizedMessage.type === MessageType.AUDIO ||
              normalizedMessage.type === MessageType.VOICE_MESSAGE ||
              (normalizedMessage.attachments &&
                normalizedMessage.attachments.some(
                  (att) => att.type === 'AUDIO'
                ))
            ) {
              this.logger.debug(
                '🎤 INSTANT: Voice message received in real-time'
              );
            }

            // MISE À JOUR IMMÉDIATE de l'UI
            this.zone.run(() => {
              this.logger.debug(
                '📡 INSTANT: Updating conversation UI immediately'
              );
              this.updateConversationWithNewMessage(
                conversationId,
                normalizedMessage
              );
            });

            return normalizedMessage;
          } catch (err) {
            this.logger.error('❌ Error normalizing message:', err);

            // Créer un message minimal mais valide pour éviter les erreurs
            const minimalMessage: Message = {
              id: msg.id || msg._id || `temp-${Date.now()}`,
              content: msg.content || '',
              type: msg.type || MessageType.TEXT,
              timestamp: this.safeDate(msg.timestamp),
              isRead: false,
              sender: msg.sender
                ? this.normalizeUser(msg.sender)
                : {
                    id: this.getCurrentUserId(),
                    username: 'Unknown',
                  },
            };

            this.logger.debug(
              '🔧 FALLBACK: Created minimal message',
              minimalMessage
            );
            return minimalMessage;
          }
        }),
        catchError((error) => {
          this.logger.error(
            'MessageService',
            'Message subscription error:',
            error
          );
          // Retourner un observable vide au lieu de null
          return EMPTY;
        }),
        // Filtrer les valeurs null
        filter((message) => !!message),
        // Réessayer après un délai en cas d'erreur
        retry(3)
      );

    console.log(`🔍 DEBUG: Setting up subscription observer...`);

    const sub = sub$.subscribe({
      next: (message) => {
        console.log(`✅ DEBUG: Message received via subscription:`, message);
        // Traitement supplémentaire pour s'assurer que le message est bien affiché
        this.logger.debug('MessageService', 'New message received:', message);

        // Mettre à jour la conversation avec le nouveau message
        this.updateConversationWithNewMessage(conversationId, message);
      },
      error: (err) => {
        console.error(`❌ DEBUG: Subscription error:`, err);
        this.logger.error('Error in message subscription:', err);
      },
      complete: () => {
        console.log(`🔚 DEBUG: Subscription completed`);
      },
    });

    // Log pour confirmer que la subscription est créée
    console.log(`🔗 DEBUG: Subscription object created:`, sub);
    console.log(`🔗 DEBUG: Apollo client state:`, this.apollo);

    this.subscriptions.push(sub);
    console.log(
      `✅ DEBUG: Subscription established and added to subscriptions list. Total subscriptions: ${this.subscriptions.length}`
    );
    return sub$;
  }

  /**
   * Met à jour une conversation avec un nouveau message INSTANTANÉMENT
   * @param conversationId ID de la conversation
   * @param message Nouveau message
   */
  private updateConversationWithNewMessage(
    conversationId: string,
    message: Message
  ): void {
    this.logger.debug(
      `⚡ INSTANT: Updating conversation ${conversationId} with new message ${message.id}`
    );

    // MISE À JOUR IMMÉDIATE sans attendre la requête
    this.zone.run(() => {
      // Émettre IMMÉDIATEMENT l'événement de conversation active
      this.activeConversation.next(conversationId);

      this.logger.debug('📡 INSTANT: Conversation event emitted immediately');
    });

    // Mise à jour en arrière-plan (non-bloquante)
    setTimeout(() => {
      this.getConversation(conversationId).subscribe({
        next: (conversation) => {
          this.logger.debug(
            `✅ BACKGROUND: Conversation ${conversationId} refreshed with ${
              conversation?.messages?.length || 0
            } messages`
          );
        },
        error: (error) => {
          this.logger.error(
            `⚠️ BACKGROUND: Error refreshing conversation ${conversationId}:`,
            error
          );
        },
      });
    }, 0); // Exécution asynchrone immédiate
  }

  /**
   * Rafraîchit les notifications du sender après envoi d'un message
   */
  private refreshSenderNotifications(): void {
    console.log('🔄 SENDER: Refreshing notifications after message sent');

    // Recharger les notifications en arrière-plan
    this.getNotifications(true).subscribe({
      next: (notifications) => {
        console.log(
          '🔄 SENDER: Notifications refreshed successfully',
          notifications.length
        );
      },
      error: (error) => {
        console.error('🔄 SENDER: Error refreshing notifications:', error);
      },
    });
  }

  subscribeToUserStatus(): Observable<User> {
    // Vérifier si l'utilisateur est connecté avec un token valide
    if (!this.isTokenValid()) {
      this.logger.warn(
        "Tentative d'abonnement au statut utilisateur avec un token invalide ou expiré"
      );
      return throwError(() => new Error('Invalid or expired token'));
    }

    this.logger.debug("Démarrage de l'abonnement au statut utilisateur");

    const sub$ = this.apollo
      .subscribe<{ userStatusChanged: User }>({
        query: USER_STATUS_SUBSCRIPTION,
      })
      .pipe(
        tap((result) =>
          this.logger.debug(
            "Données reçues de l'abonnement au statut utilisateur:",
            result
          )
        ),
        map((result) => {
          const user = result.data?.userStatusChanged;
          if (!user) {
            this.logger.error('No status payload received');
            throw new Error('No status payload received');
          }
          return this.normalizeUser(user);
        }),
        catchError((error) => {
          this.logger.error('Status subscription error:', error as Error);
          return throwError(() => new Error('Status subscription failed'));
        }),
        retry(3) // Réessayer 3 fois en cas d'erreur
      );

    const sub = sub$.subscribe();
    this.subscriptions.push(sub);
    return sub$;
  }
  subscribeToConversationUpdates(
    conversationId: string
  ): Observable<Conversation> {
    const sub$ = this.apollo
      .subscribe<{ conversationUpdated: Conversation }>({
        query: CONVERSATION_UPDATED_SUBSCRIPTION,
        variables: { conversationId },
      })
      .pipe(
        map((result) => {
          const conv = result.data?.conversationUpdated;
          if (!conv) throw new Error('No conversation payload received');

          const normalizedConversation: Conversation = {
            ...conv,
            participants:
              conv.participants?.map((p) => this.normalizeUser(p)) || [],
            lastMessage: conv.lastMessage
              ? {
                  ...conv.lastMessage,
                  sender: this.normalizeUser(conv.lastMessage.sender),
                  timestamp: this.safeDate(conv.lastMessage.timestamp),
                  readAt: conv.lastMessage.readAt
                    ? this.safeDate(conv.lastMessage.readAt)
                    : undefined,
                  // Conservez toutes les autres propriétés du message
                  id: conv.lastMessage.id,
                  content: conv.lastMessage.content,
                  type: conv.lastMessage.type,
                  isRead: conv.lastMessage.isRead,
                  // ... autres propriétés nécessaires
                }
              : null, // On conserve null comme dans votre version originale
          };

          return normalizedConversation as Conversation; // Assertion de type si nécessaire
        }),
        catchError((error) => {
          this.logger.error(
            'MessageService',
            'Conversation subscription error:',
            error
          );
          return throwError(
            () => new Error('Conversation subscription failed')
          );
        })
      );

    const sub = sub$.subscribe();
    this.subscriptions.push(sub);
    return sub$;
  }
  subscribeToTypingIndicator(
    conversationId: string
  ): Observable<TypingIndicatorEvent> {
    const sub$ = this.apollo
      .subscribe<TypingIndicatorEvents>({
        query: TYPING_INDICATOR_SUBSCRIPTION,
        variables: { conversationId },
      })
      .pipe(
        map((result) => result.data?.typingIndicator),
        filter(Boolean),
        catchError((error) => {
          this.logger.error(
            'MessageService',
            'Typing indicator subscription error:',
            error
          );
          return throwError(
            () => new Error('Typing indicator subscription failed')
          );
        })
      );

    const sub = sub$.subscribe();
    this.subscriptions.push(sub);
    return sub$;
  }
  private isTokenValid(): boolean {
    const token = localStorage.getItem('token');
    if (!token) {
      this.logger.warn('Aucun token trouvé');
      return false;
    }

    try {
      // Décoder le token JWT (format: header.payload.signature)
      const parts = token.split('.');
      if (parts.length !== 3) {
        this.logger.warn('Format de token invalide');
        return false;
      }

      // Décoder le payload (deuxième partie du token)
      const payload = JSON.parse(atob(parts[1]));

      // Vérifier l'expiration
      if (!payload.exp) {
        this.logger.warn("Token sans date d'expiration");
        return false;
      }

      const expirationDate = new Date(payload.exp * 1000);
      const now = new Date();

      if (expirationDate < now) {
        this.logger.warn('Token expiré', {
          expiration: expirationDate.toISOString(),
          now: now.toISOString(),
        });
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error(
        'Erreur lors de la vérification du token:',
        error as Error
      );
      return false;
    }
  }

  subscribeToNotificationsRead(): Observable<string[]> {
    // Vérifier si l'utilisateur est connecté avec un token valide
    if (!this.isTokenValid()) {
      this.logger.warn(
        "Tentative d'abonnement aux notifications avec un token invalide ou expiré"
      );
      return of([]);
    }

    this.logger.debug("Démarrage de l'abonnement aux notifications lues");

    const sub$ = this.apollo
      .subscribe<NotificationsReadEvent>({
        query: NOTIFICATIONS_READ_SUBSCRIPTION,
      })
      .pipe(
        tap((result) =>
          this.logger.debug(
            "Données reçues de l'abonnement aux notifications lues:",
            result
          )
        ),
        map((result) => {
          const notificationIds = result.data?.notificationsRead || [];
          this.logger.debug(
            'Notifications marquées comme lues:',
            notificationIds
          );
          this.updateNotificationStatus(notificationIds, true);
          return notificationIds;
        }),
        catchError((err) => {
          this.logger.error(
            'Notifications read subscription error:',
            err as Error
          );
          // Retourner un tableau vide au lieu de propager l'erreur
          return of([]);
        }),
        // Réessayer après un délai en cas d'erreur
        retry(3) // Réessayer 3 fois en cas d'erreur
      );

    const sub = sub$.subscribe();
    this.subscriptions.push(sub);
    return sub$;
  }
  subscribeToNewNotifications(): Observable<Notification> {
    // Vérifier si l'utilisateur est connecté
    const token = localStorage.getItem('token');
    if (!token) {
      this.logger.warn(
        "Tentative d'abonnement aux notifications sans être connecté"
      );
      return EMPTY;
    }

    this.logger.debug(
      '🚀 INSTANT NOTIFICATION: Setting up real-time subscription'
    );

    const source$ = this.apollo.subscribe<NotificationReceivedEvent>({
      query: NOTIFICATION_SUBSCRIPTION,
    });

    const processed$ = source$.pipe(
      map((result) => {
        const notification = result.data?.notificationReceived;
        if (!notification) {
          throw new Error('No notification payload received');
        }

        this.logger.debug(
          '⚡ INSTANT: New notification received',
          notification
        );

        const normalized = this.normalizeNotification(notification);

        // Vérification rapide du cache
        if (this.notificationCache.has(normalized.id)) {
          this.logger.debug(
            `🔄 Notification ${normalized.id} already in cache, skipping`
          );
          throw new Error('Notification already exists in cache');
        }

        // TRAITEMENT INSTANTANÉ
        this.logger.debug('📡 INSTANT: Processing notification immediately');

        // Vérifier si la notification existe déjà pour éviter les doublons
        const currentNotifications = this.notifications.value;
        const existingNotification = currentNotifications.find(
          (n) => n.id === normalized.id
        );

        if (existingNotification) {
          this.logger.debug(
            '🔄 DUPLICATE: Notification already exists, skipping:',
            normalized.id
          );
          return normalized;
        }

        // Son de notification IMMÉDIAT
        this.playNotificationSound();

        // Mise à jour INSTANTANÉE du cache
        this.updateNotificationCache(normalized);

        // Émettre IMMÉDIATEMENT la notification EN PREMIER
        this.zone.run(() => {
          // 🚀 INSERTION EN PREMIER: Nouvelle notification en tête de liste
          const updatedNotifications = [normalized, ...currentNotifications];

          this.logger.debug(
            `⚡ INSTANT: Nouvelle notification ajoutée en PREMIER (${updatedNotifications.length} total)`
          );

          this.notifications.next(updatedNotifications);
          this.notificationCount.next(this.notificationCount.value + 1);
        });

        this.logger.debug(
          '✅ INSTANT: Notification processed and emitted',
          normalized
        );

        return normalized;
      }),
      // Gestion d'erreurs optimisée
      catchError((err) => {
        if (
          err instanceof Error &&
          err.message === 'Notification already exists in cache'
        ) {
          return EMPTY;
        }

        this.logger.error('❌ Notification subscription error:', err as Error);
        return EMPTY;
      }),
      // Optimisation: traitement en temps réel
      tap((notification) => {
        this.logger.debug(
          '⚡ INSTANT: Notification ready for UI update',
          notification
        );
      })
    );

    const sub = processed$.subscribe({
      next: (notification) => {
        this.logger.debug(
          '✅ INSTANT: Notification delivered to UI',
          notification
        );
      },
      error: (error) => {
        this.logger.error(
          '❌ CRITICAL: Notification subscription error',
          error
        );
      },
    });

    this.subscriptions.push(sub);
    this.logger.debug('🔗 INSTANT: Notification subscription established');
    return processed$;
  }
  // --------------------------------------------------------------------------
  // Helpers et Utilitaires
  // --------------------------------------------------------------------------

  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredNotifications();
    }, 3600000);
  }
  private cleanupExpiredNotifications(): void {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    let expiredCount = 0;

    this.notificationCache.forEach((notification, id) => {
      const notificationDate = new Date(notification.timestamp);
      if (notificationDate < thirtyDaysAgo) {
        this.notificationCache.delete(id);
        expiredCount++;
      }
    });

    if (expiredCount > 0) {
      this.logger.debug(`Cleaned up ${expiredCount} expired notifications`);

      // 🚀 TRI OPTIMISÉ: Maintenir l'ordre après nettoyage
      const remainingNotifications = Array.from(
        this.notificationCache.values()
      );
      const sortedNotifications = this.sortNotificationsByDate(
        remainingNotifications
      );

      this.notifications.next(sortedNotifications);
      this.updateUnreadCount();
    }
  }
  /**
   * Trie les notifications par date (plus récentes en premier)
   * @param notifications Array de notifications à trier
   * @returns Array de notifications triées
   */
  private sortNotificationsByDate(
    notifications: Notification[]
  ): Notification[] {
    return notifications.sort((a, b) => {
      // Utiliser timestamp ou une date par défaut si manquant
      const dateA = new Date(a.timestamp || 0);
      const dateB = new Date(b.timestamp || 0);
      return dateB.getTime() - dateA.getTime(); // Ordre décroissant (plus récent en premier)
    });
  }

  private getCurrentUserId(): string {
    return localStorage.getItem('userId') || '';
  }
  private normalizeMessage(message: Message): Message {
    if (!message) {
      this.logger.error(
        '[MessageService] Cannot normalize null or undefined message'
      );
      throw new Error('Message object is required');
    }

    try {
      // Vérification des champs obligatoires
      if (!message.id && !message._id) {
        this.logger.error(
          '[MessageService] Message ID is missing',
          undefined,
          message
        );
        throw new Error('Message ID is required');
      }

      // Normaliser le sender avec gestion d'erreur
      let normalizedSender;
      try {
        normalizedSender = message.sender
          ? this.normalizeUser(message.sender)
          : undefined;
      } catch (error) {
        this.logger.warn(
          '[MessageService] Error normalizing message sender, using default values',
          error
        );
        normalizedSender = {
          _id: message.senderId || 'unknown',
          id: message.senderId || 'unknown',
          username: 'Unknown User',
          email: 'unknown@example.com',
          role: 'user',
          isActive: true,
        };
      }

      // Normaliser le receiver si présent
      let normalizedReceiver;
      if (message.receiver) {
        try {
          normalizedReceiver = this.normalizeUser(message.receiver);
        } catch (error) {
          this.logger.warn(
            '[MessageService] Error normalizing message receiver, using default values',
            error
          );
          normalizedReceiver = {
            _id: message.receiverId || 'unknown',
            id: message.receiverId || 'unknown',
            username: 'Unknown User',
            email: 'unknown@example.com',
            role: 'user',
            isActive: true,
          };
        }
      }

      // Normaliser les pièces jointes si présentes
      const normalizedAttachments =
        message.attachments?.map((att) => ({
          id: att.id || att._id || `attachment-${Date.now()}`,
          url: att.url || '',
          type: att.type || 'unknown',
          name: att.name || 'attachment',
          size: att.size || 0,
          duration: att.duration || 0,
        })) || [];

      // Construire le message normalisé
      const normalizedMessage = {
        ...message,
        _id: message.id || message._id,
        id: message.id || message._id,
        content: message.content || '',
        sender: normalizedSender,
        timestamp: this.normalizeDate(message.timestamp),
        readAt: message.readAt ? this.normalizeDate(message.readAt) : undefined,
        attachments: normalizedAttachments,
        metadata: message.metadata || null,
      };

      // Ajouter le receiver seulement s'il existe
      if (normalizedReceiver) {
        normalizedMessage.receiver = normalizedReceiver;
      }

      this.logger.debug('[MessageService] Message normalized successfully', {
        messageId: normalizedMessage.id,
        senderId: normalizedMessage.sender?.id,
      });

      return normalizedMessage;
    } catch (error) {
      this.logger.error(
        '[MessageService] Error normalizing message:',
        error instanceof Error ? error : new Error(String(error)),
        message
      );
      throw new Error(
        `Failed to normalize message: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  public normalizeUser(user: any): User {
    if (!user) {
      throw new Error('User object is required');
    }

    // Vérification des champs obligatoires avec valeurs par défaut
    const userId = user.id || user._id;
    if (!userId) {
      throw new Error('User ID is required');
    }

    // Utiliser des valeurs par défaut pour les champs manquants
    const username = user.username || 'Unknown User';
    const email = user.email || `user-${userId}@example.com`;
    const isActive =
      user.isActive !== undefined && user.isActive !== null
        ? user.isActive
        : true;
    const role = user.role || 'user';

    // Construire l'objet utilisateur normalisé
    return {
      _id: userId,
      id: userId,
      username: username,
      email: email,
      role: role,
      isActive: isActive,
      // Champs optionnels
      image: user.image ?? null,
      bio: user.bio,
      isOnline: user.isOnline || false,
      lastActive: user.lastActive ? new Date(user.lastActive) : undefined,
      createdAt: user.createdAt ? new Date(user.createdAt) : undefined,
      updatedAt: user.updatedAt ? new Date(user.updatedAt) : undefined,
      followingCount: user.followingCount,
      followersCount: user.followersCount,
      postCount: user.postCount,
    };
  }
  private normalizeConversation(conv: Conversation): Conversation {
    if (!conv) {
      this.logger.error(
        '[MessageService] Cannot normalize null or undefined conversation'
      );
      throw new Error('Conversation object is required');
    }

    try {
      // Vérification des champs obligatoires
      if (!conv.id && !conv._id) {
        this.logger.error(
          '[MessageService] Conversation ID is missing',
          undefined,
          conv
        );
        throw new Error('Conversation ID is required');
      }

      // Normaliser les participants avec gestion d'erreur
      const normalizedParticipants = [];
      if (conv.participants && Array.isArray(conv.participants)) {
        for (const participant of conv.participants) {
          try {
            if (participant) {
              normalizedParticipants.push(this.normalizeUser(participant));
            }
          } catch (error) {
            this.logger.warn(
              '[MessageService] Error normalizing participant, skipping',
              error
            );
          }
        }
      } else {
        this.logger.warn(
          '[MessageService] Conversation has no participants or invalid participants array',
          conv
        );
      }

      // Normaliser les messages avec gestion d'erreur
      const normalizedMessages = [];
      if (conv.messages && Array.isArray(conv.messages)) {
        this.logger.debug('[MessageService] Processing conversation messages', {
          count: conv.messages.length,
        });

        for (const message of conv.messages) {
          try {
            if (message) {
              const normalizedMessage = this.normalizeMessage(message);
              this.logger.debug(
                '[MessageService] Successfully normalized message',
                {
                  messageId: normalizedMessage.id,
                  content: normalizedMessage.content?.substring(0, 20),
                  sender: normalizedMessage.sender?.username,
                }
              );
              normalizedMessages.push(normalizedMessage);
            }
          } catch (error) {
            this.logger.warn(
              '[MessageService] Error normalizing message in conversation, skipping',
              error
            );
          }
        }
      } else {
        this.logger.debug(
          '[MessageService] No messages found in conversation or invalid messages array'
        );
      }

      // Normaliser le dernier message avec gestion d'erreur
      let normalizedLastMessage = null;
      if (conv.lastMessage) {
        try {
          normalizedLastMessage = this.normalizeMessage(conv.lastMessage);
        } catch (error) {
          this.logger.warn(
            '[MessageService] Error normalizing last message, using null',
            error
          );
        }
      }

      // Construire la conversation normalisée
      const normalizedConversation = {
        ...conv,
        _id: conv.id || conv._id,
        id: conv.id || conv._id,
        participants: normalizedParticipants,
        messages: normalizedMessages,
        lastMessage: normalizedLastMessage,
        unreadCount: conv.unreadCount || 0,
        isGroup: !!conv.isGroup,
        createdAt: this.normalizeDate(conv.createdAt),
        updatedAt: this.normalizeDate(conv.updatedAt),
      };

      this.logger.debug(
        '[MessageService] Conversation normalized successfully',
        {
          conversationId: normalizedConversation.id,
          participantCount: normalizedParticipants.length,
          messageCount: normalizedMessages.length,
        }
      );

      return normalizedConversation;
    } catch (error) {
      this.logger.error(
        '[MessageService] Error normalizing conversation:',
        error instanceof Error ? error : new Error(String(error)),
        conv
      );
      throw new Error(
        `Failed to normalize conversation: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
  private normalizeDate(date: string | Date | undefined): Date {
    if (!date) return new Date();
    try {
      return typeof date === 'string' ? new Date(date) : date;
    } catch (error) {
      this.logger.warn(`Failed to parse date: ${date}`, error);
      return new Date();
    }
  }

  // Méthode sécurisée pour créer une date à partir d'une valeur potentiellement undefined
  private safeDate(date: string | Date | undefined): Date {
    if (!date) return new Date();
    try {
      return typeof date === 'string' ? new Date(date) : date;
    } catch (error) {
      this.logger.warn(`Failed to create safe date: ${date}`, error);
      return new Date();
    }
  }
  private toSafeISOString = (
    date: Date | string | undefined
  ): string | undefined => {
    if (!date) return undefined;
    return typeof date === 'string' ? date : date.toISOString();
  };
  private normalizeNotification(notification: Notification): Notification {
    this.logger.debug(
      'MessageService',
      'Normalizing notification',
      notification
    );

    if (!notification) {
      this.logger.error('MessageService', 'Notification is null or undefined');
      throw new Error('Notification is required');
    }

    // Vérifier et normaliser l'ID
    const notificationId = notification.id || (notification as any)._id;
    if (!notificationId) {
      this.logger.error(
        'MessageService',
        'Notification ID is missing',
        notification
      );
      throw new Error('Notification ID is required');
    }

    if (!notification.timestamp) {
      this.logger.warn(
        'MessageService',
        'Notification timestamp is missing, using current time',
        notification
      );
      notification.timestamp = new Date();
    }

    try {
      const normalized = {
        ...notification,
        _id: notificationId, // Conserver l'ID MongoDB original
        id: notificationId, // Utiliser le même ID pour les deux propriétés
        timestamp: new Date(notification.timestamp),
        ...(notification.senderId && {
          senderId: this.normalizeSender(notification.senderId),
        }),
        ...(notification.message && {
          message: this.normalizeNotMessage(notification.message),
        }),
      };

      this.logger.debug(
        'MessageService',
        'Normalized notification result',
        normalized
      );
      return normalized;
    } catch (error) {
      this.logger.error(
        'MessageService',
        'Error in normalizeNotification',
        error
      );
      throw error;
    }
  }
  private normalizeSender(sender: any) {
    return {
      id: sender.id,
      username: sender.username,
      ...(sender.image && { image: sender.image }),
    };
  }

  /**
   * Normalise un message de notification
   * @param message Message à normaliser
   * @returns Message normalisé
   */
  private normalizeNotMessage(message: any) {
    if (!message) return null;

    return {
      id: message.id || message._id,
      content: message.content || '',
      type: message.type || 'TEXT',
      timestamp: this.safeDate(message.timestamp),
      attachments: message.attachments || [],
      ...(message.sender && { sender: this.normalizeSender(message.sender) }),
    };
  }
  /**
   * Met à jour le cache de notifications avec une ou plusieurs notifications
   * @param notifications Notification(s) à ajouter au cache
   * @param skipDuplicates Si true, ignore les notifications déjà présentes dans le cache
   */
  private updateCache(
    notifications: Notification | Notification[],
    skipDuplicates: boolean = true
  ) {
    const notificationArray = Array.isArray(notifications)
      ? notifications
      : [notifications];

    this.logger.debug(
      'MessageService',
      `Updating notification cache with ${notificationArray.length} notifications`
    );

    if (notificationArray.length === 0) {
      this.logger.warn('MessageService', 'No notifications to update in cache');
      return;
    }

    // Vérifier si les notifications ont des IDs valides
    const validNotifications = notificationArray.filter(
      (notif) => notif && (notif.id || (notif as any)._id)
    );

    if (validNotifications.length !== notificationArray.length) {
      this.logger.warn(
        'MessageService',
        `Found ${
          notificationArray.length - validNotifications.length
        } notifications without valid IDs`
      );
    }

    let addedCount = 0;
    let skippedCount = 0;

    // Traiter chaque notification
    validNotifications.forEach((notif, index) => {
      try {
        // S'assurer que la notification a un ID
        const notifId = notif.id || (notif as any)._id;
        if (!notifId) {
          this.logger.error(
            'MessageService',
            'Notification without ID:',
            notif
          );
          return;
        }

        // Normaliser la notification
        const normalized = this.normalizeNotification(notif);

        // Vérifier si cette notification existe déjà dans le cache
        if (skipDuplicates && this.notificationCache.has(normalized.id)) {
          this.logger.debug(
            'MessageService',
            `Notification ${normalized.id} already exists in cache, skipping`
          );
          skippedCount++;
          return;
        }

        // Ajouter au cache
        this.notificationCache.set(normalized.id, normalized);
        addedCount++;

        this.logger.debug(
          'MessageService',
          `Added notification ${normalized.id} to cache`
        );
      } catch (error) {
        this.logger.error(
          'MessageService',
          `Error processing notification ${index + 1}:`,
          error
        );
      }
    });

    this.logger.debug(
      'MessageService',
      `Cache update complete: ${addedCount} added, ${skippedCount} skipped, total: ${this.notificationCache.size}`
    );

    // Mettre à jour les observables et sauvegarder
    this.refreshNotificationObservables();
  }
  /**
   * Met à jour les observables de notifications et sauvegarde dans le localStorage
   * OPTIMISÉ: Trie les notifications par date (plus récentes en premier)
   */
  private refreshNotificationObservables(): void {
    const allNotifications = Array.from(this.notificationCache.values());

    // 🚀 TRI OPTIMISÉ: Les notifications les plus récentes en premier
    const sortedNotifications = this.sortNotificationsByDate(allNotifications);

    this.logger.debug(
      `📊 SORTED: ${sortedNotifications.length} notifications triées par date (plus récentes en premier)`
    );

    this.notifications.next(sortedNotifications);
    this.updateUnreadCount();
    this.saveNotificationsToLocalStorage();
  }

  /**
   * Met à jour le compteur de notifications non lues
   */
  private updateUnreadCount(): void {
    const allNotifications = Array.from(this.notificationCache.values());
    const unreadNotifications = allNotifications.filter((n) => !n.isRead);
    const count = unreadNotifications.length;

    // Forcer la mise à jour dans la zone Angular
    this.zone.run(() => {
      this.notificationCount.next(count);

      // Émettre un événement global pour forcer la mise à jour du layout
      window.dispatchEvent(
        new CustomEvent('notificationCountChanged', {
          detail: { count },
        })
      );
    });
  }

  /**
   * Met à jour le cache avec une seule notification (méthode simplifiée)
   * @param notification Notification à ajouter
   */
  private updateNotificationCache(notification: Notification): void {
    this.updateCache(notification, true);
  }
  /**
   * Met à jour le statut de lecture des notifications
   * @param ids IDs des notifications à mettre à jour
   * @param isRead Nouveau statut de lecture
   */
  private updateNotificationStatus(ids: string[], isRead: boolean): void {
    ids.forEach((id) => {
      const notif = this.notificationCache.get(id);
      if (notif) {
        this.notificationCache.set(id, {
          ...notif,
          isRead,
          readAt: isRead ? new Date().toISOString() : undefined,
        });
      }
    });
    this.refreshNotificationObservables();
  }

  /**
   * Méthode générique pour supprimer des notifications du cache local
   * @param notificationIds IDs des notifications à supprimer
   * @returns Nombre de notifications supprimées
   */
  private removeNotificationsFromCache(notificationIds: string[]): number {
    console.log(
      '🗑️ REMOVE FROM CACHE: Starting removal of',
      notificationIds.length,
      'notifications'
    );
    console.log(
      '🗑️ REMOVE FROM CACHE: Cache size before:',
      this.notificationCache.size
    );

    let removedCount = 0;
    notificationIds.forEach((id) => {
      if (this.notificationCache.has(id)) {
        console.log('🗑️ REMOVE FROM CACHE: Removing notification:', id);
        this.notificationCache.delete(id);
        removedCount++;
      } else {
        console.log(
          '🗑️ REMOVE FROM CACHE: Notification not found in cache:',
          id
        );
      }
    });

    console.log('🗑️ REMOVE FROM CACHE: Removed', removedCount, 'notifications');
    console.log(
      '🗑️ REMOVE FROM CACHE: Cache size after:',
      this.notificationCache.size
    );

    if (removedCount > 0) {
      console.log('🗑️ REMOVE FROM CACHE: Refreshing observables...');
      this.refreshNotificationObservables();
    }

    return removedCount;
  }

  /**
   * Méthode générique pour gérer les erreurs de suppression
   * @param error Erreur survenue
   * @param operation Nom de l'opération
   * @param fallbackResponse Réponse de fallback en cas d'erreur
   */
  private handleDeletionError(
    error: any,
    operation: string,
    fallbackResponse: any
  ) {
    this.logger.error('MessageService', `Erreur lors de ${operation}:`, error);
    return of(fallbackResponse);
  }
  // Typing indicators
  startTyping(conversationId: string): Observable<boolean> {
    const userId = this.getCurrentUserId();
    if (!userId) {
      this.logger.warn('MessageService', 'Cannot start typing: no user ID');
      return of(false);
    }

    return this.apollo
      .mutate<StartTupingResponse>({
        mutation: START_TYPING_MUTATION,
        variables: {
          input: {
            conversationId,
            userId,
          },
        },
      })
      .pipe(
        map((result) => result.data?.startTyping || false),
        catchError((error) => {
          this.logger.error(
            'MessageService',
            'Error starting typing indicator',
            error
          );
          return throwError(
            () => new Error('Failed to start typing indicator')
          );
        })
      );
  }

  stopTyping(conversationId: string): Observable<boolean> {
    const userId = this.getCurrentUserId();
    if (!userId) {
      this.logger.warn('MessageService', 'Cannot stop typing: no user ID');
      return of(false);
    }

    return this.apollo
      .mutate<StopTypingResponse>({
        mutation: STOP_TYPING_MUTATION,
        variables: {
          input: {
            conversationId,
            userId,
          },
        },
      })
      .pipe(
        map((result) => result.data?.stopTyping || false),
        catchError((error) => {
          this.logger.error(
            'MessageService',
            'Error stopping typing indicator',
            error
          );
          return throwError(() => new Error('Failed to stop typing indicator'));
        })
      );
  }

  // ========================================
  // MÉTHODE SENDMESSAGE MANQUANTE
  // ========================================

  /**
   * Envoie un message (texte, fichier, audio, etc.)
   * @param receiverId ID du destinataire
   * @param content Contenu du message (texte)
   * @param file Fichier à envoyer (optionnel)
   * @param messageType Type de message (TEXT, AUDIO, IMAGE, etc.)
   * @param conversationId ID de la conversation
   * @returns Observable avec le message envoyé
   */
  sendMessage(
    receiverId: string,
    content: string,
    file?: File,
    messageType: any = 'TEXT',
    conversationId?: string
  ): Observable<Message> {
    console.log('🚀 [MessageService] sendMessage called with:', {
      receiverId,
      content: content?.substring(0, 50),
      hasFile: !!file,
      fileName: file?.name,
      fileType: file?.type,
      fileSize: file?.size,
      messageType,
      conversationId,
    });

    if (!receiverId) {
      const error = new Error('Receiver ID is required');
      console.error('❌ [MessageService] sendMessage error:', error);
      return throwError(() => error);
    }

    // Préparer les variables pour la mutation
    const variables: any = {
      receiverId,
      content: content || '',
      type: messageType,
    };

    // Ajouter l'ID de conversation si fourni
    if (conversationId) {
      variables.conversationId = conversationId;
    }

    // Si un fichier est fourni, l'ajouter aux variables
    if (file) {
      variables.file = file;
      console.log('📁 [MessageService] Adding file to mutation:', {
        name: file.name,
        type: file.type,
        size: file.size,
      });
    }

    console.log(
      '📤 [MessageService] Sending mutation with variables:',
      variables
    );

    return this.apollo
      .mutate<SendMessageResponse>({
        mutation: SEND_MESSAGE_MUTATION,
        variables,
        context: {
          useMultipart: !!file, // Utiliser multipart si un fichier est présent
        },
      })
      .pipe(
        map((result) => {
          console.log(
            '✅ [MessageService] sendMessage mutation result:',
            result
          );

          if (!result.data?.sendMessage) {
            throw new Error('No message data received from server');
          }

          const message = result.data.sendMessage;
          console.log('📨 [MessageService] Message sent successfully:', {
            id: message.id,
            type: message.type,
            content: message.content?.substring(0, 50),
            hasAttachments: !!message.attachments?.length,
          });

          // Normaliser le message reçu
          const normalizedMessage = this.normalizeMessage(message);
          console.log(
            '🔧 [MessageService] Message normalized:',
            normalizedMessage
          );

          return normalizedMessage;
        }),
        catchError((error) => {
          console.error('❌ [MessageService] sendMessage error:', error);
          this.logger.error('Error sending message:', error);

          // Fournir un message d'erreur plus spécifique
          let errorMessage = "Erreur lors de l'envoi du message";
          if (error.networkError) {
            errorMessage = 'Erreur de connexion réseau';
          } else if (error.graphQLErrors?.length > 0) {
            errorMessage = error.graphQLErrors[0].message || errorMessage;
          }

          return throwError(() => new Error(errorMessage));
        })
      );
  }

  // ========================================
  // MÉTHODES UTILITAIRES CONSOLIDÉES
  // ========================================

  /**
   * Formate l'heure d'un message
   */
  formatMessageTime(timestamp: string | Date | undefined): string {
    if (!timestamp) return 'Unknown time';
    try {
      const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
      return date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
    } catch (error) {
      return 'Invalid time';
    }
  }

  /**
   * Formate la dernière activité d'un utilisateur
   */
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

  /**
   * Formate la date d'un message
   */
  formatMessageDate(timestamp: string | Date | undefined): string {
    if (!timestamp) return 'Unknown date';

    try {
      const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
      const today = new Date();

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

      const day = date
        .toLocaleDateString('fr-FR', { weekday: 'short' })
        .toUpperCase();
      return `${day}., ${date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })}`;
    } catch (error) {
      return 'Invalid date';
    }
  }

  /**
   * Détermine si un en-tête de date doit être affiché
   */
  shouldShowDateHeader(messages: any[], index: number): boolean {
    if (index === 0) return true;

    try {
      const currentMsg = messages[index];
      const prevMsg = messages[index - 1];

      if (!currentMsg?.timestamp || !prevMsg?.timestamp) return true;

      const currentDate = this.getDateFromTimestamp(currentMsg.timestamp);
      const prevDate = this.getDateFromTimestamp(prevMsg.timestamp);

      return currentDate !== prevDate;
    } catch (error) {
      return false;
    }
  }

  private getDateFromTimestamp(timestamp: string | Date | undefined): string {
    if (!timestamp) return 'unknown-date';
    try {
      return (
        timestamp instanceof Date ? timestamp : new Date(timestamp)
      ).toDateString();
    } catch (error) {
      return 'invalid-date';
    }
  }

  /**
   * Obtient l'icône d'un fichier selon son type MIME
   */
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

  /**
   * Obtient le type d'un fichier selon son type MIME
   */
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

  /**
   * Vérifie si un message contient une image
   */
  hasImage(message: any): boolean {
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
  isVoiceMessage(message: any): boolean {
    if (!message) return false;

    // Vérifier le type du message
    if (
      message.type === MessageType.VOICE_MESSAGE ||
      message.type === MessageType.VOICE_MESSAGE
    ) {
      return true;
    }

    // Vérifier les pièces jointes
    if (message.attachments && message.attachments.length > 0) {
      return message.attachments.some((att: any) => {
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
  getVoiceMessageUrl(message: any): string {
    if (!message || !message.attachments || message.attachments.length === 0) {
      return '';
    }

    const voiceAttachment = message.attachments.find((att: any) => {
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
  getVoiceMessageDuration(message: any): number {
    if (!message) return 0;

    // Essayer d'abord de récupérer la durée depuis les métadonnées
    if (message.metadata?.duration) {
      return message.metadata.duration;
    }

    // Sinon, essayer de récupérer depuis les pièces jointes
    if (message.attachments && message.attachments.length > 0) {
      const voiceAttachment = message.attachments.find((att: any) => {
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

  /**
   * Génère la hauteur des barres de la forme d'onde moderne
   */
  getVoiceBarHeight(index: number): number {
    const pattern = [
      8, 12, 6, 15, 10, 18, 7, 14, 9, 16, 5, 13, 11, 17, 8, 12, 6, 15, 10, 18,
    ];
    return pattern[index % pattern.length];
  }

  /**
   * Formate la durée du message vocal en format MM:SS
   */
  formatVoiceDuration(seconds: number): string {
    if (!seconds || seconds === 0) {
      return '0:00';
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  /**
   * Obtient l'URL de l'image en toute sécurité
   */
  getImageUrl(message: any): string {
    if (!message || !message.attachments || message.attachments.length === 0) {
      return '';
    }

    const attachment = message.attachments[0];
    return attachment?.url || '';
  }

  /**
   * Détermine le type d'un message
   */
  getMessageType(message: any): MessageType {
    if (!message) return MessageType.TEXT;

    try {
      if (message.type) {
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

      if (message.attachments?.length) {
        const attachment = message.attachments[0];
        if (attachment && attachment.type) {
          const attachmentTypeStr = attachment.type.toString();

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

        return MessageType.FILE;
      }

      return MessageType.TEXT;
    } catch (error) {
      return MessageType.TEXT;
    }
  }

  /**
   * Retourne la liste des emojis communs
   */
  getCommonEmojis(): string[] {
    return [
      '😀',
      '😃',
      '😄',
      '😁',
      '😆',
      '😅',
      '😂',
      '🤣',
      '😊',
      '😇',
      '🙂',
      '🙃',
      '😉',
      '😌',
      '😍',
      '🥰',
      '😘',
      '😗',
      '😙',
      '😚',
      '😋',
      '😛',
      '😝',
      '😜',
      '🤪',
      '🤨',
      '🧐',
      '🤓',
      '😎',
      '🤩',
      '😏',
      '😒',
      '😞',
      '😔',
      '😟',
      '😕',
      '🙁',
      '☹️',
      '😣',
      '😖',
      '😫',
      '😩',
      '🥺',
      '😢',
      '😭',
      '😤',
      '😠',
      '😡',
      '🤬',
      '🤯',
      '😳',
      '🥵',
      '🥶',
      '😱',
      '😨',
      '😰',
      '😥',
      '😓',
      '🤗',
      '🤔',
      '👍',
      '👎',
      '👏',
      '🙌',
      '👐',
      '🤲',
      '🤝',
      '🙏',
      '✌️',
      '🤞',
      '❤️',
      '🧡',
      '💛',
      '💚',
      '💙',
      '💜',
      '🖤',
      '💔',
      '💯',
      '💢',
    ];
  }

  /**
   * Obtient les classes CSS pour un message
   */
  getMessageTypeClass(message: any, currentUserId: string | null): string {
    if (!message) {
      return 'bg-gray-100 rounded-lg px-4 py-2';
    }

    try {
      const isCurrentUser =
        message.sender?.id === currentUserId ||
        message.sender?._id === currentUserId ||
        message.senderId === currentUserId;

      const baseClass = isCurrentUser
        ? 'bg-blue-500 text-white rounded-2xl rounded-br-sm'
        : 'bg-gray-200 text-gray-800 rounded-2xl rounded-bl-sm';

      const messageType = this.getMessageType(message);

      if (message.attachments && message.attachments.length > 0) {
        const attachment = message.attachments[0];
        if (attachment && attachment.type) {
          const attachmentTypeStr = attachment.type.toString();
          if (attachmentTypeStr === 'IMAGE' || attachmentTypeStr === 'image') {
            return `p-1 max-w-xs`;
          } else if (
            attachmentTypeStr === 'FILE' ||
            attachmentTypeStr === 'file'
          ) {
            return `${baseClass} p-3`;
          }
        }
      }

      // Les vérifications de type sont déjà faites avec les attachments ci-dessus

      return `${baseClass} px-4 py-3 whitespace-normal break-words min-w-[120px]`;
    } catch (error) {
      return 'bg-gray-100 rounded-lg px-4 py-2 whitespace-normal break-words';
    }
  }

  // destroy
  cleanupSubscriptions(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    this.subscriptions = [];
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.notificationCache.clear();
    this.logger.debug('NotificationService destroyed');
  }

  ngOnDestroy() {
    this.cleanupSubscriptions();
  }
}
