import { Component, OnDestroy, OnInit } from '@angular/core';
import { GraphqlDataService } from 'src/app/services/graphql-data.service';
import { map, Subscription, BehaviorSubject } from 'rxjs';
import { AuthuserService } from 'src/app/services/authuser.service';
import { Conversation } from '@app/models/message.model';
import { User } from '@app/models/user.model';
import { Router } from '@angular/router';
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
  private unreadCount = new BehaviorSubject<number>(0);
  public unreadCount$ = this.unreadCount.asObservable();
  private subscriptions = new Subscription();
  constructor(
    private graphqlService: GraphqlDataService,
    private authService: AuthuserService,
    public router: Router
  ) {}

  ngOnInit(): void {
    this.currentUserId = this.authService.getCurrentUserId();
    if (!this.currentUserId) {
      this.handleError('User not authenticated');
      return;
    }

    this.loadConversations();
    this.subscribeToUserStatus();
  }
  // In messages-list.component.ts
  loadConversations() {
    const sub = this.graphqlService.getConversations().subscribe({
      next: (conversations) => {
        this.conversations = Array.isArray(conversations)
          ? [...conversations]
          : [];
        this.updateUnreadCount();
        this.sortConversations();
        this.loading = false;
      },
      error: (error) => {
        console.error('Network error:', error);
        this.error = error;
        this.loading = false;
      },
    });
    this.subscriptions.add(sub);
  }
  private updateUnreadCount(): void {
    const count = this.conversations.reduce((sum, conv) => sum + (conv.unreadCount || 0), 0);
    this.unreadCount.next(count);
  }
  sortConversations() {
    this.conversations = [...this.conversations].sort((a, b) => {
      const dateA = new Date(a.lastMessage?.timestamp || a.updatedAt);
      const dateB = new Date(b.lastMessage?.timestamp || b.updatedAt);
      return dateB.getTime() - dateA.getTime();
    });
  }
  getOtherParticipant(participants: User[]): User | undefined {
    return participants.find(
      (p) => p._id !== this.currentUserId && p.id !== this.currentUserId
    );
  }
  subscribeToUserStatus() {
    const sub = this.graphqlService
      .subscribeToUserStatus()
      .pipe(map((user) => this.graphqlService.normalizeUser(user)))
      .subscribe({
        next: (user: User) => {
          if (user) {
            this.updateUserStatus(user);
          }
        },
        error: (error) => console.error('Error in status subscription:', error),
      });
      this.subscriptions.add(sub);
  }
  updateUserStatus(updatedUser: User) {
    this.conversations = this.conversations.map((conv) => {
      const participants = conv.participants.map((p) => {
        // Check both _id and id to handle different data sources
        const userIdMatches =
          p._id === updatedUser._id || p.id === updatedUser._id;

        return userIdMatches
          ? {
              ...p,
              isOnline: updatedUser.isOnline,
              lastActive: updatedUser.lastActive,
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
    this.subscriptions.unsubscribe();
  }
  openConversation(conversationId: string): void {
    this.router.navigate(['/messages/chat', conversationId], { 
      state: { hideList: true } 
    });
  }
  private handleError(message: string, error?: any): void {
    this.error = message;
    this.loading = false;
    console.error(message, error);
  }
     // Exemple 
    //  this.GraphqlDataService.searchMessages('important').subscribe(messages => {
    //   console.log('Messages trouvés:', messages);
    // });
    // this.GraphqlDataService.getUnreadMessages().subscribe(messages => {
    //   console.log('Messages non lus:', messages);
    // });
    // this.GraphqlDataService.setUserOnline('user123').subscribe(user => {
    //   console.log('Utilisateur en ligne:', user);
    // });
  
}
