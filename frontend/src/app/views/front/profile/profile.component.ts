import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { AuthuserService } from 'src/app/services/authuser.service';
import { DataService } from 'src/app/services/data.service';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css'],
})
export class ProfileComponent implements OnInit {
  profileForm: FormGroup;
  passwordForm: FormGroup;
  message = '';
  error = '';
  isLoading = false;
  currentUser: any;
  profileImage: string | null = null;
  selectedFile: File | null = null;
  previewUrl: string | ArrayBuffer | null = null;
  cd: any;
  isInitializing = true;
  isProfileLoading = false;
  isPasswordLoading = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthuserService,
    private dataService: DataService,
    private router: Router
  ) {
    this.profileForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
    });
    this.passwordForm = this.fb.group(
      {
        currentPassword: ['', Validators.required],
        newPassword: ['', [Validators.required, Validators.minLength(6)]],
        confirmPassword: ['', Validators.required],
      },
      { validator: this.passwordMatchValidator }
    );
  }

  ngOnInit(): void {
    if (!this.authService.userLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }
    this.initializeUserData();
  }

  refreshUserData(): void {
    this.isProfileLoading = true;
    this.error = '';
    this.message = '';

    this.dataService.syncCurrentUser().pipe(
      finalize(() => {
        this.isProfileLoading = false;
        this.cd?.markForCheck();
      })
    ).subscribe({
      next: (user) => {
        this.currentUser = user;
        this.profileForm.patchValue({
          username: user.username,
          email: user.email
        });
        this.profileImage = user.image || 'assets/images/default-profile.png';
        this.message = 'Profile data refreshed successfully';
      },
      error: (err) => {
        console.error('Failed to refresh user data', err);
        this.error = this.getProfileErrorMessage(err);
        if (this.currentUser) {
          this.profileForm.patchValue({
            username: this.currentUser.username,
            email: this.currentUser.email
          });
        }
      }
    });
  }

  private initializeUserData(): void {
    this.isInitializing = true;
    this.error = '';

    this.dataService.syncCurrentUser().pipe(
      finalize(() => this.isInitializing = false)
    ).subscribe({
      next: (user) => {
        this.currentUser = user;
        this.profileForm.patchValue({
          username: user.username,
          email: user.email
        });
        this.profileImage = user.image || 'assets/images/default-profile.png';
      },
      error: (err) => {
        console.error('Failed to initialize user data', err);
        this.error = this.getProfileErrorMessage(err);
        const authUser = this.authService.getCurrentUser();
        if (authUser) {
          this.currentUser = authUser;
          this.profileForm.patchValue({
            username: authUser.username,
            email: authUser.email
          });
          this.profileImage = authUser.image || 'assets/images/default-profile.png';
        }
      }
    });
  }

  passwordMatchValidator(g: FormGroup) {
    const newPassword = g.get('newPassword')?.value;
    const confirmPassword = g.get('confirmPassword')?.value;
    return newPassword === confirmPassword ? null : { mismatch: true };
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

      this.selectedFile = file;
      this.error = '';

      const reader = new FileReader();
      reader.onload = (e) => (this.previewUrl = e.target?.result || null);
      reader.readAsDataURL(file);
    }
  }

  uploadImage(): void {
    if (!this.selectedFile) return;

    this.isLoading = true;
    this.message = '';
    this.error = '';
    
    this.dataService.uploadProfileImage(this.selectedFile).pipe(
      finalize(() => this.isLoading = false)
    ).subscribe({
      next: (response) => {
        this.message = 'Profile image updated successfully';
        this.refreshUserData(); // Refresh all user data after upload
        if (response.token) {
          localStorage.setItem('token', response.token);
        }
      },
      error: (err) => {
        this.error = this.getUploadErrorMessage(err);
      }
    });
  }

  removeImage(): void {
    if (!confirm('Are you sure you want to remove your profile picture?')) return;

    this.isLoading = true;
    this.message = '';
    this.error = '';

    this.dataService.removeProfileImage().pipe(
      finalize(() => this.isLoading = false)
    ).subscribe({
      next: (response) => {
        this.message = 'Profile picture removed successfully';
        this.refreshUserData(); // Refresh all user data after removal
        if (response.token) {
          localStorage.setItem('token', response.token);
        }
      },
      error: (err) => {
        this.error = this.getProfileErrorMessage(err);
      }
    });
  }

  updateProfile(): void {
    if (this.profileForm.invalid) {
      this.markFormGroupTouched(this.profileForm);
      this.error = 'Please correct the errors in the form';
      return;
    }

    this.isLoading = true;
    this.error = '';
    this.message = '';

    const userId = this.authService.getCurrentUserId();
    if (!userId) {
      this.error = 'User not logged in';
      this.isLoading = false;
      return;
    }

    const formData = {
      username: this.profileForm.value.username,
      email: this.profileForm.value.email,
      currentPassword: this.passwordForm.value.currentPassword || undefined,
    };

    this.dataService.updateSelf(userId, formData).pipe(
      finalize(() => this.isLoading = false)
    ).subscribe({
      next: (response) => {
        this.message = 'Profile updated successfully';
        this.refreshUserData(); 
        
        if (response.token) {
          this.authService.saveToken(response.token);
        }
        this.profileForm.markAsPristine();
      },
      error: (err) => {
        this.error = this.getProfileErrorMessage(err);
        if (err.error?.error?.includes('email est déjà utilisé')) {
          this.profileForm.get('email')?.setErrors({ unique: true });
        }
        if (err.error?.error?.includes("nom d'utilisateur est déjà utilisé")) {
          this.profileForm.get('username')?.setErrors({ unique: true });
        }
      }
    });
  }

  changePassword(): void {
    if (this.passwordForm.invalid) {
      this.markFormGroupTouched(this.passwordForm);
      this.error = 'Please correct the errors in the form';
      return;
    }

    this.isPasswordLoading = true;
    this.error = '';
    this.message = '';

    const { currentPassword, newPassword } = this.passwordForm.value;
    this.dataService.changePassword(currentPassword, newPassword).pipe(
      finalize(() => {
        this.isPasswordLoading = false;
        this.cd?.markForCheck();
      })
    ).subscribe({
      next: () => {
        this.message = 'Password changed successfully';
        this.passwordForm.reset();
      },
      error: (err) => {
        this.error = err.message;
        if (err.message.includes('current password')) {
          this.passwordForm.get('currentPassword')?.setErrors({ incorrect: true });
        }
      }
    });
  }

  deactivateAccount(): void {
    if (!confirm('Are you sure you want to deactivate your account? This action is irreversible and all your data will be permanently lost.')) {
      return;
    }

    this.isLoading = true;
    this.error = '';
    this.message = '';

    const userId = this.authService.getCurrentUserId();
    if (!userId) {
      this.error = 'User not logged in';
      this.isLoading = false;
      return;
    }

    this.authService.deactivateSelf().pipe(
      finalize(() => this.isLoading = false)
    ).subscribe({
      next: () => {
        this.message = 'Account deactivated successfully';
        this.authService.logout().subscribe(() => {
          this.router.navigate(['/login']);
        });
      },
      error: (err) => {
        this.error = err.error?.error || 'Failed to deactivate account';
      }
    });
  }

  private getUploadErrorMessage(error: any): string {
    switch (error.error?.code) {
      case 'FILE_TOO_LARGE': return 'Image size is too large (max 2MB)';
      case 'INVALID_FILE_TYPE': return 'Only JPEG, PNG or WebP images are allowed';
      case 'UPLOAD_FAILED': return 'Image upload failed, please try again';
      default: return error.error?.message || 'Failed to upload image';
    }
  }

  private getProfileErrorMessage(error: any): string {
    if (error.error?.details) {
      const details = error.error.details;
      if (details.username) return `Username error: ${details.username}`;
      if (details.email) return `Email error: ${details.email}`;
    }
    return error.error?.error || 'Failed to update profile';
  }

  private markFormGroupTouched(formGroup: FormGroup) {
    Object.values(formGroup.controls).forEach((control) => {
      control.markAsTouched();
      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }

  private resetFileInput(): void {
    this.selectedFile = null;
    this.previewUrl = null;
    const fileInput = document.getElementById('profileImageInput') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  }
}