import { Injectable } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import { Observable, of, Subscription, throwError } from 'rxjs';
import { catchError, delay, map,retryWhen,take, tap } from 'rxjs/operators';
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
  GET_ALL_USER_QUERY
} from 'src/app/models/graph-queries';
import { User } from 'src/app/models/user.model';
@Injectable({
  providedIn: 'root',
})
export class GraphqlDataService {
  private readonly CACHE_DURATION = 300000;
  private lastFetchTime = 0;
  private usersCache: User[] = [];
  private subscriptions: Subscription[] = [];
  constructor(private apollo: Apollo) {}
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
        query:GET_ALL_USER_QUERY,
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
  getOneUser(id: string): Observable<User> {
    return this.apollo
      .watchQuery<{ getOneUser: User }>({
        query: GET_USER_QUERY ,
        variables: { id },
        fetchPolicy: 'network-only',
      })
      .valueChanges.pipe(map((result) => result.data.getOneUser));
  }
    // Conversations
  getConversations(): Observable<Conversation[]> {
    return this.apollo
      .watchQuery<{ getConversations: Conversation[] }>({
        query:GET_CONVERSATIONS_QUERY,
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
  subscribeToNewMessages(
    senderId: string,
    receiverId: string
  ): Observable<AppMessage> {
    return this.apollo
      .subscribe<{ messageSent: AppMessage }>({
        query: gql`
          subscription MessageSent($senderId: ID!, $receiverId: ID!) {
            messageSent(senderId: $senderId, receiverId: $receiverId) {
              id
              content
              timestamp
              isRead
              sender {
                id
                username
                image
              }
              conversationId
            }
          }
        `,
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
        query: gql`
          subscription UserStatusChanged {
            userStatusChanged {
              id
              username
              isOnline
              lastActive
            }
          }
        `,
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
 // Messages
  sendMessage(
    senderId: string,
    receiverId: string,
    content: string,
  ): Observable<Message> {
    return this.apollo
      .mutate<SendMessageResponse>({
        mutation:SEND_MESSAGE_MUTATION ,
        variables: { senderId, receiverId, content},  
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
  normalizeUser(user: any): User {
    return {
      ...user,
      _id: user._id || user.id,
      id: user.id || user._id,
    };
  }
}


// import { Injectable } from '@angular/core';
// import { Apollo } from 'apollo-angular';
// import { Observable, Subscription } from 'rxjs';
// import { map } from 'rxjs/operators';
// import { 
//   GET_CONVERSATIONS_QUERY,
//   GET_CONVERSATION_QUERY,
//   SEND_MESSAGE_MUTATION,
//   MARK_AS_READ_MUTATION,
//   MESSAGE_SENT_SUBSCRIPTION,
//   USER_STATUS_SUBSCRIPTION,
//   GET_USER_QUERY
// } from './graphql-queries';
// import { Conversation, AppMessage } from '@app/models/message.model';
// import { User } from '@app/models/user.model';

// @Injectable({
//   providedIn: 'root'
// })
// export class MessageService {
//   private subscriptions: Subscription[] = [];

//   constructor(private apollo: Apollo) {}

//   // Conversations
//   getConversations(): Observable<Conversation[]> {
//     return this.apollo.watchQuery<{ getConversations: Conversation[] }>({
//       query: GET_CONVERSATIONS_QUERY,
//       fetchPolicy: 'network-only'
//     }).valueChanges.pipe(
//       map(result => result.data.getConversations || [])
//     );
//   }

//   getConversation(conversationId: string): Observable<Conversation> {
//     return this.apollo.watchQuery<{ getConversation: Conversation }>({
//       query: GET_CONVERSATION_QUERY,
//       variables: { conversationId },
//       fetchPolicy: 'network-only'
//     }).valueChanges.pipe(
//       map(result => result.data.getConversation)
//     );
//   }

//   // Messages
//   sendMessage(senderId: string, receiverId: string, content: string): Observable<AppMessage> {
//     return this.apollo.mutate<{ sendMessage: AppMessage }>({
//       mutation: SEND_MESSAGE_MUTATION,
//       variables: { senderId, receiverId, content }
//     }).pipe(
//       map(result => result.data?.sendMessage)
//     );
//   }

//   markAsRead(messageId: string): Observable<boolean> {
//     return this.apollo.mutate<{ markMessageAsRead: boolean }>({
//       mutation: MARK_AS_READ_MUTATION,
//       variables: { messageId }
//     }).pipe(
//       map(result => result.data?.markMessageAsRead || false)
//     );
//   }

//   // Subscriptions
//   subscribeToNewMessages(senderId: string, receiverId: string): Observable<AppMessage> {
//     return this.apollo.subscribe<{ messageSent: AppMessage }>({
//       query: MESSAGE_SENT_SUBSCRIPTION,
//       variables: { senderId, receiverId }
//     }).pipe(
//       map(result => result.data?.messageSent)
//     );
//   }

//   subscribeToUserStatus(): Observable<User> {
//     return this.apollo.subscribe<{ userStatusChanged: User }>({
//       query: USER_STATUS_SUBSCRIPTION
//     }).pipe(
//       map(result => this.normalizeUser(result.data?.userStatusChanged))
//     );
//   }

//   // User operations
//   getOneUser(userId: string): Observable<User> {
//     return this.apollo.watchQuery<{ getUser: User }>({
//       query: GET_USER_QUERY,
//       variables: { userId },
//       fetchPolicy: 'network-only'
//     }).valueChanges.pipe(
//       map(result => this.normalizeUser(result.data.getUser))
//     );
//   }

//   // Utility methods
//   normalizeUser(user: any): User {
//     if (!user) return null;
//     return {
//       _id: user._id || user.id,
//       id: user._id || user.id,
//       username: user.username,
//       email: user.email,
//       image: user.image,
//       isOnline: user.isOnline,
//       lastActive: user.lastActive ? new Date(user.lastActive) : null,
//       createdAt: user.createdAt ? new Date(user.createdAt) : null,
//       updatedAt: user.updatedAt ? new Date(user.updatedAt) : null
//     };
//   }

//   cleanupSubscriptions(): void {
//     this.subscriptions.forEach(sub => sub.unsubscribe());
//     this.subscriptions = [];
//   }

//   ngOnDestroy() {
//     this.cleanupSubscriptions();
//   }
// }