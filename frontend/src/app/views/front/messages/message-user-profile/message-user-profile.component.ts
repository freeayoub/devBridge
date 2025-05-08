// message-user-profile.component.ts
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { User } from '@app/models/user.model';
import { MessageService } from '@app/services/message.service';
import { ToastService } from '@app/services/toast.service';

@Component({
  selector: 'app-message-user-profile',
  templateUrl: './message-user-profile.component.html',
  styleUrls: ['./message-user-profile.component.css']
})
export class MessageUserProfileComponent implements OnInit {
  user: User | null = null;
  loading = true;

  constructor(
    public route: ActivatedRoute,
    public router :Router,
     private MessageService: MessageService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    const userId = this.route.snapshot.paramMap.get('userId');
    if (userId) {
      this.loadUser(userId);
    }
  }

  loadUser(userId: string): void {
    this.loading = true;
    this.MessageService.getOneUser(userId).subscribe({
      next: (user) => {
        this.user = user;
        this.loading = false;
      },
      error: (error) => {
        this.loading = false;
        this.toastService.showError('Failed to load user profile');
      }
    });
  }
}