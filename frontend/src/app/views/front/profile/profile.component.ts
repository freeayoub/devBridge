import { Component, OnInit } from '@angular/core';
import { AuthService } from 'src/app/services/auth.service';
import { finalize } from 'rxjs/operators';
import { AuthuserService } from 'src/app/services/authuser.service';
import { Router } from '@angular/router';
import { DataService } from 'src/app/services/data.service';
import { User } from 'src/app/models/user.model';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css'],
})
export class ProfileComponent implements OnInit {
  user: any;
  selectedImage: File | null = null;
  previewUrl: string | null = null;
  message = '';
  error = '';
  uploadLoading = false;
  removeLoading = false;

  constructor(
    private authService: AuthService,
    private authuserService: AuthuserService,
    private dataService: DataService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Load user profile using DataService
    this.dataService.getProfile().subscribe({
      next: (res) => {
        this.user = res;

        // Ensure image properties are consistent
        if (!this.user.profileImage && this.user.image) {
          this.user.profileImage = this.user.image;
        } else if (!this.user.image && this.user.profileImage) {
          this.user.image = this.user.profileImage;
        }

        // If no image is available, use default
        if (
          !this.user.profileImage ||
          this.user.profileImage === 'null' ||
          this.user.profileImage.trim() === ''
        ) {
          this.user.profileImage = 'assets/images/default-profile.png';
          this.user.image = 'assets/images/default-profile.png';
        }

        // Ensure profileImageURL is also set for backward compatibility
        if (!this.user.profileImageURL) {
          this.user.profileImageURL = this.user.profileImage || this.user.image;
        }
      },
      error: () => {
        this.error = 'Failed to load profile.';
      },
    });
  }

  /**
   * Returns the appropriate profile image URL based on available properties
   * Uses the same logic as in front-layout component for consistency
   */
  getProfileImageUrl(): string {
    if (!this.user) return 'assets/images/default-profile.png';

    // Check profileImage first
    if (
      this.user.profileImage &&
      this.user.profileImage !== 'null' &&
      this.user.profileImage.trim() !== ''
    ) {
      return this.user.profileImage;
    }

    // Then check image
    if (
      this.user.image &&
      this.user.image !== 'null' &&
      this.user.image.trim() !== ''
    ) {
      return this.user.image;
    }

    // Then check profileImageURL (for backward compatibility)
    if (
      this.user.profileImageURL &&
      this.user.profileImageURL !== 'null' &&
      this.user.profileImageURL.trim() !== ''
    ) {
      return this.user.profileImageURL;
    }

    // Default fallback
    return 'assets/images/default-profile.png';
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

          // Update all image properties to ensure consistency across the application
          this.user.profileImageURL = response.imageUrl;
          this.user.profileImage = response.imageUrl;
          this.user.image = response.imageUrl;

          // Mettre à jour l'utilisateur dans le service pour synchroniser avec le layout
          this.dataService.updateCurrentUser({
            profileImage: response.imageUrl,
            image: response.imageUrl,
          });

          // Also update in AuthUserService to ensure all components are updated
          this.authuserService.setCurrentUser({
            ...this.user,
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

          // Update all image properties to ensure consistency across the application
          this.user.profileImageURL = null;
          this.user.profileImage = null;
          this.user.image = null;

          // Mettre à jour l'utilisateur dans le service pour synchroniser avec le layout
          this.dataService.updateCurrentUser({
            profileImage: 'assets/images/default-profile.png',
            image: 'assets/images/default-profile.png',
          });

          // Also update in AuthUserService to ensure all components are updated
          this.authuserService.setCurrentUser({
            ...this.user,
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

  private resetFileInput(): void {
    this.selectedImage = null;
    this.previewUrl = null;
    const fileInput = document.getElementById(
      'profile-upload'
    ) as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  }

  navigateTo(path: string): void {
    this.router.navigate([path]);
  }

  logout(): void {
    this.authuserService.logout().subscribe({
      next: () => {
        this.authuserService.clearAuthData();
        setTimeout(() => {
          this.router.navigate(['/login'], {
            queryParams: { message: 'Déconnexion réussie' },
            replaceUrl: true,
          });
        }, 100);
      },
      error: (err: any) => {
        console.error('Logout error:', err);
        this.authuserService.clearAuthData();
        setTimeout(() => {
          this.router.navigate(['/login'], {});
        }, 100);
      },
    });
  }
}
