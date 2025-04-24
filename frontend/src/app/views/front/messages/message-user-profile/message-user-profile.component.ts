import { Component, Input, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { User } from '@app/models/user.model';
import { GraphqlDataService } from '@app/services/graphql-data.service';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-message-user-profile',
  templateUrl: './message-user-profile.component.html',
  styleUrls: ['./message-user-profile.component.css'],
  providers: [DatePipe],
})
export class MessageUserProfileComponent implements OnInit {
  @Input() userId?: string;
  user: User | null = null;
  loading = true;
  isMessagingContext = false;

  constructor(
    private graphqlService: GraphqlDataService,
    private route: ActivatedRoute,
    private router: Router,
    private datePipe: DatePipe
  ) {}

  ngOnInit() {
    const userId = this.route.snapshot.paramMap.get('userId');
    this.userId = userId || undefined;
    this.isMessagingContext = this.router.url.includes('/messages/');

    if (userId) {
      this.loadUser(userId);
    }
  }

  private processUser(userData: any): User {
    return {
      _id: userData.id,
      id: userData.id,
      username: userData.username,
      email: userData.email,
      image: userData.profileImage || 'assets/images/default-profile.png',
      bio: userData.bio || undefined,
      lastActive: userData.lastActive
        ? new Date(userData.lastActive)
        : undefined,
      createdAt: userData.createdAt ? new Date(userData.createdAt) : undefined,
      updatedAt: userData.updatedAt ? new Date(userData.updatedAt) : undefined,
      followingCount: userData.followingCount || 0,
      followersCount: userData.followersCount || 0,
      postCount: userData.postCount || 0,
      role: userData.role || 'user', // Default role
      isActive: userData.isActive !== undefined ? userData.isActive : true, // Default to active
    };
  }

  formatLastActive(date?: Date): string {
    if (!date) return 'Unknown';

    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600)
      return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400)
      return `${Math.floor(diffInSeconds / 3600)} hours ago`;

    return this.datePipe.transform(date, 'mediumDate') || 'Unknown';
  }

  loadUser(id: string) {
    this.loading = true;
    this.graphqlService.getOneUser(id).subscribe({
      next: (userData) => {
        this.user = this.processUser(userData);
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading user:', error);
        this.loading = false;
      },
    });
  }
}
