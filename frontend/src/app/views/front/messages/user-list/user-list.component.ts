// user-list.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { DataService } from 'src/app/services/data.service';
import { GraphqlDataService } from 'src/app/services/graphql-data.service';
import { Subscription } from 'rxjs';
import { Router } from '@angular/router';
import { User } from '@app/models/user.model';

@Component({
  selector: 'app-user-list',
  templateUrl: './user-list.component.html',
  styleUrls: ['./user-list.component.css']
})
export class UserListComponent implements OnInit, OnDestroy { 
  
  users: User[] = [];
  loading = true;
  searchTerm = '';
  
  error: Error | null = null;
  currentUserId: string | null = null;
  private onlineUsers = new Set<string>();
  private userSub?: Subscription;
  private statusSub?: Subscription;

  constructor(
    private dataService: DataService,
    private graphqlService: GraphqlDataService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.currentUserId = this.dataService.currentUserValue?._id || null;
    this.loadUsers();
    this.subscribeToUserStatus();
  }

  loadUsers(): void {
    this.loading = true;
    this.error = null;
    
    this.userSub = this.graphqlService.getAllUsers(false, this.searchTerm).subscribe({
      next: (users: User[]) => {
        this.users = users;
        this.loading = false;
      },
      error: (error: Error) => {
        this.error = error;
        this.loading = false;
        console.error('Error loading users:', error);
      }
    });
  }

  onSearchChange(searchTerm: string): void {
    this.searchTerm = searchTerm.trim();
    this.loadUsers();
  }

  private subscribeToUserStatus(): void {
    this.statusSub = this.graphqlService.subscribeToUserStatus().subscribe({
      next: (user: User) => {
        const userId = user._id || user.id;
        if (!userId) {
          console.warn('Received user status update without ID');
          return;
        }
        this.updateUserStatus({
          ...user,
          _id: userId 
        });
      },
      error: (error: Error) => {
        console.error('Status subscription error:', error.message);
      }
    });
  }
  private updateUserStatus(updatedUser: User): void {
    const userId = updatedUser._id || updatedUser.id;
    if (!userId) return;

    const index = this.users.findIndex(u => 
      u._id === userId || u.id === userId
    );
    
    if (index !== -1) {
      this.users[index] = {
        ...this.users[index],
        isOnline: updatedUser.isOnline,
        lastActive: this.parseDate(updatedUser.lastActive),
        updatedAt: this.parseDate(updatedUser.updatedAt)
      };
      
      // Update online users set
      if (updatedUser.isOnline) {
        this.onlineUsers.add(userId);
      } else {
        this.onlineUsers.delete(userId);
      }

      // Trigger change detection
      this.users = [...this.users];
    }
  }

  private parseDate(dateValue?: string | Date): Date | undefined {
    if (!dateValue) return undefined;
    return typeof dateValue === 'string' ? new Date(dateValue) : dateValue;
  }

  isUserOnline(userId?: string): boolean {
    return userId ? this.onlineUsers.has(userId) : false;
  }

  startConversation(userId: string): void {
    if (!userId) {
      console.error('No user ID provided for conversation');
      return;
    }
    this.router.navigate(['/messages/chat', userId]);
  }

  ngOnDestroy(): void {
    this.userSub?.unsubscribe();
    this.statusSub?.unsubscribe();
  }
}