import { Injectable, OnDestroy } from '@angular/core';
import { Apollo } from 'apollo-angular';
import {
  BehaviorSubject,
  Observable,
  of,
  Subscription,
  throwError,
} from 'rxjs';
import { catchError, delay, filter, map, retryWhen, take, tap } from 'rxjs/operators';
import {
  Conversation,
  Group,
  Message,
  MessageFilter
} from 'src/app/models/message.model';

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
  STOP_TYPING_MUTATION,
  START_TYPING_MUTATION,
  TYPING_INDICATOR_SUBSCRIPTION
} from '../graphql/message.graphql';
import {User} from 'src/app/models/user.model';
import { TypingIndicatorEvent } from 'src/app/models/message.model';
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

  private getCurrentUserId(): string {
    return localStorage.getItem('userId') || '';
  }
  setActiveConversation(conversationId: string): void {
    this.activeConversation.next(conversationId);
  }
  // User operations
  getAllUsers(forceRefresh = false, search?: string): Observable<User[]> {
    const now = Date.now();
    const cacheValid =
      !forceRefresh &&
      this.usersCache.length > 0 &&
      now - this.lastFetchTime <= this.CACHE_DURATION;

    if (cacheValid && !search) {
      return of([...this.usersCache]);
    }

    return this.apollo
      .watchQuery<{ getAllUsers: User[] }>({
        query: GET_ALL_USER_QUERY,
        variables: { search },
        fetchPolicy: forceRefresh ? 'network-only' : 'cache-first',
      })
      .valueChanges.pipe(
        map((result) => {
          const users = result.data.getAllUsers;
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
      .watchQuery<{ getOneUser: User  }>({
        query: GET_USER_QUERY,
        variables: { id: userId },
        fetchPolicy: 'network-only',
      })
      .valueChanges.pipe(
        map((result) => this.normalizeUser(result.data.getOneUser)),
        catchError((error) => {
          console.error('Error fetching user:', error);
          return throwError(() => new Error('Failed to fetch user'));
        })
      );
  }
  // Conversation operations
  getConversations(): Observable<Conversation[]> {
    return this.apollo
      .watchQuery<{ getConversations: Conversation[] }>({
        query: GET_CONVERSATIONS_QUERY,
        fetchPolicy: 'network-only',
      })
      .valueChanges.pipe(
        map((result) => result.data?.getConversations || []),
        catchError((error) => {
          console.error('GraphQL error:', error);
          return throwError(() => new Error('Failed to load conversations'));
        })
      );
  }
  getConversation(conversationId: string): Observable<Conversation> {
    return this.apollo
      .watchQuery<{ getConversation: Conversation }>({
        query: GET_CONVERSATION_QUERY,
        variables: { conversationId },
        fetchPolicy: 'network-only',
      })
      .valueChanges.pipe(
        map((result) => result.data.getConversation),
        catchError((error) => {
          console.error('Error fetching conversation:', error);
          return throwError(() => new Error('Failed to load conversation'));
        })
      );
  }
  // Message operations
  sendMessage(
    receiverId: string,
    content: string,
    file?: File
  ): Observable<Message> {
    const variables = file
      ? { receiverId, content, file }
      : { receiverId, content };

    const context = file
      ? {
          useMultipart: true,
          file: file,
        }
      : undefined;

    return this.apollo
      .mutate<{ sendMessage: Message }>({
        mutation: SEND_MESSAGE_MUTATION,
        variables,
        context,
      })
      .pipe(
        map((result) => {
          if (!result.data?.sendMessage) {
            throw new Error('Failed to send message');
          }
          return result.data.sendMessage;
        }),
        catchError((error) => {
          console.error('Error sending message:', error);
          return throwError(() => new Error('Failed to send message'));
        })
      );
  }
  markMessageAsRead(messageId: string): Observable<Message> {
    return this.apollo
      .mutate<{ markMessageAsRead: Message }>({
        mutation: MARK_AS_READ_MUTATION,
        variables: { messageId },
      })
      .pipe(
        map((result) => {
          if (!result.data?.markMessageAsRead) {
            throw new Error('Failed to mark message as read');
          }
          return result.data.markMessageAsRead;
        }),
        catchError((error) => {
          console.error('Error marking message as read:', error);
          return throwError(() => new Error('Failed to mark message as read'));
        })
      );
  }
  searchMessages(
    query: string,
    conversationId?: string,
    filters: MessageFilter = {} 
  ): Observable<Message[]> {
    return this.apollo
      .watchQuery<{ searchMessages: Message[] }>({
        query: SEARCH_MESSAGES_QUERY,
        variables: { 
          query, 
          conversationId,
          ...filters,
          dateFrom: filters.dateFrom?.toISOString(),
          dateTo: filters.dateTo?.toISOString()
        },
        fetchPolicy: 'network-only',
      })
      .valueChanges.pipe(
        map((result) => result.data?.searchMessages || []),
        catchError((error) => {
          console.error('Error searching messages:', error);
          return throwError(() => new Error(
            error.graphQLErrors?.[0]?.message || 
            'Failed to search messages'
          ));
        })
      );
  }
  getUnreadMessages(userId: string): Observable<Message[]> {
    return this.apollo
      .watchQuery<{ getUnreadMessages: Message[] }>({
        query: GET_UNREAD_MESSAGES_QUERY,
        variables: { userId },
        fetchPolicy: 'network-only',
      })
      .valueChanges.pipe(
        map((result) => result.data?.getUnreadMessages || []),
        catchError((error) => {
          console.error('Error fetching unread messages:', error);
          return throwError(() => new Error('Failed to fetch unread messages'));
        })
      );
  }
  // Group operations
  getGroup(groupId: string): Observable<Group> {
    return this.apollo
      .watchQuery<{ getGroup: any }>({
        query: GET_GROUP_QUERY,
        variables: { id: groupId },
        fetchPolicy: 'network-only',
      })
      .valueChanges.pipe(
        map((result) => result.data.getGroup),
        catchError(error => {
          console.error('Error fetching group:', error);
          return throwError(() => new Error('Failed to fetch group'));
        })
      );
  }
  getUserGroups(userId: string): Observable<Group[]> {
    return this.apollo
      .watchQuery<{ getUserGroups: any[] }>({
        query: GET_USER_GROUPS_QUERY,
        variables: { userId },
        fetchPolicy: 'network-only',
      })
      .valueChanges.pipe(
        map((result) => result.data.getUserGroups || []),
        catchError(error => {
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
    const variables = photo ? 
      { name, participantIds, photo, description } : 
      { name, participantIds, description };

    const context = photo ? {
      useMultipart: true,
      file: photo
    } : undefined;

    return this.apollo
      .mutate<{ createGroup: Group }>({
        mutation: CREATE_GROUP_MUTATION,
        variables,
        context,
        refetchQueries: [{
          query: GET_USER_GROUPS_QUERY,
          variables: { userId: this.getCurrentUserId() }
        }]
      })
      .pipe(
        map(result => {
          if (!result.data?.createGroup) {
            throw new Error('Failed to create group');
          }
          return result.data.createGroup;
        }),
        catchError(error => {
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
    const context = input.photo ? {
      useMultipart: true,
      file: input.photo
    } : undefined;

    // Remove photo from input if it exists since it's handled separately
    const { photo, ...inputWithoutPhoto } = input;

    return this.apollo
      .mutate<{ updateGroup: Group }>({
        mutation: UPDATE_GROUP_MUTATION,
        variables: {
          id: groupId,
          input: inputWithoutPhoto
        },
        context,
        refetchQueries: [
          {
            query: GET_GROUP_QUERY,
            variables: { id: groupId }
          },
          {
            query: GET_USER_GROUPS_QUERY,
            variables: { userId: this.getCurrentUserId() }
          }
        ]
      })
      .pipe(
        map(result => {
          if (!result.data?.updateGroup) {
            throw new Error('Failed to update group');
          }
          return result.data.updateGroup;
        }),
        catchError(error => {
          console.error('Error updating group:', error);
          return throwError(() => new Error('Failed to update group'));
        })
      );
  }
  // Status operations
  setUserOnline(userId: string): Observable<User > {
    return this.apollo
      .mutate<{ setUserOnline: User }>({
        mutation: SET_USER_ONLINE_MUTATION,
        variables: { userId },
      })
      .pipe(
        map((result) => {
          if (!result.data?.setUserOnline) {
            throw new Error('Failed to set user online');
          }
          return this.normalizeUser(result.data.setUserOnline);
        }),
        catchError(error => {
          console.error('Error setting user online:', error);
          return throwError(() => new Error('Failed to set user online'));
        })
      );
  }
  setUserOffline(userId: string): Observable<User > {
    return this.apollo
      .mutate<{ setUserOffline: User }>({
        mutation: SET_USER_OFFLINE_MUTATION,
        variables: { userId },
      })
      .pipe(
        map((result) => {
          if (!result.data?.setUserOffline) {
            throw new Error('Failed to set user offline');
          }
          return this.normalizeUser(result.data.setUserOffline);
        }),
        catchError(error => {
          console.error('Error setting user offline:', error);
          return throwError(() => new Error('Failed to set user offline'));
        })
      );
  }
  // Subscriptions
  subscribeToNewMessages(conversationId: string): Observable<Message> {
    const subscription = this.apollo
      .subscribe<{ messageSent: Message }>({
        query: MESSAGE_SENT_SUBSCRIPTION,
        variables: { conversationId }
      })
      .pipe(
        map((result) => {
          if (!result?.data?.messageSent) {
            throw new Error('No message payload received');
          }
          return result.data.messageSent;
        }),
        catchError(error => {
          console.error('Message subscription error:', error);
          return throwError(() => new Error('Message subscription failed'));
        })
      );

    this.subscriptions.push(subscription.subscribe());
    return subscription;
  }
 subscribeToUserStatus(): Observable<User > {
    const subscription = this.apollo
      .subscribe<{ userStatusChanged: User }>({
        query: USER_STATUS_SUBSCRIPTION,
        fetchPolicy: 'no-cache',
      })
      .pipe(
        map((result) => {
          if (!result?.data?.userStatusChanged) {
            throw new Error('No status payload received');
          }
          return this.normalizeUser(result.data.userStatusChanged);
        }),
        retryWhen((errors) =>
          errors.pipe(
            tap((err) => console.log('Retrying status subscription:', err)),
            delay(2000),
            take(3)
          )
        ),
        catchError((error) => {
          console.error('Status subscription error:', error);
          return throwError(() => new Error('Failed to subscribe to user status'));
        })
      );

    this.subscriptions.push(subscription.subscribe());
    return subscription;
  }
  subscribeToConversationUpdates(conversationId: string): Observable<Conversation> {
    const subscription = this.apollo
      .subscribe<{ conversationUpdated: Conversation }>({
        query: CONVERSATION_UPDATED_SUBSCRIPTION,
        variables: { conversationId }
      })
      .pipe(
        map((result) => {
          if (!result?.data?.conversationUpdated) {
            throw new Error('Invalid conversation update received');
          }
          return result.data.conversationUpdated;
        }),
        catchError(error => {
          console.error('Conversation subscription error:', error);
          return throwError(() => new Error('Conversation subscription failed'));
        })
      );

    this.subscriptions.push(subscription.subscribe());
    return subscription;
  }

  subscribeToTypingIndicator(conversationId: string): Observable<TypingIndicatorEvent> {
    return this.apollo.subscribe<{ typingIndicator: TypingIndicatorEvent }>({
      query: TYPING_INDICATOR_SUBSCRIPTION,
      variables: { conversationId }
    }).pipe(
      map(result => result.data?.typingIndicator),
      filter(Boolean)
    );
  }
  
  startTyping(input: { userId: string, conversationId: string }): Observable<boolean> {
    return this.apollo.mutate<{ startTyping: boolean }>({
      mutation: START_TYPING_MUTATION,
      variables: { input }
    }).pipe(
      map(result => result.data?.startTyping || false)
    );
  }
  
  stopTyping(input: { userId: string, conversationId: string }): Observable<boolean> {
    return this.apollo.mutate<{ stopTyping: boolean }>({
      mutation: STOP_TYPING_MUTATION,
      variables: { input }
    }).pipe(
      map(result => result.data?.stopTyping || false)
    );
  }
  // Helper methods
  normalizeUser(user: any): any {
    if (!user) return null;
    return {
      _id: user._id || user.id,
      id: user._id || user.id,
      username: user.username,
      email: user.email,
      image: user.image,
      isOnline: user.isOnline,
      lastActive: user.lastActive ? new Date(user.lastActive) : null,
      createdAt: user.createdAt ? new Date(user.createdAt) : null,
      updatedAt: user.updatedAt ? new Date(user.updatedAt) : null
    };
  }
  cleanupSubscriptions(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    this.subscriptions = [];
  }
  ngOnDestroy() {
    this.cleanupSubscriptions();
  }
}