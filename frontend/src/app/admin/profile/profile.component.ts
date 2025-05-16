import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../auth/auth.service';
import { ThemeService } from '../../shared/theme.service';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class ProfileComponent implements OnInit {
  user: any = null;
  selectedImage: File | null = null;
  message = '';
  error = '';
  loading = true;
  uploadLoading = false;
  stats = {
    totalUsers: 0,
    activeUsers: 0,
    inactiveUsers: 0,
    students: 0,
    teachers: 0,
    admins: 0
  };
  recentActivity = [
    { action: 'User Deactivated', target: 'John Doe', timestamp: new Date(Date.now() - 3600000) },
    { action: 'Role Changed', target: 'Jane Smith', timestamp: new Date(Date.now() - 7200000) },
    { action: 'User Added', target: 'Robert Johnson', timestamp: new Date(Date.now() - 86400000) }
  ];

  constructor(
    private authService: AuthService,
    private router: Router,
    private themeService: ThemeService
  ) {}

  ngOnInit(): void {
    this.loadUserData();
    this.loadStats();
  }

  loadUserData(): void {
    const token = localStorage.getItem('token');
    if (!token) {
      this.router.navigate(['/auth/login']);
      return;
    }

    this.loading = true;
    this.authService.getProfile(token).subscribe({
      next: (res: any) => {
        this.user = res;
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to load profile.';
        this.loading = false;
      }
    });
  }

  loadStats(): void {
    const token = localStorage.getItem('token');
    if (!token) return;

    this.authService.getAllUsers(token).subscribe({
      next: (res: any) => {
        const users = res as any[];
        this.stats.totalUsers = users.length;
        this.stats.activeUsers = users.filter(u => u.isActive !== false).length;
        this.stats.inactiveUsers = users.filter(u => u.isActive === false).length;
        this.stats.students = users.filter(u => u.role === 'student').length;
        this.stats.teachers = users.filter(u => u.role === 'teacher').length;
        this.stats.admins = users.filter(u => u.role === 'admin').length;
      },
      error: () => {
        // Silently fail, stats are not critical
      }
    });
  }

  onFileSelected(event: any): void {
    this.selectedImage = event.target.files[0];
  }

  onUpload(): void {
    if (!this.selectedImage) return;

    const formData = new FormData();
    formData.append('image', this.selectedImage);
    const token = localStorage.getItem('token');
    if (!token) return;

    this.uploadLoading = true;
    this.message = '';
    this.error = '';

    this.authService.updateProfile(formData, token).subscribe({
      next: (res: any) => {
        this.message = res.message || 'Profile updated successfully';
        this.user.profileImageURL = res.user.profileImageURL;
        this.selectedImage = null;
        this.uploadLoading = false;

        // Auto-hide message after 3 seconds
        setTimeout(() => {
          this.message = '';
        }, 3000);
      },
      error: (err) => {
        this.error = err.error?.message || 'Upload failed';
        this.uploadLoading = false;

        // Auto-hide error after 3 seconds
        setTimeout(() => {
          this.error = '';
        }, 3000);
      }
    });
  }

  navigateTo(path: string): void {
    this.router.navigate([path]);
  }

  toggleDarkMode(): void {
    this.themeService.toggleDarkMode();
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/']);
  }

  formatDate(date: Date): string {
    return new Date(date).toLocaleString();
  }

  getInitials(name: string): string {
    if (!name) return 'A';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  }
}
