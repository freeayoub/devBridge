import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthuserService } from 'src/app/services/authuser.service';

@Component({
  selector: 'app-front-layout',
  templateUrl: './front-layout.component.html',
  styleUrls: ['./front-layout.component.css']
})
export class FrontLayoutComponent implements OnInit {
  sidebarOpen = false;
  profileMenuOpen = false;
  profileImage: string | null = null;
  currentUser: any;
  messageFromRedirect: string = '';

  constructor(
    public authService: AuthuserService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    this.loadProfileImage();
    this.subscribeToQueryParams();
  }

  private loadProfileImage(): void {
    const savedImage = localStorage.getItem('profileImage');
    if (savedImage) {
      this.profileImage = savedImage;
    }
  }

  private subscribeToQueryParams(): void {
    this.route.queryParams.subscribe(params => {
      this.messageFromRedirect = params['message'] || '';
    });
  }

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  toggleProfileMenu(): void {
    this.profileMenuOpen = !this.profileMenuOpen;
  }

  handleProfileImage(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      const reader = new FileReader();
      
      reader.onload = (e: ProgressEvent<FileReader>) => {
        if (e.target?.result) {
          this.profileImage = e.target.result as string;
          localStorage.setItem('profileImage', this.profileImage);
          this.profileMenuOpen = false;
        }
      };
      reader.readAsDataURL(file);
    }
  }
  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('profileImage');
    this.currentUser = null;
    this.profileImage = null;
    this.router.navigate(['/loginuser']);
  }
}
