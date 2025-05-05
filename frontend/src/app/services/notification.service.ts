import { Injectable, OnDestroy } from '@angular/core';
import { Attachment } from 'src/app/models/message.model';
import { Apollo } from 'apollo-angular';
import { BehaviorSubject, Observable, Subscription, throwError } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import {
  GET_NOTIFICATIONS_ATTACHAMENTS,
  GET_NOTIFICATIONS_QUERY,
  MARK_NOTIFICATION_READ_MUTATION,
  NOTIFICATION_SUBSCRIPTION,
  NOTIFICATIONS_READ_SUBSCRIPTION,
} from 'src/app/graphql/message.graphql';
import { Notification } from 'src/app/models/notification.model';
@Injectable({
  providedIn: 'root',
})
export class NotificationService implements OnDestroy {
  public notificationCount = new BehaviorSubject<number>(0);
  public notificationCount$ = this.notificationCount.asObservable();
  public notifications = new BehaviorSubject<Notification[]>([]);
  public notifications$ = this.notifications.asObservable();
  private subscriptions: Subscription[] = [];

  constructor(private apollo: Apollo) {}
  // Helper methods
  private normalizeNotification(notification: Notification): Notification {
    return {
      ...notification,
    };
  }
  // Notification methods
  getNotifications(): Observable<Notification[]> {
    return this.apollo
      .watchQuery<{ getUserNotifications: Notification[] }>({
        query: GET_NOTIFICATIONS_QUERY,
        fetchPolicy: 'network-only',
      })
      .valueChanges.pipe(
        map((result) => {
          const notifications = result.data?.getUserNotifications || [];
          this.notifications.next(notifications);
          this.updateUnreadCount(notifications.filter((n) => !n.isRead).length);
          return notifications.map((notif) =>
            this.normalizeNotification(notif)
          );
        }),
        catchError((error) => {
          console.error('Error loading notifications:', error);
          return throwError(() => new Error('Failed to load notifications'));
        })
      );
  }

  markAsRead(notificationIds: string[]): Observable<{
    success: boolean;
    readCount: number;
    remainingCount: number;
  }> {
    return this.apollo.mutate<{
      markNotificationsAsRead: {
        success: boolean;
        readCount: number;
        remainingCount: number;
      };
    }>({
      mutation: MARK_NOTIFICATION_READ_MUTATION,
      variables: { notificationIds },
      update: (cache, { data }) => {
        if (data?.markNotificationsAsRead.success) {
          this.notificationCount.next(data.markNotificationsAsRead.remainingCount);
          
          // Update local notifications state
          const current = this.notifications.value;
          const updated = current.map(n => 
            notificationIds.includes(n.id) ? { ...n, isRead: true } : n
          );
          this.notifications.next(updated);
        }
      }
    }).pipe(
      map(result => result.data?.markNotificationsAsRead || {
        success: false,
        readCount: 0,
        remainingCount: this.notificationCount.value
      }),
      catchError(error => {
        console.error('Error marking notifications as read:', error);
        return throwError(() => new Error('Failed to mark notifications as read'));
      })
    );
  }

  subscribeToNewNotifications(): Observable<Notification> {
    const sub$ = this.apollo.subscribe<{ notificationReceived: Notification }>({
      query: NOTIFICATION_SUBSCRIPTION
    }).pipe(
      map(result => {
        const notification = result.data?.notificationReceived;
        if (!notification) throw new Error('No notification payload received');
        
        // Construction type-safe de l'objet normalisé
        const normalized: Notification = {
          id: notification.id,
          type: notification.type,
          content: notification.content,
          timestamp: new Date(notification.timestamp),
          isRead: notification.isRead,
          // Gestion type-safe du sender
          ...(notification.sender ? {
            sender: {
              id: notification.sender.id,
              username: notification.sender.username,
              ...(notification.sender.image && { image: notification.sender.image })
            }
          } : {}),
          // Gestion type-safe du message
          ...(notification.message ? {
            message: {
              ...(notification.message.id && { id: notification.message.id }),
              content: notification.message.content,
              ...(notification.message.attachments && {
                attachments: notification.message.attachments.map(att => ({
                  url: att.url,
                  type: att.type,
                  ...(att.name && { name: att.name }),
                  ...(att.size && { size: att.size })
                }))
              })
            }
          } : {})
        };
  
        // Mise à jour de l'état local de manière immuable
        this.notifications.next([
          normalized,
          ...this.notifications.value.filter(n => n.id !== normalized.id)
        ]);
        this.notificationCount.next(this.notificationCount.value + 1);
        
        return normalized;
      }),
      catchError(error => {
        console.error('Notification subscription error:', error);
        return throwError(() => new Error('Failed to subscribe to notifications'));
      })
    );
  
    const sub = sub$.subscribe();
    this.subscriptions.push(sub);
    return sub$;
  }

  subscribeToNotificationsRead(): Observable<string[]> {
    const sub$ = this.apollo.subscribe<{ notificationsRead: string[] }>({
      query: NOTIFICATIONS_READ_SUBSCRIPTION
    }).pipe(
      map(result => {
        const notificationIds = result.data?.notificationsRead || [];
        
        // Update local state
        const current = this.notifications.value;
        const updated = current.map(n => 
          notificationIds.includes(n.id) ? { ...n, isRead: true } : n
        );
        this.notifications.next(updated);
        
        const readCount = notificationIds.length;
        this.notificationCount.next(Math.max(0, this.notificationCount.value - readCount));
        
        return notificationIds;
      }),
      catchError(error => {
        console.error('Notifications read subscription error:', error);
        return throwError(() => new Error('Notifications read subscription failed'));
      })
    );

    const sub = sub$.subscribe();
    this.subscriptions.push(sub);
    return sub$;
  }

  getNotificationAttachments(notificationId: string): Observable<Attachment[]> {
    return this.apollo.query<{ getNotificationAttachments: Attachment[] }>({
      query: GET_NOTIFICATIONS_ATTACHAMENTS,
      variables: { id: notificationId }
    }).pipe(
      map(result => result.data?.getNotificationAttachments || []),
      catchError(error => {
        console.error('Error fetching notification attachments:', error);
        return throwError(() => new Error('Failed to fetch attachments'));
      })
    );
  }

  updateUnreadCount(count: number): void {
    this.notificationCount.next(count);
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
}
