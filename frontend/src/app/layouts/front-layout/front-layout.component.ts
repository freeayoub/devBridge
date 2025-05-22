import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { ActivatedRoute, Router, NavigationEnd } from '@angular/router';
import { Subject, Subscription, Observable } from 'rxjs';
import { filter, takeUntil, distinctUntilChanged } from 'rxjs/operators';
import { AuthuserService } from 'src/app/services/authuser.service';
import { UserStatusService } from 'src/app/services/user-status.service';
import { MessageService } from 'src/app/services/message.service';
import { User } from 'src/app/models/user.model';
import { ThemeService } from '@app/services/theme.service';
import { DataService } from 'src/app/services/data.service';
import { environment } from 'src/environments/environment';
@Component({
  selector: 'app-front-layout',
  templateUrl: './front-layout.component.html',
  styleUrls: ['./front-layout.component.css'],
})
export class FrontLayoutComponent implements OnInit, OnDestroy {
  sidebarOpen = false;
  profileMenuOpen = false;
  currentUser: User | null = null;
  messageFromRedirect: string = '';
  unreadNotificationsCount = 0;
  isMobileView = false;
  username: string = '';
  imageProfile: string = '';
  isDarkMode$: Observable<boolean>;

  private destroy$ = new Subject<void>();
  private readonly MOBILE_BREAKPOINT = 768;
  private subscriptions: Subscription[] = [];

  constructor(
    public authService: AuthuserService,
    private route: ActivatedRoute,
    private router: Router,
    public statusService: UserStatusService,
    private MessageService: MessageService,
    private themeService: ThemeService,
    private dataService: DataService
  ) {
    this.checkViewport();
    this.loadUserProfile();
    this.isDarkMode$ = this.themeService.darkMode$;
  }

  private loadUserProfile(): void {
    // Try to get user from both services for maximum reliability
    const authUser = this.authService.getCurrentUser();
    const dataUser = this.dataService.currentUserValue;

    console.log('Auth User:', authUser);
    console.log('Data User:', dataUser);

    // Prefer dataUser if available, otherwise use authUser
    const user = dataUser || authUser;

    if (user) {
      this.updateProfileDisplay(user);

      // Forcer une synchronisation complète des données utilisateur
      if (this.authService.userLoggedIn()) {
        this.dataService.syncCurrentUser().subscribe({
          next: (updatedUser) => {
            console.log('User profile synced:', updatedUser);
            this.updateProfileDisplay(updatedUser);
          },
          error: (err) => {
            console.error('Failed to sync user profile:', err);
          },
        });
      }
    } else {
      // Default values if no user is found
      this.username = '';
      this.imageProfile = 'assets/images/default-profile.png';
    }

    console.log('Front layout - Image profile loaded:', this.imageProfile);

    // Sync user data between services if needed
    if (authUser && !dataUser) {
      this.dataService.updateCurrentUser(authUser);
    } else if (!authUser && dataUser) {
      this.authService.setCurrentUser(dataUser);
    }
  }
  ngOnInit(): void {
    this.subscribeToQueryParams();
    this.subscribeToCurrentUser();
    this.subscribeToRouterEvents();
    this.setupNotificationSystem();
  }
  @HostListener('window:resize')
  private checkViewport(): void {
    this.isMobileView = window.innerWidth < this.MOBILE_BREAKPOINT;
    if (!this.isMobileView) {
      this.sidebarOpen = false;
    }
  }
  private setupNotificationSystem(): void {
    // Real-time count updates
    this.MessageService.notificationCount$
      .pipe(takeUntil(this.destroy$), distinctUntilChanged())
      .subscribe((count) => {
        this.unreadNotificationsCount = count;
      });
    // Charger les notifications initiales si l'utilisateur est connecté
    if (this.authService.userLoggedIn()) {
      this.MessageService.getNotifications(true).subscribe();
    }
  }
  private subscribeToCurrentUser(): void {
    // S'abonner aux changements d'image de profil via AuthUserService
    const authProfileSub = this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe((user) => {
        this.currentUser = user;
        this.updateProfileDisplay(user);
      });

    // S'abonner aux changements d'image de profil via DataService
    const dataProfileSub = this.dataService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe((user) => {
        if (user) {
          this.currentUser = user;
          this.updateProfileDisplay(user);
        }
      });

    this.subscriptions.push(authProfileSub, dataProfileSub);
  }

  private updateProfileDisplay(user: any): void {
    if (user) {
      this.username = user.fullName || user.username || '';

      // Vérification plus robuste pour l'image de profil
      let imageFound = false;

      // Vérifier profileImage en premier
      if (
        user.profileImage &&
        user.profileImage !== 'null' &&
        user.profileImage.trim() !== '' &&
        user.profileImage !== 'undefined'
      ) {
        this.imageProfile = user.profileImage;
        imageFound = true;
        console.log('Using profileImage:', this.imageProfile);
      }

      // Ensuite vérifier image si profileImage n'est pas valide
      if (
        !imageFound &&
        user.image &&
        user.image !== 'null' &&
        user.image.trim() !== '' &&
        user.image !== 'undefined'
      ) {
        this.imageProfile = user.image;
        imageFound = true;
        console.log('Using image:', this.imageProfile);
      }

      // Vérifier si l'image est une URL relative au backend
      if (
        imageFound &&
        !this.imageProfile.startsWith('http') &&
        !this.imageProfile.startsWith('assets/')
      ) {
        // Si c'est une URL relative au backend, ajouter le préfixe du backend
        if (this.imageProfile.startsWith('/')) {
          this.imageProfile = `${environment.urlBackend.replace(/\/$/, '')}${
            this.imageProfile
          }`;
        } else {
          this.imageProfile = `${environment.urlBackend.replace(/\/$/, '')}/${
            this.imageProfile
          }`;
        }
        console.log('Converted to absolute URL:', this.imageProfile);
      }

      // Si aucune image valide n'est trouvée, utiliser l'image par défaut
      if (!imageFound) {
        this.imageProfile = 'assets/images/default-profile.png';
        console.log('Using default image');
      }

      console.log('Front layout - Image profile updated:', this.imageProfile);
    }
  }
  private subscribeToQueryParams(): void {
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe((params) => {
        this.messageFromRedirect = params['message'] || '';
      });
  }
  private subscribeToRouterEvents(): void {
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.sidebarOpen = false;
        this.profileMenuOpen = false;
      });
  }
  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }
  toggleProfileMenu(): void {
    this.profileMenuOpen = !this.profileMenuOpen;
  }

  toggleDarkMode(): void {
    this.themeService.toggleDarkMode();
  }

  logout(): void {
    this.authService.logout().subscribe({
      next: () => {
        this.profileMenuOpen = false;
        this.sidebarOpen = false;
        this.currentUser = null;
        // Reset image to default
        this.imageProfile = 'assets/images/default-profile.png';
        // Clear data in both services
        this.dataService.updateCurrentUser({});
        this.router.navigate(['/login']);
      },
      error: (err) => {
        console.error('Logout error:', err);
        this.authService.clearAuthData();
        this.currentUser = null;
        // Reset image to default
        this.imageProfile = 'assets/images/default-profile.png';
        // Clear data in both services
        this.dataService.updateCurrentUser({});
        this.router.navigate(['/login']);
      },
    });
  }
  ngOnDestroy(): void {
    // Désabonner de tous les observables pour éviter les fuites de mémoire
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    this.destroy$.next();
    this.destroy$.complete();
  }
}
