import { Component, OnInit, OnDestroy } from '@angular/core';
import { MessageService } from 'src/app/services/message.service';
import { Observable, Subject, of } from 'rxjs';
import { Notification } from 'src/app/models/message.model';
import { catchError, map, takeUntil, switchMap, take } from 'rxjs/operators';
@Component({
  selector: 'app-notification-list',
  templateUrl: './notification-list.component.html',
  styleUrls: ['./notification-list.component.css'],
})
export class NotificationListComponent implements OnInit, OnDestroy {
  notifications$: Observable<Notification[]>;
  unreadCount$: Observable<number>;
  loading = true;
  error: Error | null = null;
  private destroy$ = new Subject<void>();

  constructor(private MessageService: MessageService) {
    this.notifications$ = this.MessageService.notifications$;
    this.unreadCount$ = this.MessageService.notificationCount$;
  }
  ngOnInit(): void {
    this.loadNotifications();
    this.setupSubscriptions();
  }
  loadNotifications(): void {
    this.loading = true;
    this.error = null;

    this.MessageService.getNotifications(true)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => (this.loading = false),
        error: (err) => {
          this.error = err;
          this.loading = false;
        },
      });
  }
  setupSubscriptions(): void {
    this.MessageService.subscribeToNewNotifications()
      .pipe(
        takeUntil(this.destroy$),
        catchError((error) => {
          console.error('Notification stream error:', error);
          return of(null);
        })
      )
      .subscribe();
    this.MessageService.subscribeToNotificationsRead()
      .pipe(
        takeUntil(this.destroy$),
        catchError((error) => {
          console.error('Notifications read stream error:', error);
          return of(null);
        })
      )
      .subscribe();
  }
  markAsRead(notificationId: string): void {
    this.MessageService.markAsRead([notificationId]).subscribe({
      next: (result) => {
        if (!result.success) {
          console.error('Failed to mark notification as read');
        }
      },
      error: (err) => console.error('Error:', err),
    });
  }
  markAllAsRead(): void {
    this.notifications$
      .pipe(
        take(1),
        switchMap((notifications) => {
          const unreadIds = notifications
            .filter((n) => !n.isRead)
            .map((n) => n.id);
          return unreadIds.length > 0
            ? this.MessageService.markAsRead(unreadIds)
            : of(null);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe();
  }
  hasNotifications(): Observable<boolean> {
    return this.notifications$.pipe(
      map((notifications) => notifications?.length > 0)
    );
  }
  hasUnreadNotifications(): Observable<boolean> {
    return this.unreadCount$.pipe(map((count) => count > 0));
  }
  acceptFriendRequest(notification: Notification): void {
    this.markAsRead(notification.id);
  }
  getErrorMessage(): string {
    return this.error?.message || 'Unknown error occurred';
  }
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
