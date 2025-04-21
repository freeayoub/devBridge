import { Component, OnDestroy, OnInit } from '@angular/core';
import { GraphqlDataService } from 'src/app/services/graphql-data.service';
import { Subscription } from 'rxjs';
import { AuthuserService } from 'src/app/services/authuser.service';

@Component({
  selector: 'app-messages-list',
  templateUrl: './messages-list.component.html',
  styleUrls: ['./messages-list.component.css'],
})
export class MessagesListComponent implements OnInit, OnDestroy {
  conversations: any[] = [];
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
    // this.subscribeToUserStatus();
  }
// In messages-list.component.ts
loadConversations() {
  this.querySubscription = this.graphqlService.getConversations().subscribe({
    next: ({ data, loading, errors }) => {
      if (errors) {
        console.error('GraphQL errors:', errors);
        this.error = errors[0];
        return;
      }
      this.conversations = data?.getConversations || [];
      this.sortConversations();
      this.loading = loading;
    },
    error: (error) => {
      console.error('Network error:', error);
      this.error = error;
      this.loading = false;
    }
  });
}
  sortConversations() {
    this.conversations.sort((a, b) => {
      const dateA = new Date(a.lastMessage?.timestamp || a.updatedAt);
      const dateB = new Date(b.lastMessage?.timestamp || b.updatedAt);
      return dateB.getTime() - dateA.getTime();
    });
  }
    getOtherParticipant(participants: any[]) {
    return participants.find((p) => p.id !== this.currentUserId);
  }
  
  subscribeToUserStatus() {
    this.statusSubscription = this.graphqlService.subscribeToUserStatus().subscribe({
      next: (user) => {
        if (user) {
          this.updateUserStatus(user);
        }
      },
      error: (error) => console.error('Error in status subscription:', error)
    });
  }

  updateUserStatus(updatedUser: any) {
    this.conversations = this.conversations.map(conv => {
      const participants = conv.participants.map((p: any) => 
        p.id === updatedUser.id ? { ...p, isOnline: updatedUser.isOnline, lastActive: updatedUser.lastActive } : p
      );
      return { ...conv, participants };
    });
  }


  formatLastActive(lastActive: string): string {
    if (!lastActive) return 'Offline';
    
    const lastActiveDate = new Date(lastActive);
    const now = new Date();
    const diffHours = Math.abs(now.getTime() - lastActiveDate.getTime()) / (1000 * 60 * 60);
    
    if (diffHours < 24) {
      return `Last seen ${lastActiveDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
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