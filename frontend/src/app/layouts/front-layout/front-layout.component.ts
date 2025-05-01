import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router , NavigationEnd  } from '@angular/router';
import { Subject, filter, takeUntil } from 'rxjs';
import { AuthuserService } from 'src/app/services/authuser.service';
import { UserStatusService } from 'src/app/services/user-status.service';
import { NotificationService } from 'src/app/services/notification.service';
@Component({
  selector: 'app-front-layout',
  templateUrl: './front-layout.component.html',
  styleUrls: ['./front-layout.component.css']
})
export class FrontLayoutComponent implements OnInit, OnDestroy {

  sidebarOpen = false;
  profileMenuOpen = false;
  currentUser: any;
  messageFromRedirect: string = '';
  unreadNotificationsCount = 0;
  private destroy$ = new Subject<void>();

  constructor(
    public authService: AuthuserService,
    private route: ActivatedRoute,
    private router: Router,
    public statusService: UserStatusService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.subscribeToQueryParams();
    this.subscribeToCurrentUser();
    this.subscribeToRouterEvents();
      
    if (this.authService.userLoggedIn()) {
      this.loadUnreadNotifications();
      this.subscribeToNewNotifications();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
  private subscribeToCurrentUser(): void {
    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        this.currentUser = user;
      });
  }
  private subscribeToQueryParams(): void {
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        this.messageFromRedirect = params['message'] || '';
      });
  }
  private subscribeToRouterEvents(): void {
    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.sidebarOpen = false;
        this.profileMenuOpen = false;
      });
  }
  private loadUnreadNotifications(): void {
    const userId = this.authService.getCurrentUserId();
    if (!userId) return;

    this.notificationService.getNotifications(userId).subscribe({
      next: (notifications) => {
        this.unreadNotificationsCount = notifications.filter((n:any) => !n.isRead).length;
      },
      error: (err) => console.error('Error loading notifications:', err)
    });
  }
  private subscribeToNewNotifications(): void {
    const userId = this.authService.getCurrentUserId();
    if (!userId) return;

    this.notificationService.subscribeToNotifications(userId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (notification) => {
          this.unreadNotificationsCount++;
        },
        error: (err) => console.error('Notification subscription error:', err)
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
        this.router.navigate(['/loginuser']);
      },
      error: (err) => {
        console.error('Logout error:', err);
        this.authService.clearAuthData();
        this.currentUser = null;
        this.router.navigate(['/loginuser']);
      }
    });
  }
}
