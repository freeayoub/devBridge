import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface Notification {
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  timeout?: number;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private notificationSubject = new BehaviorSubject<Notification | null>(null);

  constructor() {}

  getNotifications(): Observable<Notification | null> {
    return this.notificationSubject.asObservable();
  }

  showSuccess(message: string, timeout: number = 5000): void {
    this.show({ message, type: 'success', timeout });
  }

  showError(message: string, timeout: number = 5000): void {
    this.show({ message, type: 'error', timeout });
  }

  showInfo(message: string, timeout: number = 5000): void {
    this.show({ message, type: 'info', timeout });
  }

  showWarning(message: string, timeout: number = 5000): void {
    this.show({ message, type: 'warning', timeout });
  }

  private show(notification: Notification): void {
    this.notificationSubject.next(notification);

    if (notification.timeout) {
      setTimeout(() => {
        // Effacer la notification seulement si c'est toujours la même
        if (this.notificationSubject.value === notification) {
          this.notificationSubject.next(null);
        }
      }, notification.timeout);
    }
  }

  clear(): void {
    this.notificationSubject.next(null);
  }
}
