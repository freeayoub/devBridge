import { Injectable } from '@angular/core';
import { Attachment } from 'src/app/models/message.model';
import { Apollo } from 'apollo-angular';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { map, catchError , tap} from 'rxjs/operators';
import {
  GET_NOTIFICATIONS_ATTACHAMENTS,
  GET_NOTIFICATIONS_QUERY,
  MARK_NOTIFICATION_READ_MUTATION,
  NOTIFICATION_SUBSCRIPTION,
  NOTIFICATIONS_READ_SUBSCRIPTION
} from 'src/app/graphql/message.graphql';
import { Notification } from 'src/app/models/notification.model';
@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private notificationCount = new BehaviorSubject<number>(0);
  public notificationCount$ = this.notificationCount.asObservable();
  private unreadNotifications = new BehaviorSubject<Notification[]>([]);
  public unreadNotifications$ = this.unreadNotifications.asObservable();
  constructor(private apollo: Apollo) {}

  getNotifications(): Observable<Notification[]> {
    return this.apollo
      .watchQuery<{ getUserNotifications: Notification[] }>({
        query: GET_NOTIFICATIONS_QUERY,
        fetchPolicy: 'network-only',
      })
      .valueChanges.pipe(
        map((result) => {
          const notifications = result.data?.getUserNotifications || [];
          this.updateUnreadCount(notifications.filter(n => !n.isRead).length);
          return notifications;
        }),
        catchError((error) => {
          console.error('Error fetching notifications:', error);
          return throwError(() => new Error('Failed to fetch notifications'));
        })
      );
  }
  markAsRead(notificationIds: string[]): Observable<boolean> {
    return this.apollo
      .mutate<{ markNotificationsAsRead: boolean }>({
        mutation: MARK_NOTIFICATION_READ_MUTATION,
        variables: { notificationIds },
        refetchQueries: [{
          query: GET_NOTIFICATIONS_QUERY,
          variables: { userId: this.getCurrentUserId() }
        }],
      })
      .pipe(
        map((result) => result.data?.markNotificationsAsRead ?? false),
        tap((success) => {
          if (success) {
            this.updateUnreadCount(this.notificationCount.value - notificationIds.length);
          }
        }),
        catchError((error) => {
          console.error('Error marking notifications as read:', error);
          return throwError(() => new Error('Failed to mark notifications as read'));
        })
      );
  }

  subscribeToNotifications(): Observable<Notification> {
    return this.apollo.subscribe<{ notificationReceived: Notification }>({
      query: NOTIFICATION_SUBSCRIPTION
    }).pipe(
      map(result => {
        if (!result.data?.notificationReceived) {
          throw new Error('Invalid notification received');
        }
        const notification = result.data.notificationReceived;
        
        // Update unread count
        if (!notification.isRead) {
          this.notificationCount.next(this.notificationCount.value + 1);
        }
        
        return notification;
      }),
      catchError(error => {
        console.error('Notification subscription error:', error);
        return throwError(() => new Error('Notification subscription failed'));
      })
    );
  }

  subscribeToNotificationsRead(): Observable<string[]> {
    return this.apollo.subscribe<{ notificationsRead: string[] }>({
      query: NOTIFICATIONS_READ_SUBSCRIPTION
    }).pipe(
      map(result => {
        if (!result.data?.notificationsRead) {
          throw new Error('Invalid notifications read event');
        }
        return result.data.notificationsRead;
      }),
      catchError(error => {
        console.error('Notifications read subscription error:', error);
        return throwError(() => new Error('Notifications read subscription failed'));
      })
    );
  }

  updateUnreadCount(count: number): void {
    this.notificationCount.next(count);
  }
// In notification service
getNotificationAttachments(notificationId: string): Observable<Attachment[]> {
  return this.apollo.query<{ getNotificationAttachments: Attachment[] }>({
    query:GET_NOTIFICATIONS_ATTACHAMENTS,
    variables: { id: notificationId }
  }).pipe(
    map(result => result.data.getNotificationAttachments)
  );
}
  private getCurrentUserId(): string {
    return localStorage.getItem('userId') || '';
  }
}