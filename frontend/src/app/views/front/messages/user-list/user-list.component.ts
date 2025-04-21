// user-list.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { DataService } from 'src/app/services/data.service';
import { GraphqlDataService } from 'src/app/services/graphql-data.service';
import { Subscription } from 'rxjs';
import { Router } from '@angular/router';

@Component({
  selector: 'app-user-list',
  templateUrl: './user-list.component.html',
  styleUrls: ['./user-list.component.css']
})
export class UserListComponent implements OnInit, OnDestroy {
  users: any[] = [];
  loading = true;
  error: any;
  currentUserId: any;
  private userSub!: Subscription;
  private statusSub!: Subscription;

  constructor(
    private dataService: DataService,
    private graphqlService: GraphqlDataService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.currentUserId = this.dataService.currentUserValue?._id;
    this.loadUsers();
    this.subscribeToUserStatus();
  }

  loadUsers(): void {
    this.loading = true;
    this.dataService.getAllUsers().subscribe({
      next: (users) => {
        this.users = users.filter(user => user._id !== this.currentUserId);
        this.loading = false;
      },
      error: (error) => {
        this.error = error;
        this.loading = false;
      }
    });
  }

  subscribeToUserStatus(): void {
    this.statusSub = this.graphqlService.subscribeToUserStatus().subscribe({
      next: (user) => {
        const index = this.users.findIndex(u => u.id === user.id);
        if (index !== -1) {
          this.users[index] = { ...this.users[index], ...user };
        }
      },
      error: (error) => console.error('Status subscription error:', error)
    });
  }

  startConversation(userId: string): void {
    this.router.navigate(['/messages/chat', userId]);
  }

  ngOnDestroy(): void {
    this.userSub?.unsubscribe();
    this.statusSub?.unsubscribe();
  }
}