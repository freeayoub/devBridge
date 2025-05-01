import { Injectable, OnDestroy } from '@angular/core';
import { Apollo} from 'apollo-angular';
import { BehaviorSubject, Observable, of, Subscription, throwError } from 'rxjs';
import { catchError, delay, map, retryWhen, take, tap } from 'rxjs/operators';
import {
  AppMessage,
  Conversation,
  GetConversationResponse,
  MarkMessageAsReadResponse,
  Message,
  SendMessageResponse,
  UserStatusResponse,
} from '@app/models/message.model';
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
  SET_USER_OFFLINE_MUTATION
} from '../graphql/message.graphql';
import { User } from 'src/app/models/user.model';
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
  constructor(private apollo: Apollo) {

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
        fetchPolicy: 'network-only',
      })
      .valueChanges.pipe(
        map((result) => {
          const users = result.data.getAllUsers;
          if (!search) {
            this.usersCache = [...users];
            this.lastFetchTime = Date.now();
          }
          return users;
        })
      );
  }
  getOneUser(userId: string): Observable<User> {
    return this.apollo
      .watchQuery<{ getOneUser: User }>({
        query: GET_USER_QUERY,
        variables: { userId },
        fetchPolicy: 'network-only',
      })
      .valueChanges.pipe(
        map((result) => this.normalizeUser(result.data.getOneUser))
      );
  }
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
  getConversation(
    conversationId: string
  ): Observable<GetConversationResponse['getConversation']> {
    return this.apollo
      .watchQuery<GetConversationResponse>({
        query: GET_CONVERSATION_QUERY,
        variables: { conversationId },
        fetchPolicy: 'network-only',
      })
      .valueChanges.pipe(map((result) => result.data.getConversation));
  }
  sendMessage(
senderId: string, receiverId: string, content: string ): Observable<Message> {
    return this.apollo
      .mutate<SendMessageResponse>({
        mutation: SEND_MESSAGE_MUTATION,
        variables: { senderId, receiverId, content },
      })
      .pipe(map((result) => result.data?.sendMessage as Message));
  }
  markMessageAsRead(
    messageId: string
  ): Observable<{ id: string; isRead: boolean }> {
    return this.apollo
      .mutate<MarkMessageAsReadResponse>({
        mutation: MARK_AS_READ_MUTATION,
        variables: {
          messageId: messageId,
        },
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
  searchMessages(query: string, conversationId?: string): Observable<Message[]> {
    return this.apollo
      .watchQuery<{ searchMessages: Message[] }>({
        query: SEARCH_MESSAGES_QUERY,
        variables: { query, conversationId },
        fetchPolicy: 'network-only',
      })
      .valueChanges.pipe(
        map((result) => result.data?.searchMessages || []),
        catchError((error) => {
          console.error('Error searching messages:', error);
          return throwError(() => new Error('Failed to search messages'));
        })
      );
  }
  getUnreadMessages(): Observable<Message[]> {
    return this.apollo
      .watchQuery<{ getUnreadMessages: Message[] }>({
        query: GET_UNREAD_MESSAGES_QUERY,
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
  setUserOnline(userId: string): Observable<User> {
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
        })
      );
  }
  setUserOffline(userId: string): Observable<User> {
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
        })
      );
  }
  subscribeToConversationUpdates(conversationId: string): Observable<Conversation> {
    return this.apollo.subscribe<{ conversationUpdated: Conversation }>({
      query: CONVERSATION_UPDATED_SUBSCRIPTION,
      variables: { conversationId }
    }).pipe(
      map(result => {
        if (!result?.data?.conversationUpdated) {
          throw new Error('Invalid conversation update received');
        }
        return result.data.conversationUpdated;
      })
    );
  }
  subscribeToNewMessages(
    senderId: string,
    receiverId: string
  ): Observable<AppMessage> {
    return this.apollo
      .subscribe<{ messageSent: AppMessage }>({
        query: MESSAGE_SENT_SUBSCRIPTION,
        variables: { senderId, receiverId },
      })
      .pipe(
        map((result) => {
          if (!result?.data?.messageSent) {
            throw new Error('No message payload received');
          }
          return {
            ...result.data.messageSent,
            timestamp: new Date(result.data.messageSent.timestamp),
          };
        })
      );
  }
  subscribeToUserStatus(): Observable<User> {
    return this.apollo
      .subscribe<UserStatusResponse>({
        query: USER_STATUS_SUBSCRIPTION ,
        fetchPolicy: 'no-cache',
      })
      .pipe(
        map((result) => {
          if (!result?.data?.userStatusChanged) {
            throw new Error('No status payload received');
          }
          return result.data.userStatusChanged;
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
          return throwError(
            () => new Error('Failed to subscribe to user status')
          );
        })
      );
  }
  normalizeUser(user: any): any {
    if (!user) return null;
    return {
      _id: user._id || user.id,
      id: user._id || user.id,
      username: user.username,
      email: user.email,
      image: user.image,
      isOnline: user.isOnline,
      // lastActive: user.lastActive ? new Date(user.lastActive) : null,
      // createdAt: user.createdAt ? new Date(user.createdAt) : null,
      // updatedAt: user.updatedAt ? new Date(user.updatedAt) : null
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