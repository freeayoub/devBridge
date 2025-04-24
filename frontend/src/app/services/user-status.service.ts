// user-status.service.ts
import { Injectable, OnDestroy } from '@angular/core';
import { GraphqlDataService } from './graphql-data.service';
import { Subscription } from 'rxjs';
import { User } from '@app/models/user.model';
@Injectable({
  providedIn: 'root'
})
export class UserStatusService implements OnDestroy {
  private statusSub?: Subscription;
  private onlineUsers = new Set<string>();

  constructor(
    private graphqlService: GraphqlDataService
  ) {
    this.subscribeToUserStatus();
  }

  private subscribeToUserStatus(): void {
    this.statusSub = this.graphqlService.subscribeToUserStatus().subscribe({
      next: (user:User) => {
        if (user.isOnline) {
          this.onlineUsers.add(user._id);
        } else {
          this.onlineUsers.delete(user._id);
        }
      },
      error: (error: Error) => {
        console.error('Status subscription error:', error.message);
   
      }
    });
  }
  isUserOnline(userId: string): boolean {
    return this.onlineUsers.has(userId);
  }

  ngOnDestroy(): void {
    this.statusSub?.unsubscribe();
  }
}