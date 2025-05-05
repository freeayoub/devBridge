import { Component, OnDestroy, OnInit } from '@angular/core';
import { GraphqlDataService } from 'src/app/services/graphql-data.service';
import { map, Subscription, BehaviorSubject } from 'rxjs';
import { AuthuserService } from 'src/app/services/authuser.service';
import { Conversation, Message } from 'src/app/models/message.model';
import { User } from '@app/models/user.model';
import { Router, ActivatedRoute  } from '@angular/router';
import { ToastService } from 'src/app/services/toast.service';
@Component({
  selector: 'app-messages-list',
  templateUrl: './messages-list.component.html',
  styleUrls: ['./messages-list.component.css'],
})
export class MessagesListComponent implements OnInit, OnDestroy {
  conversations: Conversation[] = [];
  filteredConversations: Conversation[] = [];
  loading = true;
  error: any;
  currentUserId: string | null = null;
  searchQuery = '';
  selectedConversationId: string | null = null;
  
  private unreadCount = new BehaviorSubject<number>(0);
  public unreadCount$ = this.unreadCount.asObservable();
  private subscriptions: Subscription[] = [];

  constructor(
    private graphqlService: GraphqlDataService,
    private authService: AuthuserService,
    private router: Router,
    private route: ActivatedRoute,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.currentUserId = this.authService.getCurrentUserId();
    if (!this.currentUserId) {
      this.handleError('User not authenticated');
      return;
    }

    this.loadConversations();
    this.subscribeToUserStatus();
    this.subscribeToConversationUpdates();
    
    // Check for active conversation from route
    this.route.firstChild?.params.subscribe(params => {
      this.selectedConversationId = params['conversationId'] || null;
    });
  }

  loadConversations(): void {
    this.loading = true;
    this.error = null;
    
    const sub = this.graphqlService.getConversations().subscribe({
      next: (conversations) => {
        this.conversations = Array.isArray(conversations) ? [...conversations] : [];
        this.filterConversations();
        this.updateUnreadCount();
        this.sortConversations();
        this.loading = false;
      },
      error: (error) => {
        this.error = error;
        this.loading = false;
        this.toastService.showError('Failed to load conversations');
      },
    });
    this.subscriptions.push(sub);
  }

  filterConversations(): void {
    if (!this.searchQuery) {
      this.filteredConversations = [...this.conversations];
      return;
    }
    
    const query = this.searchQuery.toLowerCase();
    this.filteredConversations = this.conversations.filter(conv => {
      const otherParticipant = this.getOtherParticipant(conv.participants);
      return otherParticipant?.username.toLowerCase().includes(query) || 
      conv.lastMessage?.content?.toLowerCase().includes(query) || false
    });
  }

  private updateUnreadCount(): void {
    const count = this.conversations.reduce((sum, conv) => sum + (conv.unreadCount || 0), 0);
    this.unreadCount.next(count);
  }

  sortConversations(): void {
    this.conversations.sort((a, b) => {
      const dateA = new Date(a.lastMessage?.timestamp || a.updatedAt);
      const dateB = new Date(b.lastMessage?.timestamp || b.updatedAt);
      return dateB.getTime() - dateA.getTime();
    });
    this.filterConversations();
  }

  getOtherParticipant(participants: User[]): User | undefined {
    return participants.find(p => p._id !== this.currentUserId && p.id !== this.currentUserId);
  }

  subscribeToUserStatus(): void {
    const sub = this.graphqlService.subscribeToUserStatus()
      .pipe(map(user => this.graphqlService.normalizeUser(user)))
      .subscribe({
        next: (user: User) => {
          if (user) {
            this.updateUserStatus(user);
          }
        },
        error: (error) => {
          console.error('Error in status subscription:', error);
          this.toastService.showError('Connection to status updates lost');
        }
      });
    this.subscriptions.push(sub);
  }

  subscribeToConversationUpdates(): void {
    const sub = this.graphqlService.subscribeToConversationUpdates('global')
      .subscribe({
        next: (updatedConv) => {
          const index = this.conversations.findIndex(c => c.id === updatedConv.id);
          if (index >= 0) {
            this.conversations[index] = updatedConv;
          } else {
            this.conversations.unshift(updatedConv);
          }
          this.sortConversations();
        },
        error: (error) => {
          console.error('Conversation update error:', error);
        }
      });
    this.subscriptions.push(sub);
  }

  updateUserStatus(updatedUser: User): void {
    this.conversations = this.conversations.map(conv => {
      const participants = conv.participants.map(p => {
        const userIdMatches = p._id === updatedUser._id || p.id === updatedUser._id;
        return userIdMatches ? { ...p, isOnline: updatedUser.isOnline, lastActive: updatedUser.lastActive } : p;
      });
      return { ...conv, participants };
    });
    this.filterConversations();
  }

  openConversation(conversationId: string): void {
    this.selectedConversationId = conversationId;
    this.router.navigate(['chat', conversationId], { relativeTo: this.route });
  }

  startNewConversation(): void {
    this.router.navigate(['new'], { relativeTo: this.route });
  }

  formatLastActive(lastActive: string): string {
    if (!lastActive) return 'Offline';
    const lastActiveDate = new Date(lastActive);
    const now = new Date();
    const diffHours = Math.abs(now.getTime() - lastActiveDate.getTime()) / (1000 * 60 * 60);

    if (diffHours < 24) {
      return `Active ${lastActiveDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      return `Active ${lastActiveDate.toLocaleDateString()}`;
    }
  }

  private handleError(message: string, error?: any): void {
    this.error = message;
    this.loading = false;
    console.error(message, error);
    this.toastService.showError(message);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
}