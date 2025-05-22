import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthadminService } from '@app/services/authadmin.service';
import { AuthuserService } from '@app/services/authuser.service';
import { DataService } from '@app/services/data.service';
import { finalize } from 'rxjs';
import { AuthService } from 'src/app/services/auth.service';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css'],
})
export class ProfileComponent implements OnInit {
  user: any = null;
  selectedImage: File | null = null;
  message = '';
  error = '';
  loading = true;
  uploadLoading = false;
  removeLoading = false;
  stats = {
    totalUsers: 0,
    activeUsers: 0,
    inactiveUsers: 0,
    students: 0,
    teachers: 0,
    admins: 0,
  };
  recentActivity = [
    {
      action: 'User Deactivated',
      target: 'John Doe',
      timestamp: new Date(Date.now() - 3600000),
    },
    {
      action: 'Role Changed',
      target: 'Jane Smith',
      timestamp: new Date(Date.now() - 7200000),
    },
    {
      action: 'User Added',
      target: 'Robert Johnson',
      timestamp: new Date(Date.now() - 86400000),
    },
  ];
  previewUrl: string | ArrayBuffer | null = null;
  constructor(
    private authService: AuthService,
    private dataService: DataService,
    private authAdminService: AuthadminService,
    private authUserService: AuthuserService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadUserData();
    this.loadStats();
  }

  loadUserData(): void {
    const token = localStorage.getItem('token');
    if (!token) {
      this.router.navigate(['/admin/login']);
      return;
    }

    this.loading = true;
    this.authService.getProfile(token).subscribe({
      next: (res: any) => {
        this.user = res;
        this.loading = false;
      },
      error: (err: { error: { message: string } }) => {
        this.error = err.error?.message || 'Failed to load profile.';
        this.loading = false;
      },
    });
  }

  loadStats(): void {
    const token = localStorage.getItem('token');
    if (!token) return;

    this.authService.getAllUsers(token).subscribe({
      next: (res: any) => {
        const users = res as any[];
        this.stats.totalUsers = users.length;
        this.stats.activeUsers = users.filter(
          (u) => u.isActive !== false
        ).length;
        this.stats.inactiveUsers = users.filter(
          (u) => u.isActive === false
        ).length;
        this.stats.students = users.filter((u) => u.role === 'student').length;
        this.stats.teachers = users.filter((u) => u.role === 'teacher').length;
        this.stats.admins = users.filter((u) => u.role === 'admin').length;
      },
      error: () => {
        // Silently fail, stats are not critical
      },
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      const file = input.files[0];

      const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        this.error = 'Seuls les JPEG, PNG et WebP sont autorisés';
        this.resetFileInput();
        return;
      }

      if (file.size > 2 * 1024 * 1024) {
        this.error = "L'image ne doit pas dépasser 2MB";
        this.resetFileInput();
        return;
      }

      this.selectedImage = file;
      this.error = '';

      const reader = new FileReader();
      reader.onload = (e) => {
        this.previewUrl = (e.target?.result as string) || null;
      };
      reader.readAsDataURL(file);
    }
  }
  private resetFileInput(): void {
    this.selectedImage = null;
    this.previewUrl = null;
    const fileInput = document.getElementById(
      'profile-upload'
    ) as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  }

  onUpload(): void {
    if (!this.selectedImage) return;

    this.uploadLoading = true; // Activer l'état de chargement
    this.message = '';
    this.error = '';

    console.log('Upload started, uploadLoading:', this.uploadLoading);

    this.dataService
      .uploadProfileImage(this.selectedImage)
      .pipe(
        finalize(() => {
          this.uploadLoading = false;
          console.log('Upload finished, uploadLoading:', this.uploadLoading);
        })
      )
      .subscribe({
        next: (response: any) => {
          this.message = response.message || 'Profile updated successfully';

          // Update both properties to ensure consistency
          this.user.profileImageURL = response.imageUrl;
          this.user.profileImage = response.imageUrl;

          // Mettre à jour l'utilisateur dans le service pour synchroniser avec le layout
          this.dataService.updateCurrentUser({
            profileImage: response.imageUrl,
            image: response.imageUrl,
          });

          this.selectedImage = null;
          this.previewUrl = null;
          this.resetFileInput();

          if (response.token) {
            localStorage.setItem('token', response.token);
          }

          // Auto-hide message after 3 seconds
          setTimeout(() => {
            this.message = '';
          }, 3000);
        },
        error: (err: { error: { message: string } }) => {
          this.error = err.error?.message || 'Upload failed';
          // Auto-hide error after 3 seconds
          setTimeout(() => {
            this.error = '';
          }, 3000);
        },
      });
  }
  removeProfileImage(): void {
    if (!confirm('Are you sure you want to remove your profile picture?'))
      return;

    this.removeLoading = true;
    this.message = '';
    this.error = '';

    this.dataService
      .removeProfileImage()
      .pipe(finalize(() => (this.removeLoading = false)))
      .subscribe({
        next: (response: any) => {
          this.message =
            response.message || 'Profile picture removed successfully';

          // Update both properties to ensure consistency
          this.user.profileImageURL = null;
          this.user.profileImage = null;

          // Mettre à jour l'utilisateur dans le service pour synchroniser avec le layout
          this.dataService.updateCurrentUser({
            profileImage: 'assets/images/default-profile.png',
            image: 'assets/images/default-profile.png',
          });

          if (response.token) {
            localStorage.setItem('token', response.token);
          }

          // Auto-hide message after 3 seconds
          setTimeout(() => {
            this.message = '';
          }, 3000);
        },
        error: (err: { error: { message: string } }) => {
          this.error = err.error?.message || 'Removal failed';
          // Auto-hide error after 3 seconds
          setTimeout(() => {
            this.error = '';
          }, 3000);
        },
      });
  }

  navigateTo(path: string): void {
    this.router.navigate([path]);
  }

  logout(): void {
    this.authUserService.logout().subscribe({
      next: () => {
        this.authUserService.clearAuthData();
        this.authAdminService.clearAuthData();
        setTimeout(() => {
          this.router.navigate(['/admin/login'], {
            queryParams: { message: 'Déconnexion réussie' },
            replaceUrl: true,
          });
        }, 100);
      },
      error: (err: any) => {
        console.error('Logout error:', err);
        this.authUserService.clearAuthData();
        this.authAdminService.clearAuthData();
        setTimeout(() => {
          this.router.navigate(['/admin/login'], {});
        }, 100);
      },
    });
  }

  formatDate(date: Date): string {
    return new Date(date).toLocaleString();
  }

  getInitials(name: string): string {
    if (!name) return 'A';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  }
}
