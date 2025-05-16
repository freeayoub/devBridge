// user-list.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription, interval } from 'rxjs';
import { User } from 'src/app/models/user.model';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthuserService } from 'src/app/services/authuser.service';
import { ToastService } from 'src/app/services/toast.service';
import { MessageService } from 'src/app/services/message.service';
import { CallType } from 'src/app/models/message.model';
import { LoggerService } from 'src/app/services/logger.service';
import { FormControl, FormGroup } from '@angular/forms';

@Component({
  selector: 'app-user-list',
  templateUrl: './user-list.component.html',
  styleUrls: ['./user-list.component.css'],
})
export class UserListComponent implements OnInit, OnDestroy {
  users: User[] = [];
  loading = true;
  currentUserId: string | null = null;

  // Pagination
  currentPage = 1;
  pageSize = 10;
  totalUsers = 0;
  totalPages = 0;
  hasNextPage = false;
  hasPreviousPage = false;

  // Sorting and filtering
  sortBy = 'username';
  sortOrder = 'asc';
  filterForm = new FormGroup({
    searchQuery: new FormControl(''),
    isOnline: new FormControl<boolean | null>(null),
  });

  // Auto-refresh
  autoRefreshEnabled = true;
  autoRefreshInterval = 30000; // 30 seconds
  private autoRefreshSubscription?: Subscription;

  private loadingMore = false;
  private subscriptions: Subscription = new Subscription();

  constructor(
    private MessageService: MessageService,
    public router: Router,
    public route: ActivatedRoute,
    private authService: AuthuserService,
    private toastService: ToastService,
    private logger: LoggerService
  ) {}

  ngOnInit(): void {
    this.currentUserId = this.authService.getCurrentUserId();
    this.setupFilterListeners();
    this.setupAutoRefresh();
    this.loadUsers();
  }

  private setupFilterListeners(): void {
    // Subscribe to search query changes
    const searchSub = this.filterForm
      .get('searchQuery')!
      .valueChanges.subscribe(() => {
        this.resetPagination();
        this.loadUsers();
      });

    this.subscriptions.add(searchSub);

    // Subscribe to online status filter changes
    const onlineSub = this.filterForm
      .get('isOnline')!
      .valueChanges.subscribe(() => {
        this.resetPagination();
        this.loadUsers();
      });

    this.subscriptions.add(onlineSub);
  }

  private setupAutoRefresh(): void {
    if (this.autoRefreshEnabled) {
      this.autoRefreshSubscription = interval(
        this.autoRefreshInterval
      ).subscribe(() => {
        // Only refresh if not currently loading and no active search
        if (!this.loading && !this.filterForm.get('searchQuery')?.value) {
          this.logger.debug('Auto-refreshing user list');
          this.loadUsers(true);
        }
      });
    }
  }

  toggleAutoRefresh(): void {
    this.autoRefreshEnabled = !this.autoRefreshEnabled;

    if (this.autoRefreshEnabled) {
      this.setupAutoRefresh();
      this.logger.info('Auto-refresh enabled');
    } else if (this.autoRefreshSubscription) {
      this.autoRefreshSubscription.unsubscribe();
      this.autoRefreshSubscription = undefined;
      this.logger.info('Auto-refresh disabled');
    }
  }

  resetPagination(): void {
    this.currentPage = 1;
  }

  // Get searchQuery from the form
  get searchQuery(): string {
    return this.filterForm.get('searchQuery')?.value || '';
  }

  // Set searchQuery in the form
  set searchQuery(value: string) {
    this.filterForm.get('searchQuery')?.setValue(value);
  }

  // Helper function for template type casting
  $any(item: any): any {
    return item;
  }

  loadUsers(forceRefresh = false): void {
    if (this.loadingMore) return;

    this.loading = true;

    const searchQuery = this.filterForm.get('searchQuery')?.value || '';
    const isOnline = this.filterForm.get('isOnline')?.value;

    this.logger.info('Loading users', {
      searchQuery: searchQuery || '(empty)',
      currentUserId: this.currentUserId || '(not logged in)',
      page: this.currentPage,
      limit: this.pageSize,
      sortBy: this.sortBy,
      sortOrder: this.sortOrder,
      isOnline: isOnline,
    });

    if (!this.currentUserId) {
      this.logger.warn('Loading users without being logged in');
    }

    const sub = this.MessageService.getAllUsers(
      forceRefresh,
      searchQuery,
      this.currentPage,
      this.pageSize,
      this.sortBy,
      this.sortOrder,
      isOnline === true
    ).subscribe({
      next: (users) => {
        this.logger.debug(`Received ${users.length} users from service`);

        if (!Array.isArray(users)) {
          this.logger.error('Received invalid users data (not an array)');
          this.users = [];
          this.loading = false;
          this.loadingMore = false;
          this.toastService.showError('Failed to load users: Invalid data');
          return;
        }

        // If first page, replace users array; otherwise append
        if (this.currentPage === 1) {
          // Filter out current user
          this.users = users.filter((user) => {
            if (!user) return false;
            const userId = user.id || user._id;
            return userId !== this.currentUserId;
          });
        } else {
          // Append new users to existing array, avoiding duplicates and filtering out current user
          const newUsers = users.filter((newUser) => {
            if (!newUser) return false;
            const userId = newUser.id || newUser._id;
            return (
              userId !== this.currentUserId &&
              !this.users.some(
                (existingUser) =>
                  (existingUser.id || existingUser._id) === userId
              )
            );
          });

          this.users = [...this.users, ...newUsers];
        }

        // Update pagination metadata from service
        const pagination = this.MessageService.currentUserPagination;
        this.totalUsers = pagination.totalCount;
        this.totalPages = pagination.totalPages;
        this.hasNextPage = pagination.hasNextPage;
        this.hasPreviousPage = pagination.hasPreviousPage;

        this.loading = false;
        this.loadingMore = false;

        this.logger.info('Users loaded successfully', {
          totalUsers: this.totalUsers,
          filteredUsers: this.users.length,
          currentPage: this.currentPage,
          totalPages: this.totalPages,
        });
      },
      error: (error) => {
        this.loading = false;
        this.loadingMore = false;
        this.logger.error('Failed to load users', error);
        this.toastService.showError(
          `Failed to load users: ${error.message || 'Unknown error'}`
        );

        // Reset the users list in case of error
        if (this.currentPage === 1) {
          this.users = [];
        }
      },
      complete: () => {
        // Ensure loading indicator is disabled even in case of completion without data
        this.loading = false;
        this.loadingMore = false;
      },
    });

    this.subscriptions.add(sub);
  }

