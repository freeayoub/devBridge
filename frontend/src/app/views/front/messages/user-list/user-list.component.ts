// user-list.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { User } from 'src/app/models/user.model';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthuserService } from 'src/app/services/authuser.service';
import { ToastService } from 'src/app/services/toast.service';
import { MessageService } from 'src/app/services/message.service';
import { CallService, CallType } from 'src/app/services/call.service';
import { LoggerService } from 'src/app/services/logger.service';

@Component({
  selector: 'app-user-list',
  templateUrl: './user-list.component.html',
  styleUrls: ['./user-list.component.css'],
})
export class UserListComponent implements OnInit, OnDestroy {
  users: User[] = [];
  loading = true;
  searchQuery = '';
  currentUserId: string | null = null;
  private subscriptions: Subscription = new Subscription();

  constructor(
    private MessageService: MessageService,
    public router: Router,
    public route: ActivatedRoute,
    private authService: AuthuserService,
    private toastService: ToastService,
    private callService: CallService,
    private logger: LoggerService
  ) {}

  ngOnInit(): void {
    this.currentUserId = this.authService.getCurrentUserId();
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading = true;
    this.logger.info('Loading users', {
      searchQuery: this.searchQuery || '(empty)',
      currentUserId: this.currentUserId || '(not logged in)',
    });

    if (!this.currentUserId) {
      this.logger.warn('Loading users without being logged in');
    }

    const sub = this.MessageService.getAllUsers(
      false,
      this.searchQuery
    ).subscribe({
      next: (users) => {
        this.logger.debug(`Received ${users.length} users from service`);

        if (!Array.isArray(users)) {
          this.logger.error('Received invalid users data (not an array)');
          this.users = [];
          this.loading = false;
          this.toastService.showError('Failed to load users: Invalid data');
          return;
        }

        // Filter out current user using either id or _id
        this.users = users.filter((user) => {
          if (!user) return false;
          const userId = user.id || user._id;
          return userId !== this.currentUserId;
        });

        this.loading = false;
        this.logger.info('Users loaded successfully', {
          totalUsers: users.length,
          filteredUsers: this.users.length,
        });
      },
      error: (error) => {
        this.loading = false;
        this.logger.error('Failed to load users', error);
        this.toastService.showError(
          `Failed to load users: ${error.message || 'Unknown error'}`
        );

        // Réinitialiser la liste des utilisateurs en cas d'erreur
        this.users = [];
      },
      complete: () => {
        // S'assurer que l'indicateur de chargement est désactivé même en cas de complétion sans données
        this.loading = false;
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

        // Naviguer vers la conversation
        this.router
          .navigate(['../chat', conversation.id], {
            relativeTo: this.route,
          })
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

    this.callService.initiateCall(userId, CallType.AUDIO).subscribe({
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

    this.callService.initiateCall(userId, CallType.VIDEO).subscribe({
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

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
}
