import { Component, OnDestroy, OnInit } from '@angular/core';
import { map, Subscription, BehaviorSubject } from 'rxjs';
import { AuthuserService } from 'src/app/services/authuser.service';
import { Conversation, Message } from 'src/app/models/message.model';
import { User } from '@app/models/user.model';
import { Router, ActivatedRoute } from '@angular/router';
import { ToastService } from 'src/app/services/toast.service';
import { MessageService } from '@app/services/message.service';
import { LoggerService } from 'src/app/services/logger.service';
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
    private MessageService: MessageService,
    private authService: AuthuserService,
    private router: Router,
    private route: ActivatedRoute,
    private toastService: ToastService,
    private logger: LoggerService
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
    this.route.firstChild?.params.subscribe((params) => {
      this.selectedConversationId = params['conversationId'] || null;
    });
  }

  loadConversations(): void {
    this.logger.info('MessagesList', `Loading conversations`);
    this.loading = true;
    this.error = null;

    const sub = this.MessageService.getConversations().subscribe({
      next: (conversations) => {
        this.logger.info(
          'MessagesList',
          `Received ${conversations.length} conversations from service`
        );
        this.conversations = Array.isArray(conversations)
          ? [...conversations]
          : [];

        this.logger.debug('MessagesList', `Filtering conversations`);
        this.filterConversations();

        this.logger.debug('MessagesList', `Updating unread count`);
        this.updateUnreadCount();

        this.logger.debug('MessagesList', `Sorting conversations`);
        this.sortConversations();

        this.loading = false;
        this.logger.info('MessagesList', `Conversations loaded successfully`);
      },
      error: (error) => {
        this.logger.error(
          'MessagesList',
          `Error loading conversations:`,
          error
        );
        this.error = error;
        this.loading = false;
        this.toastService.showError('Failed to load conversations');
      },
    });
    this.subscriptions.push(sub);
    this.logger.debug('MessagesList', `Conversation subscription added`);
  }

  filterConversations(): void {
    if (!this.searchQuery) {
      this.filteredConversations = [...this.conversations];
      return;
    }

    const query = this.searchQuery.toLowerCase();
    this.filteredConversations = this.conversations.filter((conv) => {
      const otherParticipant = conv.participants
        ? this.getOtherParticipant(conv.participants)
        : undefined;
      return (
        otherParticipant?.username.toLowerCase().includes(query) ||
        conv.lastMessage?.content?.toLowerCase().includes(query) ||
        false
      );
    });
  }

  private updateUnreadCount(): void {
    const count = this.conversations.reduce(
      (sum, conv) => sum + (conv.unreadCount || 0),
      0
    );
    this.unreadCount.next(count);
  }

  sortConversations(): void {
    this.conversations.sort((a, b) => {
      const dateA = this.getConversationDate(a);
      const dateB = this.getConversationDate(b);
      return dateB.getTime() - dateA.getTime();
    });
    this.filterConversations();
  }

  private getConversationDate(conv: Conversation): Date {
    // Utiliser une date par défaut si aucune date n'est disponible
    const defaultDate = new Date(0); // 1970-01-01

    if (conv.lastMessage?.timestamp) {
      return typeof conv.lastMessage.timestamp === 'string'
        ? new Date(conv.lastMessage.timestamp)
        : conv.lastMessage.timestamp;
    }

    if (conv.updatedAt) {
      return typeof conv.updatedAt === 'string'
        ? new Date(conv.updatedAt)
        : conv.updatedAt;
    }

    if (conv.createdAt) {
      return typeof conv.createdAt === 'string'
        ? new Date(conv.createdAt)
        : conv.createdAt;
    }

    return defaultDate;
  }

  getOtherParticipant(participants: User[] | undefined): User | undefined {
    if (!participants || !Array.isArray(participants)) {
      return undefined;
    }
    return participants.find(
      (p) => p._id !== this.currentUserId && p.id !== this.currentUserId
    );
  }

  subscribeToUserStatus(): void {
    const sub = this.MessageService.subscribeToUserStatus()
      .pipe(map((user) => this.MessageService.normalizeUser(user)))
      .subscribe({
        next: (user: User) => {
          if (user) {
            this.updateUserStatus(user);
          }
        },
        error: (error) => {
          this.logger.error(
            'MessagesList',
            'Error in status subscription:',
            error
          );
          this.toastService.showError('Connection to status updates lost');
        },
      });
    this.subscriptions.push(sub);
  }

  subscribeToConversationUpdates(): void {
    const sub = this.MessageService.subscribeToConversationUpdates(
      'global'
    ).subscribe({
      next: (updatedConv) => {
        const index = this.conversations.findIndex(
          (c) => c.id === updatedConv.id
        );
        if (index >= 0) {
          this.conversations[index] = updatedConv;
        } else {
          this.conversations.unshift(updatedConv);
        }
        this.sortConversations();
      },
      error: (error) => {
        this.logger.error('MessagesList', 'Conversation update error:', error);
      },
    });
    this.subscriptions.push(sub);
  }

  updateUserStatus(updatedUser: User): void {
    this.conversations = this.conversations.map((conv) => {
      if (!conv.participants) {
        return conv;
      }
      const participants = conv.participants.map((p) => {
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
    this.filterConversations();
  }

  openConversation(conversationId: string | undefined): void {
    if (!conversationId) {
      this.logger.error(
        'MessagesList',
        'Cannot open conversation: conversationId is undefined'
      );
      return;
    }

    this.logger.info('MessagesList', `Opening conversation: ${conversationId}`);
    this.selectedConversationId = conversationId;

    // Trouver la conversation pour les logs
    const conversation = this.conversations.find(
      (c) => c.id === conversationId
    );
    if (conversation) {
      const otherParticipant = conversation.participants
        ? this.getOtherParticipant(conversation.participants)
        : undefined;
      this.logger.debug(
        'MessagesList',
        `Conversation with: ${otherParticipant?.username || 'Unknown'}`
      );
      this.logger.debug(
        'MessagesList',
        `Unread messages: ${conversation.unreadCount || 0}`
      );
    }

    this.logger.debug(
      'MessagesList',
      `Navigating to chat route with conversationId: ${conversationId}`
    );
    this.router.navigate(['chat', conversationId], { relativeTo: this.route });
  }

  startNewConversation(): void {
    this.logger.info(
      'MessagesList',
      'Starting new conversation, navigating to users list'
    );
    this.router.navigate(['/messages/users']);
  }

  formatLastActive(lastActive: string): string {
    if (!lastActive) return 'Offline';
    const lastActiveDate = new Date(lastActive);
    const now = new Date();
    const diffHours =
      Math.abs(now.getTime() - lastActiveDate.getTime()) / (1000 * 60 * 60);

    if (diffHours < 24) {
      return `Active ${lastActiveDate.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })}`;
    } else {
      return `Active ${lastActiveDate.toLocaleDateString()}`;
    }
  }

  private handleError(message: string, error?: any): void {
    this.error = message;
    this.loading = false;
    this.logger.error('MessagesList', message, error);
    this.toastService.showError(message);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }
}
