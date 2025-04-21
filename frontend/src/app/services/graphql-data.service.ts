import { Injectable } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import { Observable, throwError } from 'rxjs';
import { catchError, delay, map, retryWhen, take, tap } from 'rxjs/operators';
@Injectable({
  providedIn: 'root',
})
export class GraphqlDataService {
  constructor(private apollo: Apollo) {}
  // Get conversations list
  getConversations(): Observable<any> {
    return this.apollo
      .watchQuery({
        query: gql`
          query GetConversations {
            getConversations {
              id
              createdAt
              updatedAt
              unreadCount
              participants {
                id
                username
                email
                image
                isOnline
              }
              lastMessage {
                id
                content
                timestamp
                isRead
                senderId
                receiverId
              }
            }
          }
        `,
        fetchPolicy: 'network-only',
        errorPolicy: 'all',
      })
      .valueChanges.pipe(
        catchError((error) => {
          console.error('GraphQL error:', error);
          return throwError(() => new Error('Failed to load conversations'));
        })
      );
  }
  getConversation(conversationId: string): Observable<any> {
    return this.apollo.watchQuery({
      query: gql`
        query GetConversation($conversationId: ID!) {
          getConversation(conversationId: $conversationId) {
            id
            participants {
              id
              username
              image
              isOnline
            }
            messages {
              id
              content
              timestamp
              isRead
              sender {
                id
                username
                image
              }
            }
            updatedAt
          }
        }
      `,
      variables: { conversationId },
      fetchPolicy: 'network-only',
    }).valueChanges;
  }
  subscribeToNewMessages(
    senderId: string,
    receiverId: string
  ): Observable<any> {
    return this.apollo
      .subscribe({
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
        map((result: any) => {
          if (!result?.data?.messageSent) {
            throw new Error('No message payload received');
          }
          return result.data.messageSent;
        }),
        catchError((error) => {
          console.error('Message subscription error:', error);
          return throwError(() => new Error('Failed to subscribe to messages'));
        })
      );
  }
  subscribeToUserStatus(): Observable<any> {
    return this.apollo
      .subscribe({
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
      })
      .pipe(
        map((result: any) => {
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
    content: string
  ): Observable<any> {
    return this.apollo.mutate({
      mutation: gql`
        mutation SendMessage(
          $senderId: ID!
          $receiverId: ID!
          $content: String!
        ) {
          sendMessage(
            senderId: $senderId
            receiverId: $receiverId
            content: $content
          ) {
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
      variables: { senderId, receiverId, content },
    });
  }
  markMessageAsRead(id: any): Observable<any> {
    return this.apollo.subscribe({
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
    });
  }
}
