import { Component, OnInit, OnDestroy } from '@angular/core';
import { NotificationService } from 'src/app/services/notification.service';
import { Subscription } from 'rxjs';
import { Notification } from 'src/app/models/notification.model';
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

  constructor(private notificationService: NotificationService) {}

  ngOnInit(): void {
    this.loadNotifications();
    this.subscribeToNewNotifications();
    this.subscribeToNotificationsRead();
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

  hasUnreadNotifications(): boolean {
    return this.notifications.some(notification => !notification.isRead);
  }
  
  subscribeToNewNotifications(): void {
    const sub = this.notificationService.subscribeToNotifications().subscribe({
      next: (notification) => {
        this.notifications.unshift(notification);
        this.updateUnreadCount();
      },
      error: (err) => {
        console.error('Notification subscription error:', err);
      },
    });
    this.subscriptions.push(sub);
  }

  subscribeToNotificationsRead(): void {
    const sub = this.notificationService.subscribeToNotificationsRead().subscribe({
      next: (readIds) => {
        this.notifications = this.notifications.map(n => 
          readIds.includes(n.id) ? { ...n, isRead: true } : n
        );
        this.updateUnreadCount();
      },
      error: (err) => {
        console.error('Notifications read subscription error:', err);
      }
    });
    this.subscriptions.push(sub);
  }

  markAsRead(notificationId: string): void {
    this.notificationService.markAsRead([notificationId]).subscribe({
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

    this.notificationService.markAsRead(unreadIds).subscribe({
      error: (error) => {
        console.error('Error marking notifications as read:', error);
      },
    });
  }

  private updateUnreadCount(): void {
    const unreadCount = this.notifications.filter(n => !n.isRead).length;
    this.notificationService.updateUnreadCount(unreadCount);
  }
  acceptFriendRequest(notification: Notification): void {
    // Implement friend request acceptance logic
    this.markAsRead(notification.id);
    // Additional friend request handling
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }
}

// import { Component, OnInit, OnDestroy } from '@angular/core';
// import { NotificationService } from 'src/app/services/notification.service';
// import { Subscription } from 'rxjs';
// import { Notification } from 'src/app/models/notification.model';
// import { FriendsService } from 'src/app/services/friends.service'; // Nouveau service
// import { ToastService } from 'src/app/services/toast.service'; // Service de notification

// @Component({
//   selector: 'app-notifications',
//   templateUrl: './notifications.component.html',
//   styleUrls: ['./notifications.component.css'],
// })
// export class NotificationsComponent implements OnInit, OnDestroy {
//   notifications: Notification[] = [];
//   loading = true;
//   error: any;
//   hasMoreNotifications = true;
//   private subscriptions: Subscription[] = [];

//   constructor(
//     private notificationService: NotificationService,
//     private friendsService: FriendsService, // Injection du service
//     private toastService: ToastService // Injection du service de toast
//   ) {}

//   ngOnInit(): void {
//     this.loadNotifications();
//     this.subscribeToNewNotifications();
//     this.subscribeToNotificationsRead();
//   }

//   loadNotifications(): void {
//     this.loading = true;
//     this.error = null;
    
//     const sub = this.notificationService.getNotifications().subscribe({
//       next: (notifications) => {
//         this.notifications = notifications;
//         this.loading = false;
//         this.updateUnreadCount();
//       },
//       error: (error) => {
//         this.error = error;
//         this.loading = false;
//         this.toastService.showError('Failed to load notifications');
//       },
//     });
//     this.subscriptions.push(sub);
//   }

//   loadMoreNotifications(): void {
//     // Implémentez la pagination si votre API la supporte
//   }

//   hasUnreadNotifications(): boolean {
//     return this.notifications.some(notification => !notification.isRead);
//   }
  
//   subscribeToNewNotifications(): void {
//     const sub = this.notificationService.subscribeToNotifications().subscribe({
//       next: (notification) => {
//         this.notifications.unshift(notification);
//         this.updateUnreadCount();
//         this.toastService.showInfo('New notification received');
//       },
//       error: (err) => {
//         console.error('Notification subscription error:', err);
//         this.toastService.showError('Notification update failed');
//       },
//     });
//     this.subscriptions.push(sub);
//   }

//   subscribeToNotificationsRead(): void {
//     const sub = this.notificationService.subscribeToNotificationsRead().subscribe({
//       next: (readIds) => {
//         this.notifications = this.notifications.map(n => 
//           readIds.includes(n.id) ? { ...n, isRead: true } : n
//         );
//         this.updateUnreadCount();
//       },
//       error: (err) => {
//         console.error('Notifications read subscription error:', err);
//       }
//     });
//     this.subscriptions.push(sub);
//   }

//   markAsRead(notificationId: string): void {
//     this.notificationService.markAsRead([notificationId]).subscribe({
//       next: () => {
//         this.notifications = this.notifications.map(n => 
//           n.id === notificationId ? { ...n, isRead: true } : n
//         );
//         this.updateUnreadCount();
//       },
//       error: (err) => {
//         console.error('Failed to mark notification as read:', err);
//         this.toastService.showError('Failed to mark as read');
//       },
//     });
//   }

//   markAllAsRead(): void {
//     const unreadIds = this.notifications
//       .filter((n) => !n.isRead)
//       .map((n) => n.id);

//     if (unreadIds.length === 0) return;

//     this.notificationService.markAsRead(unreadIds).subscribe({
//       next: () => {
//         this.notifications = this.notifications.map(n => ({ ...n, isRead: true }));
//         this.updateUnreadCount();
//         this.toastService.showSuccess('All notifications marked as read');
//       },
//       error: (error) => {
//         console.error('Error marking notifications as read:', error);
//         this.toastService.showError('Failed to mark all as read');
//       },
//     });
//   }

//   acceptFriendRequest(notification: Notification): void {
//     const senderId = notification.sender.id;
//     this.friendsService.acceptFriendRequest(senderId).subscribe({
//       next: () => {
//         this.markAsRead(notification.id);
//         this.toastService.showSuccess(`Friend request from ${notification.sender.username} accepted`);
//         // Optionally remove the notification
//         this.notifications = this.notifications.filter(n => n.id !== notification.id);
//       },
//       error: (err) => {
//         console.error('Failed to accept friend request:', err);
//         this.toastService.showError('Failed to accept friend request');
//       }
//     });
//   }

//   private updateUnreadCount(): void {
//     const unreadCount = this.notifications.filter(n => !n.isRead).length;
//     this.notificationService.updateUnreadCount(unreadCount);
//   }

//   ngOnDestroy(): void {
//     this.subscriptions.forEach((sub) => sub.unsubscribe());
//   }
// }