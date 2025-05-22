import { Location } from '@angular/common';
import { Component, HostListener, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { AuthadminService } from 'src/app/services/authadmin.service';
import { trigger, transition, style, animate } from '@angular/animations';
import { AuthuserService } from 'src/app/services/authuser.service';
import { ThemeService } from '@app/services/theme.service';
import { Observable, Subscription } from 'rxjs';
import { DataService } from 'src/app/services/data.service';
import { User } from 'src/app/models/user.model';
@Component({
  selector: 'app-admin-layout',
  templateUrl: './admin-layout.component.html',
  styleUrls: ['./admin-layout.component.css'],
  animations: [
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-10px)' }),
        animate(
          '150ms ease-out',
          style({ opacity: 1, transform: 'translateY(0)' })
        ),
      ]),
      transition(':leave', [
        animate(
          '100ms ease-in',
          style({ opacity: 0, transform: 'translateY(-10px)' })
        ),
      ]),
    ]),
  ],
})
export class AdminLayoutComponent implements OnInit, OnDestroy {
  username: string = '';
  imageProfile: string = '';
  mobileMenuOpen = false;
  userMenuOpen = false;
  showLogoutModal = false;
  showScrollButton = false;
  currentYear = new Date().getFullYear();
  isDarkMode$: Observable<boolean>;
  private subscriptions: Subscription[] = [];

  constructor(
    private location: Location,
    private authAdminService: AuthadminService,
    private authService: AuthuserService,
    private router: Router,
    private themeService: ThemeService,
    private dataService: DataService
  ) {
    this.loadUserProfile();
    this.isDarkMode$ = this.themeService.darkMode$;
  }

  private loadUserProfile(): void {
    const user = this.authAdminService.getUser();
    this.username = user?.fullName || user?.username || '';

    // Toujours utiliser l'image par défaut si l'image de profil est null, 'null' ou vide
    if (
      user?.profileImage &&
      user.profileImage !== 'null' &&
      user.profileImage.trim() !== ''
    ) {
      this.imageProfile = user.profileImage;
    } else if (
      user?.image &&
      user.image !== 'null' &&
      user.image.trim() !== ''
    ) {
      this.imageProfile = user.image;
    } else {
      this.imageProfile = 'assets/images/default-profile.png';
    }

    console.log('Admin layout - Image profile loaded:', this.imageProfile);
  }

  ngOnInit(): void {
    this.checkScrollPosition();

    // S'abonner aux changements d'image de profil
    const profileSub = this.dataService.currentUser$.subscribe(
      (user: User | null) => {
        if (user) {
          this.username = user.fullName || user.username || '';

          // Toujours utiliser l'image par défaut si l'image de profil est null, 'null' ou vide
          if (
            user.profileImage &&
            user.profileImage !== 'null' &&
            user.profileImage.trim() !== ''
          ) {
            this.imageProfile = user.profileImage;
          } else if (
            user.image &&
            user.image !== 'null' &&
            user.image.trim() !== ''
          ) {
            this.imageProfile = user.image;
          } else {
            this.imageProfile = 'assets/images/default-profile.png';
          }

          console.log(
            'Admin layout - Image profile updated:',
            this.imageProfile
          );
        }
      }
    );

    this.subscriptions.push(profileSub);
  }

  ngOnDestroy(): void {
    // Désabonner de tous les observables pour éviter les fuites de mémoire
    this.subscriptions.forEach((sub) => sub.unsubscribe());
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
    this.authService.logout().subscribe({
      next: () => {
        this.userMenuOpen = false;
        this.showLogoutModal = false;
        this.authService.clearAuthData();
        this.authAdminService.clearAuthData();
        setTimeout(() => {
          this.router.navigate(['/admin/login'], {
            queryParams: { message: 'Déconnexion réussie' },
            replaceUrl: true,
          });
        }, 100);
      },
      error: (err) => {
        console.error('Logout error:', err);
        this.authService.clearAuthData();
        this.authAdminService.clearAuthData();
        setTimeout(() => {
          this.router.navigate(['/admin/login'], {
            queryParams: { message: 'Déconnexion effectuée' },
            replaceUrl: true,
          });
        }, 100);
      },
    });
  }

  goBack(): void {
    this.location.back();
  }

  toggleDarkMode(): void {
    this.themeService.toggleDarkMode();
  }
}
