import { Injectable } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import { Observable, of, throwError } from 'rxjs';
import { catchError, delay, map, retryWhen, take, tap } from 'rxjs/operators';
import {
  AppMessage,
  Conversation,
  GetConversationResponse,
  GetConversationsResponse,
  MarkMessageAsReadResponse,
  Message,
  SendMessageResponse,
  UserStatusResponse,
} from '@app/models/message.model';
import { User } from '@app/models/user.model';
@Injectable({
  providedIn: 'root',
})
export class GraphqlDataService {
  private readonly CACHE_DURATION = 300000;
  private lastFetchTime = 0;
  private usersCache: User[] = [];
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
        query: gql`
          query GetAllUsers($search: String) {
            getAllUsers(search: $search) {
              id
              username
              email
              role
              image
              isActive
              isOnline
              lastActive
              createdAt
              updatedAt
            }
          }
        `,
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
        query: gql`
          query GetOneUser($id: ID!) {
            getOneUser(id: $id) {
              id
              username
              email
              role
              image
              isActive
              isOnline
              lastActive
              createdAt
              updatedAt
            }
          }
        `,
        variables: { id },
        fetchPolicy: 'network-only',
      })
      .valueChanges.pipe(map((result) => result.data.getOneUser));
  }
  getConversations(): Observable<Conversation[]> {
    return this.apollo
      .watchQuery<{ getConversations: Conversation[] }>({
        query: gql`
          query GetConversations {
            getConversations {
              id
              participants {
                id
                username
                image
                isOnline
                lastActive
              }
              lastMessage {
                id
                content
                timestamp
                isRead
              }
              unreadCount
              updatedAt
            }
          }
        `,
        fetchPolicy: 'network-only',
      })
      .valueChanges.pipe(
        map((result) => result.data?.getConversations),
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
        query: gql`
          query GetConversation($conversationId: ID!) {
            getConversation(conversationId: $conversationId) {
              id
              participants {
                username
              }
              messages {
                content
              }
              lastMessage {
                id
                content
              }
            }
          }
        `,
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

  sendMessage(
    senderId: string,
    receiverId: string,
    content: string,
  ): Observable<Message> {
    return this.apollo
      .mutate<SendMessageResponse>({
        mutation: gql`
         mutation SendMessage($senderId: ID!, $receiverId: ID!, $content: String!) {
  sendMessage(senderId: $senderId, receiverId: $receiverId, content: $content) {
    id
     senderId
     receiverId
  
  }
}
        `,
        variables: { senderId, receiverId, content},  
      })
      .pipe(map((result) => result.data?.sendMessage as Message));
  }

  markMessageAsRead(
    messageId: string
  ): Observable<{ id: string; isRead: boolean }> {
    return this.apollo
      .mutate<MarkMessageAsReadResponse>({
        mutation: gql`
          mutation MarkMessageAsRead($messageId: ID!) {
            markMessageAsRead(messageId: $messageId) {
              id
              isRead
            }
          }
        `,
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