  startConversation(userId: string | undefined) {
    if (!userId) {
      this.logger.error('Cannot start conversation: userId is undefined');
      this.toastService.showError(
        'Cannot start conversation with undefined user'
      );
      return;
    }

    this.logger.info('Creating conversation with user', { userId });

    // Afficher un indicateur de chargement
    this.toastService.showInfo('Creating conversation...');

    this.MessageService.createConversation(userId).subscribe({
      next: (conversation) => {
        if (!conversation || !conversation.id) {
          this.logger.error('Received invalid conversation object');
          this.toastService.showError(
            'Failed to create conversation: Invalid response'
          );
          return;
        }

        this.logger.info('Conversation created successfully', {
          conversationId: conversation.id,
          participantCount: conversation.participants?.length || 0,
        });

        // Naviguer vers la conversation avec un chemin absolu
        this.router
          .navigate(['/messages/conversations/chat', conversation.id])
          .then((success) => {
            if (!success) {
              this.logger.error(
                `Failed to navigate to conversation ${conversation.id}`
              );
              this.toastService.showError('Failed to open conversation');
            }
          });
      },
      error: (error) => {
        this.logger.error('Error creating conversation', error);
        this.toastService.showError(
          `Failed to create conversation: ${error.message || 'Unknown error'}`
        );
      },
    });
  }

  // Initier un appel audio
  startAudioCall(userId: string): void {
    if (!userId) return;

    this.logger.debug('Starting audio call with user', { userId });

    this.MessageService.initiateCall(userId, CallType.AUDIO).subscribe({
      next: (call) => {
        this.logger.debug('Audio call initiated successfully', {
          callId: call.id,
        });
        this.toastService.showSuccess('Audio call initiated');
      },
      error: (error) => {
        this.logger.error('Error initiating audio call', error);
        this.toastService.showError('Failed to initiate audio call');
      },
    });
  }

  // Initier un appel vidéo
  startVideoCall(userId: string): void {
    if (!userId) return;

    this.logger.debug('Starting video call with user', { userId });

    this.MessageService.initiateCall(userId, CallType.VIDEO).subscribe({
      next: (call) => {
        this.logger.debug('Video call initiated successfully', {
          callId: call.id,
        });
        this.toastService.showSuccess('Video call initiated');
      },
      error: (error) => {
        this.logger.error('Error initiating video call', error);
        this.toastService.showError('Failed to initiate video call');
      },
    });
  }

  loadNextPage(): void {
    if (this.hasNextPage && !this.loading) {
      this.loadingMore = true;
      this.currentPage++;
      this.loadUsers();
    }
  }

  loadPreviousPage(): void {
    if (this.hasPreviousPage && !this.loading) {
      this.loadingMore = true;
      this.currentPage--;
      this.loadUsers();
    }
  }

  refreshUsers(): void {
    this.logger.info('Manually refreshing user list');
    this.resetPagination();
    this.loadUsers(true);
  }

  clearFilters(): void {
    this.filterForm.reset({
      searchQuery: '',
      isOnline: null,
    });
    this.resetPagination();
    this.loadUsers(true);
  }

  changeSortOrder(field: string): void {
    if (this.sortBy === field) {
      // Toggle sort order if clicking the same field
      this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      // Set new sort field with default ascending order
      this.sortBy = field;
      this.sortOrder = 'asc';
    }

    this.resetPagination();
    this.loadUsers(true);
  }

  /**
   * Navigue vers la liste des conversations
   */
  goBackToConversations(): void {
    this.logger.info('UserList', 'Navigating back to conversations list');
    this.router.navigate(['/messages/conversations']);
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    if (this.autoRefreshSubscription) {
      this.autoRefreshSubscription.unsubscribe();
    }
  }
}
