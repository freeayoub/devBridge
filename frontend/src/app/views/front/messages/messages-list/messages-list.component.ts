import { Component, OnDestroy, OnInit } from '@angular/core';
import { GraphqlDataService } from 'src/app/services/graphql-data.service';
import { map, Subscription } from 'rxjs';
import { AuthuserService } from 'src/app/services/authuser.service';
import { Conversation } from '@app/models/message.model';
import { User } from '@app/models/user.model';


@Component({
  selector: 'app-messages-list',
  templateUrl: './messages-list.component.html',
  styleUrls: ['./messages-list.component.css'],
})
export class MessagesListComponent implements OnInit, OnDestroy {
  conversations: Conversation[] = [];
  loading = true;
  error: any;
  currentUserId: string | null = null;
  private querySubscription: Subscription | null = null;
  private statusSubscription: Subscription | null = null;
  private messageSubscription: Subscription | null = null;
  constructor(
    private graphqlService: GraphqlDataService,
    private authService: AuthuserService
  ) {}

  ngOnInit(): void {
    this.currentUserId = this.authService.getCurrentUserId();
    this.loadConversations();
    this.subscribeToUserStatus();
  }
  // In messages-list.component.ts
  loadConversations() {
    this.querySubscription = this.graphqlService.getConversations().subscribe({
      next: (conversations) => {
        this.conversations = Array.isArray(conversations) 
          ? [...conversations] 
          : [];
        this.sortConversations();
        this.loading = false;
      },
      error: (error) => {
        console.error('Network error:', error);
        this.error = error;
        this.loading = false;
      }
    });
  }
  sortConversations() {
    this.conversations = [...this.conversations].sort((a, b) => {
      const dateA = new Date(a.lastMessage?.timestamp || a.updatedAt);
      const dateB = new Date(b.lastMessage?.timestamp || b.updatedAt);
      return dateB.getTime() - dateA.getTime();
    });
  }
  getOtherParticipant(participants: User[]): User | undefined {
    return participants.find((p) => 
      p._id !== this.currentUserId && 
      p.id !== this.currentUserId
    );
  }
  subscribeToUserStatus() {
    this.statusSubscription = this.graphqlService
      .subscribeToUserStatus()
      .pipe(
        map(user => this.graphqlService.normalizeUser(user))
      )
      .subscribe({
        next: (user: User) => {
          if (user) {
            this.updateUserStatus(user);
          }
        },
        error: (error) => console.error('Error in status subscription:', error),
      });
  }
  updateUserStatus(updatedUser: User) {
    this.conversations = this.conversations.map((conv) => {
      const participants = conv.participants.map((p) => {
        // Check both _id and id to handle different data sources
        const userIdMatches = p._id === updatedUser._id || p.id === updatedUser._id;
        
        return userIdMatches
          ? {
              ...p,
              isOnline: updatedUser.isOnline,
              lastActive: updatedUser.lastActive
            }
          : p;
      });
      return { ...conv, participants };
    });
  }

  formatLastActive(lastActive: string): string {
    if (!lastActive) return 'Offline';

    const lastActiveDate = new Date(lastActive);
    const now = new Date();
    const diffHours =
      Math.abs(now.getTime() - lastActiveDate.getTime()) / (1000 * 60 * 60);

    if (diffHours < 24) {
      return `Last seen ${lastActiveDate.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })}`;
    } else {
      return `Last seen ${lastActiveDate.toLocaleDateString()}`;
    }
  }

  ngOnDestroy(): void {
    this.querySubscription?.unsubscribe();
    this.statusSubscription?.unsubscribe();
    this.messageSubscription?.unsubscribe();
  }
}
