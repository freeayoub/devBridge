import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { filter } from 'rxjs/operators';
import { User } from '@app/models/user.model';
import { LoggerService } from './logger.service';
import { MessageService } from './message.service';
import { Observable, Subscription } from 'rxjs';
@Injectable({
  providedIn: 'root',
})
export class UserStatusService implements OnDestroy {
  private statusSub?: Subscription;
  private onlineUsers = new Map<string, User>();
  private reconnectionAttempts = 0;
  private maxReconnectionAttempts = 5;
  private reconnectionDelay = 1000;

  constructor(
    private messageService: MessageService,
    private logger: LoggerService,
    private ngZone: NgZone
  ) {
    this.initStatusSubscription();
  }
  //helper methode
  private initStatusSubscription(): void {
    this.logger.debug('Initializing user status subscription');

    this.ngZone.runOutsideAngular(() => {
      try {
        this.statusSub?.unsubscribe(); // Unsubscribe from any existing subscription

        this.statusSub = this.messageService.subscribeToUserStatus().subscribe({
          next: (user: User) => this.handleUserStatusUpdate(user),
          error: (error: Error) => this.handleSubscriptionError(error),
          complete: () =>
            this.logger.debug('User status subscription completed'),
        });

        this.logger.debug('User status subscription initialized successfully');
      } catch (error) {
        this.logger.error(
          'Error initializing user status subscription:',
          error as Error
        );
        // Schedule a retry after a delay
        setTimeout(() => this.initStatusSubscription(), 5000);
      }
    });
  }
  private handleUserStatusUpdate(user: User): void {
    this.ngZone.run(() => {
      const isOnline = user.isOnline ?? false;

      if (isOnline) {
        this.onlineUsers.set(user._id, user);
        this.logger.debug(`User ${user.username} is now online`, {
          userId: user._id,
        });
      } else {
        this.onlineUsers.delete(user._id);
        this.logger.debug(`User ${user.username} is now offline`, {
          userId: user._id,
        });
      }
      this.reconnectionAttempts = 0;
    });
  }
  private handleSubscriptionError(error: Error): void {
    this.logger.error('Status subscription error', error, {
      attempt: this.reconnectionAttempts,
      maxAttempts: this.maxReconnectionAttempts,
    });

    if (this.reconnectionAttempts < this.maxReconnectionAttempts) {
      this.reconnectionAttempts++;
      const delay =
        this.reconnectionDelay * Math.pow(2, this.reconnectionAttempts - 1);

      this.logger.debug(`Attempting reconnection in ${delay}ms`, {
        attempt: this.reconnectionAttempts,
        maxAttempts: this.maxReconnectionAttempts,
      });

      setTimeout(() => {
        this.initStatusSubscription();
      }, delay);
    } else {
      this.logger.error('Max reconnection attempts reached', undefined, {
        maxAttempts: this.maxReconnectionAttempts,
      });
    }
  }
  //  méthodes
  trackUserPresence(userId: string): Observable<boolean> {
    return new Observable<boolean>((observer) => {
      // État initial - avec vérification que isOnline est défini
      const user = this.onlineUsers.get(userId);
      observer.next(user?.isOnline ?? false);
      // Abonnement aux changements
      const sub = this.messageService
        .subscribeToUserStatus()
        .pipe(filter((user) => user._id === userId))
        .subscribe({
          next: (user) => observer.next(user.isOnline ?? false),
          error: (err) => observer.error(err),
        });

      return () => sub.unsubscribe();
    });
  }
  isUserOnline(userId: string): boolean {
    const user = this.onlineUsers.get(userId);
    return user?.isOnline ?? false;
  }

  getOnlineUsers(): User[] {
    return Array.from(this.onlineUsers.values());
  }
  getUserStatus(userId: string): { isOnline: boolean; lastSeen?: Date } {
    const user = this.onlineUsers.get(userId);
    return {
      isOnline: user?.isOnline ?? false,
      lastSeen: user?.lastActive ? new Date(user.lastActive) : undefined,
    };
  }
  ngOnDestroy(): void {
    this.statusSub?.unsubscribe();
    this.onlineUsers.clear();
    this.logger.debug('UserStatusService destroyed');
  }
}
