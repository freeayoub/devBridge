import { Injectable, OnDestroy, NgZone } from '@angular/core';
import { Apollo } from 'apollo-angular';
import {
  BehaviorSubject,
  Observable,
  of,
  Subscription,
  throwError,
  retry,
} from 'rxjs';
import { map, catchError, tap, filter } from 'rxjs/operators';
import { MessageType } from '../models/message.model';
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
  GET_GROUP_QUERY,
  GET_USER_GROUPS_QUERY,
  CREATE_GROUP_MUTATION,
  UPDATE_GROUP_MUTATION,
  START_TYPING_MUTATION,
  STOP_TYPING_MUTATION,
  TYPING_INDICATOR_SUBSCRIPTION,
  GET_CURRENT_USER_QUERY,
  REACT_TO_MESSAGE_MUTATION,
  FORWARD_MESSAGE_MUTATION,
  PIN_MESSAGE_MUTATION,
  EDIT_MESSAGE_MUTATION,
  DELETE_MESSAGE_MUTATION,
  GET_MESSAGES_QUERY,
  GET_NOTIFICATIONS_ATTACHAMENTS,
  MARK_NOTIFICATION_READ_MUTATION,
  NOTIFICATIONS_READ_SUBSCRIPTION,
  CREATE_CONVERSATION_MUTATION,
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
  private usersCache: User[] = [];

  // Observables publics
  public activeConversation$ = this.activeConversation.asObservable();
  public notifications$ = this.notifications.asObservable();
  public notificationCount$ = this.notificationCount.asObservable();

  constructor(
    private apollo: Apollo,
    private logger: LoggerService,
    private zone: NgZone
  ) {
    this.initSubscriptions();
    this.startCleanupInterval();
  }
  private initSubscriptions(): void {
    this.zone.runOutsideAngular(() => {
      this.subscribeToNewNotifications().subscribe();
      this.subscribeToNotificationsRead().subscribe();
    });
    this.subscribeToUserStatus();
  }
  // --------------------------------------------------------------------------
  // Section 1: Méthodes pour les Messages
  // --------------------------------------------------------------------------
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

  sendMessage(
    receiverId: string,
    content: string,
    file?: File,
    conversationId?: string,
    replyTo?: string
  ): Observable<Message> {
    this.logger.info(
      `[MessageService] Sending message to: ${receiverId}, hasFile: ${!!file}`
    );
    this.logger.debug(
      `[MessageService] Message content: "${content?.substring(0, 50)}${
        content?.length > 50 ? '...' : ''
      }"`
    );

    // Vérifier l'authentification
    const token = localStorage.getItem('token');
    this.logger.debug(
      `[MessageService] Authentication check before sending message: token=${!!token}`
    );

    // Déterminer le type de message
    let messageType = MessageType.TEXT;
    if (file) {
      // Déterminer le type de message en fonction du type de fichier
      if (file.type.startsWith('image/')) {
        messageType = MessageType.IMAGE;
      } else if (file.type.startsWith('video/')) {
        messageType = MessageType.VIDEO;
      } else if (file.type.startsWith('audio/')) {
        messageType = MessageType.AUDIO;
      } else {
        messageType = MessageType.FILE;
      }
    }

    this.logger.debug(
      `[MessageService] Message type determined: ${messageType}`
    );

    // Ajouter le type de message aux variables
    // Utiliser directement la valeur de l'énumération sans conversion
    const variables: any = {
      receiverId,
      content,
      type: messageType, // Ajouter explicitement le type de message
    };

    // Forcer le type à être une valeur d'énumération GraphQL
    // Cela empêche Apollo de convertir la valeur en minuscules
    if (variables.type) {
      Object.defineProperty(variables, 'type', {
        value: messageType,
        enumerable: true,
        writable: false,
      });
    }

    if (file) {
      variables.file = file;
      this.logger.debug(
        `[MessageService] File attached: ${file.name}, size: ${file.size}, type: ${file.type}, messageType: ${messageType}`
      );
    }
    if (conversationId) {
      variables.conversationId = conversationId;
      this.logger.debug(
        `[MessageService] Using existing conversation: ${conversationId}`
      );
    }
    if (replyTo) {
      variables.replyTo = replyTo;
      this.logger.debug(`[MessageService] Replying to message: ${replyTo}`);
    }

    const context = file ? { useMultipart: true, file } : undefined;

    this.logger.debug(
      `[MessageService] Sending GraphQL mutation with variables:`,
      variables
    );

    return this.apollo
      .mutate<SendMessageResponse>({
        mutation: SEND_MESSAGE_MUTATION,
        variables,
        context,
      })
      .pipe(
        map((result) => {
          this.logger.debug(`[MessageService] Message send response:`, result);

          if (!result.data?.sendMessage) {
            this.logger.error(
              `[MessageService] Failed to send message: No data returned`
            );
            throw new Error('Failed to send message');
          }

          this.logger.debug(`[MessageService] Normalizing sent message`);
          const normalizedMessage = this.normalizeMessage(
            result.data.sendMessage
          );

          this.logger.info(
            `[MessageService] Message sent successfully: ${normalizedMessage.id}`
          );
          return normalizedMessage;
        }),
        catchError((error) => {
          this.logger.error(`[MessageService] Error sending message:`, error);
          return throwError(() => new Error('Failed to send message'));
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
  // --------------------------------------------------------------------------
  // Section 2: Méthodes pour les Notifications
  // --------------------------------------------------------------------------
  getNotifications(refresh = false): Observable<Notification[]> {
    this.logger.info(
      'MessageService',
      `Fetching notifications, refresh: ${refresh}`
    );
    this.logger.debug('MessageService', 'Using query', {
      query: GET_NOTIFICATIONS_QUERY,
    });

    return this.apollo
      .watchQuery<getUserNotificationsResponse>({
        query: GET_NOTIFICATIONS_QUERY,
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
            `Received ${notifications.length} notifications`
          );

          if (notifications.length === 0) {
            this.logger.info(
              'MessageService',
              'No notifications received from server'
            );
          }

          this.updateCache(notifications);
          this.notifications.next(Array.from(this.notificationCache.values()));
          this.updateUnreadCount();
          return Array.from(this.notificationCache.values());
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

    return this.apollo
      .mutate<MarkNotificationsAsReadResponse>({
        mutation: MARK_NOTIFICATION_READ_MUTATION,
        variables: { notificationIds: validIds },
        optimisticResponse: {
          markNotificationsAsRead: {
            success: true,
            readCount: validIds.length,
            remainingCount: Math.max(
              0,
              this.notificationCount.value - validIds.length
            ),
          },
        },
        update: (cache) => {
          // Mise à jour optimiste du cache
          this.logger.debug('MessageService', 'Updating cache optimistically');
          validIds.forEach((id) => {
            try {
              cache.modify({
                id: `Notification:${id}`,
                fields: {
                  isRead: () => true,
                  readAt: () => new Date().toISOString(),
                },
              });
            } catch (error) {
              this.logger.warn(
                'MessageService',
                `Failed to update cache for notification ${id}`,
                error
              );
            }
          });
        },
      })
      .pipe(
        map((result) => {
          this.logger.debug('MessageService', 'Mutation result', result);

          const response = result.data?.markNotificationsAsRead ?? {
            success: false,
            readCount: 0,
            remainingCount: this.notificationCount.value,
          };

          if (response.success) {
            this.logger.debug(
              'MessageService',
              'Updating notification status in cache'
            );
            this.updateNotificationStatus(validIds, true);
          }
          return response;
        }),
        catchError((error: Error) => {
          this.logger.error(
            'MessageService',
            'Error marking notifications as read:',
            error
          );
          return throwError(
            () => new Error('Failed to mark notifications as read')
          );
        })
      );
  }
  // --------------------------------------------------------------------------
  // Section 3: Méthodes pour les Utilisateurs/Groupes
  // --------------------------------------------------------------------------
  // User methods
  getAllUsers(forceRefresh = false, search?: string): Observable<User[]> {
    this.logger.info(
      'MessageService',
      `Getting all users, forceRefresh=${forceRefresh}, search=${
        search || '(empty)'
      }`
    );

    const now = Date.now();
    const cacheValid =
      !forceRefresh &&
      this.usersCache.length > 0 &&
      now - this.lastFetchTime <= this.CACHE_DURATION;

    // Utiliser le cache si valide et pas de recherche
    if (cacheValid && !search) {
      this.logger.debug(
        'MessageService',
        `Using cached users (${this.usersCache.length} users)`
      );
      return of([...this.usersCache]);
    }

    this.logger.debug(
      'MessageService',
      `Fetching users from server, fetchPolicy=${
        forceRefresh ? 'network-only' : 'cache-first'
      }`
    );

    return this.apollo
      .watchQuery<GetAllUsersResponse>({
        query: GET_ALL_USER_QUERY,
        variables: { search },
        fetchPolicy: forceRefresh ? 'network-only' : 'cache-first',
      })
      .valueChanges.pipe(
        map((result) => {
          this.logger.debug('MessageService', 'Users response received');

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

          // Normaliser les utilisateurs avec gestion d'erreur
          const users: User[] = [];
          for (const user of result.data.getAllUsers) {
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
            `Received ${users.length} users from server`
          );

          // Mettre à jour le cache si ce n'est pas une recherche
          if (!search) {
            this.usersCache = [...users];
            this.lastFetchTime = Date.now();
            this.logger.debug(
              'MessageService',
              `User cache updated with ${users.length} users`
            );
          }

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

          // En cas d'erreur, retourner le cache si disponible
          if (this.usersCache.length > 0) {
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

  // Group methods
  getGroup(groupId: string): Observable<Group> {
    return this.apollo
      .watchQuery<GetGroupResponse>({
        query: GET_GROUP_QUERY,
        variables: { id: groupId },
        fetchPolicy: 'network-only',
      })
      .valueChanges.pipe(
        map((result) => {
          const group = result.data?.getGroup;
          if (!group) throw new Error('Group not found');

          return {
            ...group,
            participants:
              group.participants?.map((p) => this.normalizeUser(p)) || [],
            admins: group.admins?.map((a) => this.normalizeUser(a)) || [],
            createdAt: new Date(),
            updatedAt: new Date(),
          };
        }),
        catchError((error) => {
          this.logger.error('MessageService', 'Error fetching group:', error);
          return throwError(() => new Error('Failed to fetch group'));
        })
      );
  }
  getUserGroups(userId: string): Observable<Group[]> {
    return this.apollo
      .watchQuery<GetUserGroupsResponse>({
        query: GET_USER_GROUPS_QUERY,
        variables: { userId },
        fetchPolicy: 'network-only',
      })
      .valueChanges.pipe(
        map(
          (result) =>
            result.data?.getUserGroups?.map((group) => ({
              ...group,
              participants:
                group.participants?.map((p) => this.normalizeUser(p)) || [],
              admins: group.admins?.map((a) => this.normalizeUser(a)) || [],
              createdAt: new Date(),
              updatedAt: new Date(),
            })) || []
        ),
        catchError((error) => {
          this.logger.error(
            'MessageService',
            'Error fetching user groups:',
            error
          );
          return throwError(() => new Error('Failed to fetch user groups'));
        })
      );
  }
  createGroup(
    name: string,
    participantIds: string[],
    photo?: File,
    description?: string
  ): Observable<Group> {
    const variables = photo
      ? { name, participantIds, photo, description }
      : { name, participantIds, description };
    const context = photo ? { useMultipart: true, file: photo } : undefined;

    return this.apollo
      .mutate<CreateGroupResponse>({
        mutation: CREATE_GROUP_MUTATION,
        variables,
        context,
        refetchQueries: [
          {
            query: GET_USER_GROUPS_QUERY,
            variables: { userId: this.getCurrentUserId() },
          },
        ],
      })
      .pipe(
        map((result) => {
          if (!result.data?.createGroup)
            throw new Error('Failed to create group');
          return {
            ...result.data.createGroup,
            participants:
              result.data.createGroup.participants?.map((p) =>
                this.normalizeUser(p)
              ) || [],
            admins:
              result.data.createGroup.admins?.map((a) =>
                this.normalizeUser(a)
              ) || [],
          };
        }),
        catchError((error) => {
          this.logger.error('MessageService', 'Error creating group:', error);
          return throwError(() => new Error('Failed to create group'));
        })
      );
  }
  updateGroup(
    groupId: string,
    input: {
      name?: string;
      photo?: File;
      description?: string;
      addParticipants?: string[];
      removeParticipants?: string[];
      addAdmins?: string[];
      removeAdmins?: string[];
    }
  ): Observable<Group> {
    const context = input.photo
      ? { useMultipart: true, file: input.photo }
      : undefined;
    const { photo, ...inputWithoutPhoto } = input;

    return this.apollo
      .mutate<UpdateGroupResponse>({
        mutation: UPDATE_GROUP_MUTATION,
        variables: { id: groupId, input: inputWithoutPhoto },
        context,
        refetchQueries: [
          { query: GET_GROUP_QUERY, variables: { id: groupId } },
          {
            query: GET_USER_GROUPS_QUERY,
            variables: { userId: this.getCurrentUserId() },
          },
        ],
      })
      .pipe(
        map((result) => {
          if (!result.data?.updateGroup)
            throw new Error('Failed to update group');
          return {
            ...result.data.updateGroup,
            participants:
              result.data.updateGroup.participants?.map((p) =>
                this.normalizeUser(p)
              ) || [],
            admins:
              result.data.updateGroup.admins?.map((a) =>
                this.normalizeUser(a)
              ) || [],
          };
        }),
        catchError((error) => {
          this.logger.error('MessageService', 'Error updating group:', error);
          return throwError(() => new Error('Failed to update group'));
        })
      );
  }

  // --------------------------------------------------------------------------
  // Section 4: Subscriptions et Gestion Temps Réel
  // --------------------------------------------------------------------------
  subscribeToNewMessages(conversationId: string): Observable<Message> {
    const sub$ = this.apollo
      .subscribe<{ messageSent: Message }>({
        query: MESSAGE_SENT_SUBSCRIPTION,
        variables: { conversationId },
      })
      .pipe(
        map((result) => {
          const msg = result.data?.messageSent;
          if (!msg) throw new Error('No message payload received');
          return {
            ...msg,
            timestamp: this.safeDate(msg.timestamp),
            sender: this.normalizeUser(msg.sender),
          };
        }),
        catchError((error) => {
          this.logger.error(
            'MessageService',
            'Message subscription error:',
            error
          );
          return throwError(() => new Error('Message subscription failed'));
        })
      );

    const sub = sub$.subscribe();
    this.subscriptions.push(sub);
    return sub$;
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
      return of(null as unknown as Notification);
    }

    const source$ = this.apollo.subscribe<NotificationReceivedEvent>({
      query: NOTIFICATION_SUBSCRIPTION,
    });

    const processed$ = source$.pipe(
      map((result) => {
        const notification = result.data?.notificationReceived;
        if (!notification) {
          throw new Error('No notification payload received');
        }

        const normalized = this.normalizeNotification(notification);
        this.updateNotificationCache(normalized);
        return normalized;
      }),
      catchError((err) => {
        this.logger.error('New notification subscription error:', err as Error);
        // Retourner null au lieu de propager l'erreur
        return of(null as unknown as Notification);
      }),
      // Filtrer les valeurs null
      filter((notification) => !!notification)
    );

    const sub = processed$.subscribe();
    this.subscriptions.push(sub);
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
      this.notifications.next(Array.from(this.notificationCache.values()));
      this.updateUnreadCount();
    }
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
  private normalizeNotMessage(message: any) {
    return {
      ...message,
      ...(message.attachments && {
        attachments: message.attachments.map((att: any) => ({
          url: att.url,
          type: att.type,
          ...(att.name && { name: att.name }),
          ...(att.size && { size: att.size }),
        })),
      }),
    };
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
  private updateCache(notifications: Notification[]) {
    this.logger.debug(
      'MessageService',
      `Updating notification cache with ${notifications.length} notifications`
    );

    if (notifications.length === 0) {
      this.logger.warn('MessageService', 'No notifications to update in cache');
    }

    notifications.forEach((notif) => {
      try {
        this.logger.debug('MessageService', 'Processing notification', notif);
        const normalized = this.normalizeNotification(notif);
        this.logger.debug(
          'MessageService',
          'Normalized notification',
          normalized
        );
        this.notificationCache.set(normalized.id, normalized);
      } catch (error) {
        this.logger.error(
          'MessageService',
          'Error normalizing notification',
          error
        );
      }
    });

    this.logger.debug(
      'MessageService',
      `Notification cache updated, size: ${this.notificationCache.size}`
    );
  }
  private updateUnreadCount() {
    const count = Array.from(this.notificationCache.values()).filter(
      (n) => !n.isRead
    ).length;
    this.notificationCount.next(count);
  }
  private updateNotificationCache(notification: Notification): void {
    this.notificationCache.set(notification.id, notification);
    this.notifications.next(Array.from(this.notificationCache.values()));
    this.updateUnreadCount();
  }
  private updateNotificationStatus(ids: string[], isRead: boolean) {
    ids.forEach((id) => {
      const notif = this.notificationCache.get(id);
      if (notif) {
        this.notificationCache.set(id, { ...notif, isRead });
      }
    });
    this.notifications.next(Array.from(this.notificationCache.values()));
    this.updateUnreadCount();
  }
  // Typing indicators
  startTyping(conversationId: string): Observable<boolean> {
    return this.apollo
      .mutate<StartTupingResponse>({
        mutation: START_TYPING_MUTATION,
        variables: { conversationId },
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
    return this.apollo
      .mutate<StopTypingResponse>({
        mutation: STOP_TYPING_MUTATION,
        variables: { conversationId },
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
