// user-status.service.ts
import { Injectable, OnDestroy } from '@angular/core';
import { DataService } from './data.service';
import { GraphqlDataService } from './graphql-data.service';
import { Subscription } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class UserStatusService implements OnDestroy {
  private statusSub!: Subscription;
  private onlineUsers: Set<string> = new Set();

  constructor(
    private dataService: DataService,
    private graphqlService: GraphqlDataService
  ) {
    this.subscribeToUserStatus();
  }

  private subscribeToUserStatus(): void {
    this.statusSub = this.graphqlService.subscribeToUserStatus().subscribe({
      next: (user) => {
        if (user.isOnline) {
          this.onlineUsers.add(user.id);
        } else {
          this.onlineUsers.delete(user.id);
        }
      },
      error: (error) => console.error('Status subscription error:', error)
    });
  }

  isUserOnline(userId: string): boolean {
    return this.onlineUsers.has(userId);
  }

  ngOnDestroy(): void {
    this.statusSub?.unsubscribe();
  }
}