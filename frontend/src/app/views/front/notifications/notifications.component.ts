import { Component, OnInit, OnDestroy } from '@angular/core';
import { NotificationService } from 'src/app/services/notification.service';
import { GraphqlDataService } from 'src/app/services/graphql-data.service';
import { Subscription } from 'rxjs';
import { AuthuserService } from 'src/app/services/authuser.service';
@Component({
  selector: 'app-notifications',
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.css']
})
export class NotificationsComponent implements OnInit, OnDestroy {
  notifications: any[] = [];
  loading = true;
  error: any;
  private subscriptions: Subscription[] = [];

  constructor(
    private notificationService: NotificationService,
    private GraphqlDataService:GraphqlDataService,
    private authService: AuthuserService
  ) {}

  ngOnInit(): void {
    this.loadNotifications();
    this.subscribeToNewNotifications();
  }

  loadNotifications(): void {
    const userId = this.authService.getCurrentUserId();
    if (!userId) return;

    const sub = this.notificationService.getNotifications(userId).subscribe({
      next: (notifications) => {
        this.notifications = notifications;
        this.loading = false;
      },
      error: (error) => {
        this.error = error;
        this.loading = false;
      }
    });
    this.subscriptions.push(sub);
  }

  subscribeToNewNotifications(): void {
    const userId = this.authService.getCurrentUserId();
    if (!userId) return;

    const sub = this.notificationService.subscribeToNotifications(userId).subscribe({
      next: (notification) => {
        this.notifications = [notification, ...this.notifications];
      },
      error: (error) => {
        console.error('Notification subscription error:', error);
      }
    });
    this.subscriptions.push(sub);
  }

  markAsRead(notificationId: string): void {
    const sub = this.notificationService.markAsRead([notificationId]).subscribe({
      next: () => {
        this.notifications = this.notifications.map(n => 
          n.id === notificationId ? { ...n, isRead: true } : n
        );
      },
      error: (error) => {
        console.error('Error marking notification as read:', error);
      }
    });
    this.subscriptions.push(sub);
  }

  markAllAsRead(): void {
    const unreadIds = this.notifications
      .filter(n => !n.isRead)
      .map(n => n.id);

    if (unreadIds.length === 0) return;

    const sub = this.notificationService.markAsRead(unreadIds).subscribe({
      next: () => {
        this.notifications = this.notifications.map(n => 
          unreadIds.includes(n.id) ? { ...n, isRead: true } : n
        );
      },
      error: (error) => {
        console.error('Error marking notifications as read:', error);
      }
    });
    this.subscriptions.push(sub);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
}