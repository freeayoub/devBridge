import { Injectable } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { 
  GET_NOTIFICATIONS_QUERY,
  MARK_NOTIFICATION_READ_MUTATION,
  NOTIFICATION_SUBSCRIPTION 
} from '../models/graph-queries';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  constructor(private apollo: Apollo) {}

  getNotifications(userId: string): Observable<any> {
    return this.apollo.watchQuery<any>({
      query: GET_NOTIFICATIONS_QUERY,
      variables: { userId },
      fetchPolicy: 'network-only'
    }).valueChanges.pipe(
      map(result => result.data.getNotifications)
    );
  }

  markAsRead(notificationIds: string[]): Observable<any> {
    return this.apollo.mutate({
      mutation: MARK_NOTIFICATION_READ_MUTATION,
      variables: { notificationIds }
    }).pipe(
      map(result => result.data)//.markNotificationsAsRead
    );
  }

  subscribeToNotifications(userId: string): Observable<any> {
    return this.apollo.subscribe({
      query: NOTIFICATION_SUBSCRIPTION,
      variables: { userId }
    }).pipe(
      map(result => result.data)//.notificationReceived
    );
  }
}