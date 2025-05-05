import { Injectable, OnDestroy } from '@angular/core';
import { Apollo } from 'apollo-angular';
import {
  BehaviorSubject,
  Observable,
  of,
  Subscription,
  throwError,
} from 'rxjs';
import {
  catchError,
  delay,
  filter,
  map,
  retryWhen,
  take,
  tap,
} from 'rxjs/operators';
import {
  Conversation,
  Group,
  Message,
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
} from 'src/app/models/message.model';
import { User } from 'src/app/models/user.model';
import {
  GET_CONVERSATIONS_QUERY,
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
} from '../graphql/message.graphql';
@Injectable({
  providedIn: 'root',
})
export class GraphqlDataService implements OnDestroy {
  private activeConversation = new BehaviorSubject<string | null>(null);
  public activeConversation$ = this.activeConversation.asObservable();
  private readonly CACHE_DURATION = 300000;
  private lastFetchTime = 0;
  private usersCache: User[] = [];
  private subscriptions: Subscription[] = [];

  constructor(private apollo: Apollo) {}

  // Helper methods
  private getCurrentUserId(): string {
    return localStorage.getItem('userId') || '';
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
  private normalizeMessage(message: Message): Message {
    return {
      ...message,
      sender: this.normalizeUser(message.sender),
      timestamp: this.normalizeDate(message.timestamp),
      readAt: message.readAt ? this.normalizeDate(message.readAt) : undefined,
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
  cleanupSubscriptions(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    this.subscriptions = [];
  }

  // Conversation methods
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

  // Message methods
  sendMessage(
    receiverId: string,
    content: string,
    file?: File
  ): Observable<Message> {
    const variables = file
      ? { receiverId, content, file }
      : { receiverId, content };
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
          return {
            ...result.data.sendMessage,
            timestamp: new Date(result.data.sendMessage.timestamp),
            sender: this.normalizeUser(result.data.sendMessage.sender),
          };
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

  // Subscriptions
  subscribeToNewMessages(conversationId: string): Observable<Message> {
    const sub$ = this.apollo.subscribe<{ messageSent: Message }>({
      query: MESSAGE_SENT_SUBSCRIPTION,
      variables: { conversationId }
    }).pipe(
      map(result => {
        const msg = result.data?.messageSent;
        if (!msg) throw new Error('No message payload received');
        return {
          ...msg,
          timestamp: new Date(msg.timestamp),
          sender: this.normalizeUser(msg.sender)
        };
      }),
      catchError(error => {
        console.error('Message subscription error:', error);
        return throwError(() => new Error('Message subscription failed'));
      })
    );

    const sub = sub$.subscribe();
    this.subscriptions.push(sub);
    return sub$;
  }
  subscribeToUserStatus(): Observable<User> {
    const sub$ = this.apollo.subscribe<{ userStatusChanged: User }>({
      query: USER_STATUS_SUBSCRIPTION
    }).pipe(
      map(result => {
        const user = result.data?.userStatusChanged;
        if (!user) throw new Error('No status payload received');
        return this.normalizeUser(user);
      }),
      catchError(error => {
        console.error('Status subscription error:', error);
        return throwError(() => new Error('Status subscription failed'));
      })
    );

    const sub = sub$.subscribe();
    this.subscriptions.push(sub);
    return sub$;
  }
  subscribeToConversationUpdates(conversationId: string): Observable<Conversation> {
    const sub$ = this.apollo.subscribe<{ conversationUpdated: Conversation }>({
      query: CONVERSATION_UPDATED_SUBSCRIPTION,
      variables: { conversationId }
    }).pipe(
      map(result => {
        const conv = result.data?.conversationUpdated;
        if (!conv) throw new Error('No conversation payload received');
        
        const normalizedConversation: Conversation = {
          ...conv,
          participants: conv.participants?.map(p => this.normalizeUser(p)) || [],
          lastMessage: conv.lastMessage ? {
            ...conv.lastMessage,
            sender: this.normalizeUser(conv.lastMessage.sender),
            timestamp: new Date(conv.lastMessage.timestamp),
            readAt: conv.lastMessage.readAt ? new Date(conv.lastMessage.readAt) : undefined,
            // Conservez toutes les autres propriétés du message
            id: conv.lastMessage.id,
            content: conv.lastMessage.content,
            type: conv.lastMessage.type,
            isRead: conv.lastMessage.isRead,
            // ... autres propriétés nécessaires
          } : null // On conserve null comme dans votre version originale
        };
  
        return normalizedConversation as Conversation; // Assertion de type si nécessaire
      }),
      catchError(error => {
        console.error('Conversation subscription error:', error);
        return throwError(() => new Error('Conversation subscription failed'));
      })
    );
  
    const sub = sub$.subscribe();
    this.subscriptions.push(sub);
    return sub$;
  }
  subscribeToTypingIndicator(conversationId: string): Observable<TypingIndicatorEvent> {
    const sub$ = this.apollo.subscribe<TypingIndicatorEvents>({
      query: TYPING_INDICATOR_SUBSCRIPTION,
      variables: { conversationId }
    }).pipe(
      map(result => result.data?.typingIndicator),
      filter(Boolean),
      catchError(error => {
        console.error('Typing indicator subscription error:', error);
        return throwError(() => new Error('Typing indicator subscription failed'));
      })
    );

    const sub = sub$.subscribe();
    this.subscriptions.push(sub);
    return sub$;
  }

  // Typing indicators
  startTyping(conversationId: string): Observable<boolean> {
    return this.apollo.mutate<StartTupingResponse>({
      mutation: START_TYPING_MUTATION,
      variables: { conversationId }
    }).pipe(
      map(result => result.data?.startTyping || false),
      catchError(error => {
        console.error('Error starting typing indicator:', error);
        return throwError(() => new Error('Failed to start typing indicator'));
      })
    );
  }
  stopTyping(conversationId: string): Observable<boolean> {
    return this.apollo.mutate<StopTypingResponse>({
      mutation: STOP_TYPING_MUTATION,
      variables: { conversationId }
    }).pipe(
      map(result => result.data?.stopTyping || false),
      catchError(error => {
        console.error('Error stopping typing indicator:', error);
        return throwError(() => new Error('Failed to stop typing indicator'));
      })
    );
  }

 // ngOnDestroy indicators
  ngOnDestroy() {
    this.cleanupSubscriptions();
  }
}
