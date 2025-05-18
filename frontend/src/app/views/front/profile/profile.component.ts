import { Component, OnInit } from '@angular/core';
import { AuthService } from 'src/app/services/auth.service';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css'],
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
        },
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
        this.user.profileImageURL = res.user.profileImageURL;
        this.selectedImage = null;
      },
      error: (err) => {
        this.error = err.error.message || 'Upload failed';
      },
    });
  }
  logout() {
    localStorage.removeItem('token');
    window.location.href = '/login'; 
  }
}
