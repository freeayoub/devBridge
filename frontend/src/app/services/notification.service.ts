import { Injectable } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { BehaviorSubject, Observable, throwError  } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { 
  GET_NOTIFICATIONS_QUERY,
  MARK_NOTIFICATION_READ_MUTATION,
  NOTIFICATION_SUBSCRIPTION 
} from '../graphql/message.graphql';
import { Notification } from 'src/app/models/notification.model'
@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private notificationCount = new BehaviorSubject<number>(0);
  public notificationCount$ = this.notificationCount.asObservable();
  constructor(private apollo: Apollo) {
    
  }
  getNotifications(userId: string): Observable<Notification[]> {
    return this.apollo.watchQuery<{ getNotifications: Notification[] }>({
      query: GET_NOTIFICATIONS_QUERY,
      variables: { userId },
      fetchPolicy: 'network-only'
    }).valueChanges.pipe(
      map(result => result.data.getNotifications),
      catchError(error => {
        console.error('Error fetching notifications:', error);
        return throwError(() => new Error('Failed to fetch notifications'));
      })
    );
  }

  markAsRead(notificationIds: string[]): Observable<Notification[]> {
    return this.apollo.mutate<{ markNotificationsAsRead: Notification[] }>({
      mutation: MARK_NOTIFICATION_READ_MUTATION,
      variables: { notificationIds }
    }).pipe(
      map(result => result.data?.markNotificationsAsRead || []),
      catchError(error => {
        console.error('Error marking notifications as read:', error);
        return throwError(() => new Error('Failed to mark notifications as read'));
      })
    );
  }
  
  subscribeToNotifications(userId: string): Observable<Notification> {
    return this.apollo.subscribe<{ notificationReceived: Notification }>({
      query: NOTIFICATION_SUBSCRIPTION,
      variables: { userId }
    }).pipe(
      map(result => {
        if (!result.data?.notificationReceived) {
          throw new Error('Invalid notification received');
        }
        return result.data.notificationReceived;
      }),
      catchError(error => {
        console.error('Notification subscription error:', error);
        return throwError(() => new Error('Notification subscription failed'));
      })
    );
  }

  updateUnreadCount(count: number): void {
    this.notificationCount.next(count);
  }

  
}