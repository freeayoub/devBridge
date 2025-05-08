import { Injectable, OnDestroy, NgZone } from '@angular/core';
import { Apollo } from 'apollo-angular';
import {
  BehaviorSubject,
  Observable,
  of,
  Subscription,
  throwError,
} from 'rxjs';
import {
  map,
  catchError,
  tap,
  filter,
  retryWhen,
  delay,
  take,
} from 'rxjs/operators';
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
    const variables: any = { receiverId, content };
    if (file) variables.file = file;
    if (conversationId) variables.conversationId = conversationId;
    if (replyTo) variables.replyTo = replyTo;

    const context = file ? { useMultipart: true, file } : undefined;

    return this.apollo
      .mutate<SendMessageResponse>({
        mutation: SEND_MESSAGE_MUTATION,
        variables,
        context,
      })
      .pipe(
        map((result) => {
          if (!result.data?.sendMessage)
            throw new Error('Failed to send message');
          return this.normalizeMessage(result.data.sendMessage);
        }),
        catchError((error) => {
          console.error('Error sending message:', error);
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
            timestamp: new Date(msg.timestamp),
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
              timestamp: new Date(msg.timestamp),
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
              timestamp: new Date(msg.timestamp),
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

  getConversation(conversationId: string): Observable<Conversation> {
    return this.apollo
      .watchQuery<GetConversationResponse>({
        query: GET_CONVERSATION_QUERY,
        variables: { conversationId },
        fetchPolicy: 'network-only',
      })
      .valueChanges.pipe(
        map((result) => {
          const conv = result.data?.getConversation;
          if (!conv) throw new Error('Conversation not found');
          return this.normalizeConversation(conv);
        }),
        catchError((error) => {
          console.error('Error fetching conversation:', error);
          return throwError(() => new Error('Failed to load conversation'));
        })
      );
  }
  // --------------------------------------------------------------------------
  // Section 2: Méthodes pour les Notifications
  // --------------------------------------------------------------------------
  getNotifications(refresh = false): Observable<Notification[]> {
    return this.apollo
      .watchQuery<getUserNotificationsResponse>({
        query: GET_NOTIFICATIONS_QUERY,
        fetchPolicy: refresh ? 'network-only' : 'cache-first',
      })
      .valueChanges.pipe(
        map((result) => {
          const notifications = result.data?.getUserNotifications || [];
          this.updateCache(notifications);
          this.notifications.next(Array.from(this.notificationCache.values()));
          this.updateUnreadCount();
          return Array.from(this.notificationCache.values());
        }),
        catchError((error) => {
          this.logger.error('Error loading notifications:', error);
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
    if (!notificationIds || notificationIds.length === 0) {
      return of({
        success: false,
        readCount: 0,
        remainingCount: this.notificationCount.value,
      });
    }

    return this.apollo
      .mutate<MarkNotificationsAsReadResponse>({
        mutation: MARK_NOTIFICATION_READ_MUTATION,
        variables: { notificationIds },
        optimisticResponse: {
          markNotificationsAsRead: {
            success: true,
            readCount: notificationIds.length,
            remainingCount: Math.max(
              0,
              this.notificationCount.value - notificationIds.length
            ),
          },
        },
        update: (cache) => {
          // Mise à jour optimiste du cache
          notificationIds.forEach((id) => {
            cache.modify({
              id: `Notification:${id}`,
              fields: {
                isRead: () => true,
                readAt: () => new Date().toISOString(),
              },
            });
          });
        },
      })
      .pipe(
        map((result) => {
          const response = result.data?.markNotificationsAsRead ?? {
            success: false,
            readCount: 0,
            remainingCount: this.notificationCount.value,
          };

          if (response.success) {
            this.updateNotificationStatus(notificationIds, true);
          }
          return response;
        }),
        catchError((error: Error) => {
          this.logger.error('Error marking notifications as read:', error);
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
    const now = Date.now();
    const cacheValid =
      !forceRefresh &&
      this.usersCache.length > 0 &&
      now - this.lastFetchTime <= this.CACHE_DURATION;

    if (cacheValid && !search) return of([...this.usersCache]);

    return this.apollo
      .watchQuery<GetAllUsersResponse>({
        query: GET_ALL_USER_QUERY,
        variables: { search },
        fetchPolicy: forceRefresh ? 'network-only' : 'cache-first',
      })
      .valueChanges.pipe(
        map((result) => {
          const users =
            result.data?.getAllUsers?.map((u) => this.normalizeUser(u)) || [];
          if (!search) {
            this.usersCache = [...users];
            this.lastFetchTime = Date.now();
          }
          return users;
        }),
        catchError((error) => {
          console.error('Error fetching users:', error);
          return throwError(() => new Error('Failed to fetch users'));
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
          console.error('Error fetching user:', error);
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
          console.error('Error fetching current user:', error);
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
          console.error('Error setting user online:', error);
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
          console.error('Error setting user offline:', error);
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
          console.error('Error fetching group:', error);
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
          console.error('Error fetching user groups:', error);
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
          console.error('Error creating group:', error);
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
          console.error('Error updating group:', error);
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
            timestamp: new Date(msg.timestamp),
            sender: this.normalizeUser(msg.sender),
          };
        }),
        catchError((error) => {
          console.error('Message subscription error:', error);
          return throwError(() => new Error('Message subscription failed'));
        })
      );

    const sub = sub$.subscribe();
    this.subscriptions.push(sub);
    return sub$;
  }
  subscribeToUserStatus(): Observable<User> {
    const sub$ = this.apollo
      .subscribe<{ userStatusChanged: User }>({
        query: USER_STATUS_SUBSCRIPTION,
      })
      .pipe(
        map((result) => {
          const user = result.data?.userStatusChanged;
          if (!user) throw new Error('No status payload received');
          return this.normalizeUser(user);
        }),
        catchError((error) => {
          console.error('Status subscription error:', error);
          return throwError(() => new Error('Status subscription failed'));
        })
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
                  timestamp: new Date(conv.lastMessage.timestamp),
                  readAt: conv.lastMessage.readAt
                    ? new Date(conv.lastMessage.readAt)
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
          console.error('Conversation subscription error:', error);
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
          console.error('Typing indicator subscription error:', error);
          return throwError(
            () => new Error('Typing indicator subscription failed')
          );
        })
      );

    const sub = sub$.subscribe();
    this.subscriptions.push(sub);
    return sub$;
  }
  subscribeToNotificationsRead(): Observable<string[]> {
    const sub$ = this.apollo
      .subscribe<NotificationsReadEvent>({
        query: NOTIFICATIONS_READ_SUBSCRIPTION,
      })
      .pipe(
        map((result) => {
          const notificationIds = result.data?.notificationsRead || [];
          this.updateNotificationStatus(notificationIds, true);
          return notificationIds;
        }),
        retryWhen((errors) =>
          errors.pipe(
            tap((err) =>
              this.logger.error('Notifications read subscription error:', err)
            ),
            delay(1000)
          )
        )
      );

    const sub = sub$.subscribe();
    this.subscriptions.push(sub);
    return sub$;
  }
  subscribeToNewNotifications(): Observable<Notification> {
    const source$ = this.apollo.subscribe<NotificationReceivedEvent>({
      query: NOTIFICATION_SUBSCRIPTION,
    });

    const processed$ = source$.pipe(
      map(this.processNotification),
      retryWhen(this.handleRetry)
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
    return {
      ...message,
      sender: this.normalizeUser(message.sender),
      timestamp: this.normalizeDate(message.timestamp),
      readAt: message.readAt ? this.normalizeDate(message.readAt) : undefined,
    };
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
    // Vérification des champs obligatoires
    if (!user.id && !user._id) {
      throw new Error('User ID is required');
    }
    if (!user.username) {
      throw new Error('Username is required');
    }
    if (!user.email) {
      throw new Error('Email is required');
    }
    if (user.isActive === undefined || user.isActive === null) {
      throw new Error('isActive status is required');
    }
    if (!user.role) {
      throw new Error('Role is required');
    }
    return {
      _id: user.id || user._id,
      id: user.id || user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      // Champs optionnels
      image: user.image ?? null,
      bio: user.bio,
      isOnline: user.isOnline,
      lastActive: user.lastActive ? new Date(user.lastActive) : undefined,
      createdAt: user.createdAt ? new Date(user.createdAt) : undefined,
      updatedAt: user.updatedAt ? new Date(user.updatedAt) : undefined,
      followingCount: user.followingCount,
      followersCount: user.followersCount,
      postCount: user.postCount,
    };
  }
  private normalizeConversation(conv: Conversation): Conversation {
    return {
      ...conv,
      participants: conv.participants?.map((p) => this.normalizeUser(p)) || [],
      messages: conv.messages?.map((msg) => this.normalizeMessage(msg)) || [],
      lastMessage: conv.lastMessage
        ? this.normalizeMessage(conv.lastMessage)
        : null,
      createdAt: this.normalizeDate(conv.createdAt),
      updatedAt: this.normalizeDate(conv.updatedAt),
    };
  }
  private normalizeDate(date: string | Date | undefined): Date {
    if (!date) return new Date();
    return typeof date === 'string' ? new Date(date) : date;
  }
  private toSafeISOString = (
    date: Date | string | undefined
  ): string | undefined => {
    if (!date) return undefined;
    return typeof date === 'string' ? date : date.toISOString();
  };
  private trackSubscription(sub$: Observable<any>): Subscription {
    const sub = sub$.subscribe();
    this.subscriptions.push(sub);
    return sub;
  }
  private normalizeNotification(notification: Notification): Notification {
    return {
      ...notification,
      timestamp: new Date(notification.timestamp),
      ...(notification.sender && {
        sender: this.normalizeSender(notification.sender),
      }),
      ...(notification.message && {
        message: this.normalizeNotMessage(notification.message),
      }),
    };
  }
  private normalizeSender(sender: any) {
    return {
      id: sender.id,
      username: sender.username,
      ...(sender.image && { image: sender.image }),
    };
  }
  private updateCache(notifications: Notification[]) {
    notifications.forEach((notif) => {
      const normalized = this.normalizeNotification(notif);
      this.notificationCache.set(normalized.id, normalized);
    });
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
  private processNotification(result: any): Notification {
    const notification = result.data?.notificationReceived;
    if (!notification) {
      throw new Error('No notification payload received');
    }

    const normalized = this.normalizeNotification(notification);
    this.updateNotificationCache(normalized);
    return normalized;
  }
  private handleRetry(errors: Observable<any>): Observable<any> {
    return errors.pipe(
      tap((err) => this.logger.error('Notification subscription error:', err)),
      delay(1000)
    );
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
  private handleError(message: string, error: any): Observable<never> {
    this.logger.error(message, error);
    return throwError(() => new Error(message));
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
          console.error('Error starting typing indicator:', error);
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
          console.error('Error stopping typing indicator:', error);
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
