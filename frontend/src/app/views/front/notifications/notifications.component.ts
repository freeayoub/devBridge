import { Component, OnInit, OnDestroy } from '@angular/core';
import { NotificationService } from 'src/app/services/notification.service';
import { Subscription } from 'rxjs';
import { Notification } from 'src/app/models/notification.model';
import { User } from 'src/app/models/user.model';
@Component({
  selector: 'app-notifications',
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.css'],
})
export class NotificationsComponent implements OnInit, OnDestroy {
  notifications: Notification[] = [];
  loading = true;
  error: any;
  private subscriptions: Subscription[] = [];

  constructor(
    private notificationService: NotificationService,
  ) {}

  ngOnInit(): void {
    this.loadNotifications();
    this.subscribeToNewNotifications();
  }

  loadNotifications(): void {
    const sub = this.notificationService.getNotifications().subscribe({
      next: (notifications) => {
        this.notifications = notifications;
        this.loading = false;
      },
      error: (error) => {
        this.error = error;
        this.loading = false;
      },
    });
    this.subscriptions.push(sub);
  }
  // Proper implementation based on your interface
  hasUnreadNotifications(): boolean {
    return this.notifications.some(notification => !notification.isRead);
  }
  subscribeToNewNotifications(): void {
    const sub = this.notificationService.subscribeToNotifications().subscribe({
      next: (notification) => {
        this.notifications.unshift(notification);
        this.notificationService.updateUnreadCount(
          this.notifications.filter((n) => !n.isRead).length
        );
      },
      error: (err) => {
        console.error('Notification subscription error:', err);
      },
    });
    this.subscriptions.push(sub);
  }

  markAsRead(notificationId: string): void {
    this.notificationService.markAsRead([notificationId]).subscribe({
      next: (success) => {
        if (success) {
          const notification = this.notifications.find(
            (n) => n.id === notificationId
          );
          if (notification) {
            notification.isRead = true;
            this.notificationService.updateUnreadCount(
              this.notifications.filter((n) => !n.isRead).length
            );
          }
        }
      },
      error: (err) => {
        console.error('Failed to mark notification as read:', err);
      },
    });
  }

  markAllAsRead(): void {
    const unreadIds = this.notifications
      .filter((n) => !n.isRead)
      .map((n) => n.id);

    if (unreadIds.length === 0) return;

    const sub = this.notificationService.markAsRead(unreadIds).subscribe({
      next: () => {
        this.notifications = this.notifications.map((n) =>
          unreadIds.includes(n.id) ? { ...n, isRead: true } : n
        );
      },
      error: (error) => {
        console.error('Error marking notifications as read:', error);
      },
    });
    this.subscriptions.push(sub);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }
}
