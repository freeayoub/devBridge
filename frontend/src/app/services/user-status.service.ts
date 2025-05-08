import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { filter } from 'rxjs/operators';
import { User } from '@app/models/user.model';
import { LoggerService } from './logger.service';
import { MessageService } from './message.service';
import {
  Observable,
  Subscription,
} from 'rxjs';
@Injectable({
  providedIn: 'root'
})
export class UserStatusService implements OnDestroy {
  private statusSub?: Subscription;
  private onlineUsers = new Map<string, User>();
  private reconnectionAttempts = 0;
  private maxReconnectionAttempts = 5;
  private reconnectionDelay = 1000;

  constructor(
    private MessageService:MessageService,
    private logger: LoggerService,
    private ngZone: NgZone
  ) {
    this.initStatusSubscription();
  }
  //helper methode
  private initStatusSubscription(): void {
    this.ngZone.runOutsideAngular(() => {
      this.statusSub = this.MessageService.subscribeToUserStatus().subscribe({
        next: (user: User) => this.handleUserStatusUpdate(user),
        error: (error: Error) => this.handleSubscriptionError(error),
      });
    });
  }
  private handleUserStatusUpdate(user: User): void {
    this.ngZone.run(() => {
      const isOnline = user.isOnline ?? false;
      
      if (isOnline) {
        this.onlineUsers.set(user._id, user);
        this.logger.debug(`User ${user.username} is now online`, { userId: user._id });
      } else {
        this.onlineUsers.delete(user._id);
        this.logger.debug(`User ${user.username} is now offline`, { userId: user._id });
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
      const sub = this.MessageService
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
      lastSeen: user?.lastActive ? new Date(user.lastActive) : undefined
    };
  }
  ngOnDestroy(): void {
    this.statusSub?.unsubscribe();
    this.onlineUsers.clear();
    this.logger.debug('UserStatusService destroyed');
  }
}
