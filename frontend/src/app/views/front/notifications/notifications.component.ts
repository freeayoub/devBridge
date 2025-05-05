import { Component, OnInit, OnDestroy } from '@angular/core';
import { NotificationService } from 'src/app/services/notification.service';
import { EMPTY,Observable, Subject } from 'rxjs';
import { Notification } from 'src/app/models/notification.model';
import { catchError, map, takeUntil } from 'rxjs/operators';
@Component({
  selector: 'app-notifications',
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.css'],
})
export class NotificationsComponent implements OnInit, OnDestroy {
  notifications$: Observable<Notification[]>;
  unreadCount$: Observable<number> ;
  loading = true;
  error: Error | null = null;
  private destroy$ = new Subject<void>();

  constructor(private notificationService:NotificationService) {
    this.notifications$ = this.notificationService.notifications$;
    this.unreadCount$ = this.notificationService.notificationCount$;
  }
  ngOnInit(): void {
    this.loadNotifications();
    this.setupSubscriptions();
  }

  loadNotifications(): void {
    this.loading = true;
    this.error = null;
    
      this.notificationService.getNotifications().subscribe({
      next: () => this.loading = false,
      error: (err) => {
        this.error = err.message;
        this.loading = false;
      }
    });
  }

  setupSubscriptions(): void {
      this.notificationService
      .subscribeToNewNotifications()
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          console.error('Notification stream error:', error);
          return EMPTY;
        })
      )
      .subscribe();
      this.notificationService
      .subscribeToNotificationsRead()
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          console.error('Notifications read stream error:', error);
          return EMPTY;
        })
      )
      .subscribe();
  }
  
  markAsRead(notificationId: string): void {
   this.notificationService.markAsRead([notificationId]).subscribe({
      next: (result) => {
        if (!result.success) {
          console.error('Failed to mark notification as read');
        }
      },
      error: (err) => console.error('Error:', err)
    });
 
  }

  markAllAsRead(): void {
    this.notifications$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(notifications => {
      const unreadIds = notifications
        .filter(n => !n.isRead)
        .map(n => n.id);
  
      if (unreadIds.length > 0) {
        this.notificationService.markAsRead(unreadIds).subscribe();
      }
    });
  }

  hasUnreadNotifications(): Observable<boolean> {
    return this.unreadCount$.pipe(
      map(count => count > 0)
    );
  }

  acceptFriendRequest(notification: Notification): void {
   
    this.markAsRead(notification.id);
  }
hasNotifications(): boolean {
  return this.notificationService.notifications.value?.length > 0;
}
getErrorMessage(): string {
  return this.error?.message || 'Unknown error occurred';
}

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}