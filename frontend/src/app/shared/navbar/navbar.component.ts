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
      this.user = JSON.parse(userStr);
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
