import { Component, OnInit } from '@angular/core';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html'
})
export class ProfileComponent implements OnInit {
  user: any;
  selectedImage: File | null = null;
  message = '';
  error = '';

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    const token = localStorage.getItem('token');
    if (token) {
      this.authService.getProfile(token).subscribe({
        next: (res) => {
          this.user = res;
        },
        error: () => {
          this.error = 'Failed to load profile.';
        }
      });
    }
  }

  onFileSelected(event: any) {
    this.selectedImage = event.target.files[0];
  }

  onUpload() {
    if (!this.selectedImage) return;

    const formData = new FormData();
    formData.append('image', this.selectedImage);
    const token = localStorage.getItem('token');

    this.authService.updateProfile(formData, token!).subscribe({
      next: (res: any) => {
        this.message = res.message;

        // Update the user object with the new profile image URL
        this.user.profileImageURL = res.user.profileImageURL;

        // Also update the user in localStorage to keep it in sync
        const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
        storedUser.profileImageURL = res.user.profileImageURL;
        localStorage.setItem('user', JSON.stringify(storedUser));

        this.selectedImage = null;

        // Auto-hide message after 3 seconds
        setTimeout(() => {
          this.message = '';
        }, 3000);
      },
      error: (err) => {
        this.error = err.error.message || 'Upload failed';

        // Auto-hide error after 3 seconds
        setTimeout(() => {
          this.error = '';
        }, 3000);
      }
    });
  }
  logout() {
    localStorage.removeItem('token');
    window.location.href = '/auth/login'; // or use router.navigate
  }
}
