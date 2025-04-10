import { Location } from '@angular/common';
import { Component, HostListener, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthadminService } from 'src/app/services/authadmin.service';
import { trigger, transition, style, animate } from '@angular/animations';

@Component({
  selector: 'app-admin-layout',
  templateUrl: './admin-layout.component.html',
  styleUrls: ['./admin-layout.component.css'],
  animations: [
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-10px)' }),
        animate('150ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ]),
      transition(':leave', [
        animate('100ms ease-in', style({ opacity: 0, transform: 'translateY(-10px)' }))
      ])
    ])
  ]
})
export class AdminLayoutComponent implements OnInit {
  username: string;
  mobileMenuOpen = false;
  userMenuOpen = false;
  showLogoutModal = false;
  showScrollButton = false;
  currentYear = new Date().getFullYear();

  constructor(
    private location: Location,
    private authService: AuthadminService,
    private router: Router
  ) {
    this.username = this.authService.getUserName();
  }

  ngOnInit(): void {
    this.checkScrollPosition();
  }

  @HostListener('window:scroll')
  checkScrollPosition(): void {
    this.showScrollButton = window.pageYOffset > 300;
  }

  scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen = !this.mobileMenuOpen;
  }

  toggleUserMenu(): void {
    this.userMenuOpen = !this.userMenuOpen;
  }

  openLogoutModal(): void {
    this.showLogoutModal = true;
    this.userMenuOpen = false;
  }

  closeLogoutModal(): void {
    this.showLogoutModal = false;
  }

  logout(): void {
    localStorage.removeItem('token');
    this.router.navigateByUrl('/admin/login');
  }

  goBack(): void {
    this.location.back();
  }
}