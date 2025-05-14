import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../auth/auth.service';
import { ThemeService } from '../theme.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss']
})
export class NavbarComponent implements OnInit {
  isLoggedIn = false;
  user: any = null;
  isDropdownOpen = false;
  darkMode$: Observable<boolean>;

  constructor(
    private authService: AuthService,
    private router: Router,
    private themeService: ThemeService
  ) {
    this.darkMode$ = this.themeService.darkMode$;
  }

  ngOnInit(): void {
    this.checkLoginStatus();
  }

  checkLoginStatus(): void {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');

    if (token && userStr) {
      this.isLoggedIn = true;
      // First set user from localStorage
      this.user = JSON.parse(userStr);

      // Then fetch the latest user data from the server to get the updated profile image
      this.authService.getProfile(token).subscribe({
        next: (userData: any) => {
          // Update the user object with the latest data
          this.user = userData;

          // Also update the user in localStorage to keep it in sync
          localStorage.setItem('user', JSON.stringify(userData));
        },
        error: (err) => {
          console.error('Failed to fetch user profile:', err);
        }
      });
    } else {
      this.isLoggedIn = false;
      this.user = null;
    }
  }

  toggleDropdown(): void {
    this.isDropdownOpen = !this.isDropdownOpen;
  }

  closeDropdown(): void {
    this.isDropdownOpen = false;
  }

  logout(): void {
    this.authService.logout();
    this.isLoggedIn = false;
    this.user = null;
    this.router.navigate(['/']);
  }

  toggleDarkMode(): void {
    this.themeService.toggleDarkMode();
  }

  navigateTo(path: string): void {
    this.router.navigate([path]);
    this.closeDropdown();
  }
}
