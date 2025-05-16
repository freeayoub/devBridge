import { Component, OnInit, OnDestroy } from '@angular/core';
import { MessageService } from 'src/app/services/message.service';
import { Observable, Subject, of, throwError } from 'rxjs';
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

  constructor(private messageService: MessageService) {
    this.notifications$ = this.messageService.notifications$;
    this.unreadCount$ = this.messageService.notificationCount$;
  }
  ngOnInit(): void {
    this.loadNotifications();
    this.setupSubscriptions();
  }
  loadNotifications(): void {
    console.log('NotificationListComponent: Loading notifications');
    this.loading = true;
    this.error = null;

    this.messageService
      .getNotifications(true)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (notifications) => {
          console.log(
            'NotificationListComponent: Notifications loaded successfully',
            notifications
          );
          this.loading = false;
        },
        error: (err: Error) => {
          console.error(
            'NotificationListComponent: Error loading notifications',
            err
          );
          this.error = err;
          this.loading = false;
        },
      });
  }
  setupSubscriptions(): void {
    this.messageService
      .subscribeToNewNotifications()
      .pipe(
        takeUntil(this.destroy$),
        catchError((error) => {
          console.error('Notification stream error:', error);
          return of(null);
        })
      )
      .subscribe();
    this.messageService
      .subscribeToNotificationsRead()
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
    console.log('Marking notification as read:', notificationId);

    if (!notificationId) {
      console.error('Invalid notification ID:', notificationId);
      this.error = new Error('Invalid notification ID');
      return;
    }

    // Afficher des informations de débogage sur la notification
    this.notifications$.pipe(take(1)).subscribe((notifications) => {
      const notification = notifications.find((n) => n.id === notificationId);
      if (notification) {
        console.log('Found notification to mark as read:', {
          id: notification.id,
          type: notification.type,
          isRead: notification.isRead,
        });

        // Mettre à jour localement la notification
        const updatedNotifications = notifications.map((n) =>
          n.id === notificationId
            ? { ...n, isRead: true, readAt: new Date().toISOString() }
            : n
        );

        // Mettre à jour l'interface utilisateur immédiatement
        (this.messageService as any).notifications.next(updatedNotifications);

        // Mettre à jour le compteur de notifications non lues
        const unreadCount = updatedNotifications.filter(
          (n) => !n.isRead
        ).length;
        (this.messageService as any).notificationCount.next(unreadCount);

        // Mettre à jour le cache de notifications dans le service
        this.updateNotificationCache(updatedNotifications);

        // Appeler le service pour marquer la notification comme lue
        this.messageService
          .markAsRead([notificationId])
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (result) => {
              console.log('Mark as read result:', result);
              if (result && result.success) {
                console.log('Notification marked as read successfully');
                // Si l'erreur était liée à cette opération, la réinitialiser
                if (this.error && this.error.message.includes('mark')) {
                  this.error = null;
                }
              }
            },
            error: (err) => {
              console.error('Error marking notification as read:', err);
              console.error('Error details:', {
                message: err.message,
                stack: err.stack,
                notificationId,
              });
              // Ne pas définir d'erreur pour éviter de perturber l'interface utilisateur
              // this.error = err;
            },
          });
      } else {
        console.warn('Notification not found in local cache:', notificationId);

        // Forcer le rechargement des notifications
        this.loadNotifications();
      }
    });
  }

  // Méthode pour mettre à jour le cache de notifications dans le service
  private updateNotificationCache(notifications: any[]): void {
    // Mettre à jour le cache de notifications dans le service
    const notificationCache = (this.messageService as any).notificationCache;
    if (notificationCache) {
      notifications.forEach((notification) => {
        notificationCache.set(notification.id, notification);
      });

      // Forcer la mise à jour du compteur
      const unreadCount = notifications.filter((n) => !n.isRead).length;
      (this.messageService as any).notificationCount.next(unreadCount);

      console.log('Notification cache updated, new unread count:', unreadCount);
    }
  }

  markAllAsRead(): void {
    console.log('Marking all notifications as read');

    this.notifications$.pipe(take(1)).subscribe((notifications) => {
      console.log('All notifications:', notifications);
      const unreadIds = notifications.filter((n) => !n.isRead).map((n) => n.id);

      console.log('Unread notification IDs to mark as read:', unreadIds);

      if (unreadIds.length === 0) {
        console.log('No unread notifications to mark as read');
        return;
      }

      // Vérifier que tous les IDs sont valides
      const validIds = unreadIds.filter(
        (id) => id && typeof id === 'string' && id.trim() !== ''
      );

      if (validIds.length !== unreadIds.length) {
        console.error('Some notification IDs are invalid:', unreadIds);
        this.error = new Error('Invalid notification IDs');
        return;
      }

      console.log('Marking all notifications as read:', validIds);

      // Mettre à jour localement toutes les notifications
      const updatedNotifications = notifications.map((n) =>
        validIds.includes(n.id)
          ? { ...n, isRead: true, readAt: new Date().toISOString() }
          : n
      );

      // Mettre à jour l'interface utilisateur immédiatement
      (this.messageService as any).notifications.next(updatedNotifications);

      // Mettre à jour le compteur de notifications non lues
      const unreadCount = updatedNotifications.filter((n) => !n.isRead).length;
      (this.messageService as any).notificationCount.next(unreadCount);

      // Mettre à jour le cache de notifications dans le service
      this.updateNotificationCache(updatedNotifications);

      // Appeler le service pour marquer toutes les notifications comme lues
      this.messageService
        .markAsRead(validIds)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (result) => {
            console.log('Mark all as read result:', result);
            if (result && result.success) {
              console.log('All notifications marked as read successfully');
              // Si l'erreur était liée à cette opération, la réinitialiser
              if (this.error && this.error.message.includes('mark')) {
                this.error = null;
              }
            }
          },
          error: (err) => {
            console.error('Error marking all notifications as read:', err);
            console.error('Error details:', {
              message: err.message,
              stack: err.stack,
            });
            // Ne pas définir d'erreur pour éviter de perturber l'interface utilisateur
            // this.error = err;
          },
        });
    });
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
