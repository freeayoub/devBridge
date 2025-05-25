import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { NotificationService, Notification } from 'src/app/services/notification.service';

@Component({
  selector: 'app-notification',
  template: `
    <div *ngIf="notification"
         class="notification-container"
         [ngClass]="'alert-' + notification.type">
      <div class="notification-content">
        <i class="bi"
           [ngClass]="{
             'bi-check-circle-fill': notification.type === 'success',
             'bi-exclamation-triangle-fill': notification.type === 'warning',
             'bi-info-circle-fill': notification.type === 'info',
             'bi-x-circle-fill': notification.type === 'error'
           }"></i>
        <span>{{ notification.message }}</span>
      </div>
      <button type="button" class="btn-close" (click)="closeNotification()"></button>
    </div>
  `,
  styles: [`
    .notification-container {
      position: fixed;
      top: 20px;
      right: 20px;
      min-width: 300px;
      z-index: 9999;
      padding: 15px;
      border-radius: 4px;
      box-shadow: 0 4px 8px rgba(0,0,0,0.1);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .notification-content {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .alert-success {
      background-color: #d4edda;
      border-color: #c3e6cb;
      color: #155724;
    }
    .alert-error {
      background-color: #f8d7da;
      border-color: #f5c6cb;
      color: #721c24;
    }
    .alert-info {
      background-color: #d1ecf1;
      border-color: #bee5eb;
      color: #0c5460;
    }
    .alert-warning {
      background-color: #fff3cd;
      border-color: #ffeeba;
      color: #856404;
    }
  `]
})
export class NotificationComponent implements OnInit, OnDestroy {
  notification: Notification | null = null;
  private subscription: Subscription = new Subscription();

  constructor(private notificationService: NotificationService) {}

  ngOnInit(): void {
    this.subscription = this.notificationService.getNotifications().subscribe(notification => {
      this.notification = notification;
    });
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  closeNotification(): void {
    this.notificationService.clear();
  }
}