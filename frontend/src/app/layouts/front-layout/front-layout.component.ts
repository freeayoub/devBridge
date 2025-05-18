import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { ActivatedRoute, Router, NavigationEnd } from '@angular/router';
import { Subject } from 'rxjs';
import { filter, takeUntil, distinctUntilChanged } from 'rxjs/operators';
import { AuthuserService } from 'src/app/services/authuser.service';
import { UserStatusService } from 'src/app/services/user-status.service';
import { MessageService } from 'src/app/services/message.service';
import { User } from 'src/app/models/user.model';
@Component({
  selector: 'app-front-layout',
  templateUrl: './front-layout.component.html',
  styleUrls: ['./front-layout.component.css']
})
export class FrontLayoutComponent implements OnInit, OnDestroy {

  sidebarOpen = false;
  profileMenuOpen = false;
  currentUser: User | null = null;
  messageFromRedirect: string = '';
  unreadNotificationsCount = 0;
  isMobileView = false;

  private destroy$ = new Subject<void>();
  private readonly MOBILE_BREAKPOINT = 768;

  constructor(
    public authService: AuthuserService,
    private route: ActivatedRoute,
    private router: Router,
    public statusService: UserStatusService,
    private MessageService: MessageService,
  ) {
    this.checkViewport();
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
    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe((user) => {
        this.currentUser = user;
      });
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
  
  logout(): void {
    this.authService.logout().subscribe({
      next: () => {
        this.profileMenuOpen = false;
        this.sidebarOpen = false;
        this.currentUser = null;
        this.router.navigate(['/login']);
      },
      error: (err) => {
        console.error('Logout error:', err);
        this.authService.clearAuthData();
        this.currentUser = null;
        this.router.navigate(['/login']);
      },
    });
  }
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}


