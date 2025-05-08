// user-list.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { User } from '@app/models/user.model';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthuserService } from 'src/app/services/authuser.service';
import { ToastService } from '@app/services/toast.service';
import { MessageService } from '@app/services/message.service';

@Component({
  selector: 'app-user-list',
  templateUrl: './user-list.component.html',
  styleUrls: ['./user-list.component.css']
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
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.currentUserId = this.authService.getCurrentUserId();
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading = true;
    const sub = this.MessageService.getAllUsers(false, this.searchQuery).subscribe({
      next: (users) => {
        this.users = users.filter(user => user.id !== this.currentUserId);
        this.loading = false;
      },
      error: (error) => {
        this.loading = false;
        this.toastService.showError('Failed to load users');
      }
    });
    this.subscriptions.add(sub);
  }

  startConversation(userId: string | undefined) {
    if (!userId) return;
    this.router.navigate(['../chat', userId], { relativeTo: this.route });
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
}