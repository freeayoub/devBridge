import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthuserService } from 'src/app/services/authuser.service';
import { DataService } from 'src/app/services/data.service';
import { Subject, takeUntil } from 'rxjs';

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
  private destroy$ = new Subject<void>();

  constructor(
    public authService: AuthuserService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.subscribeToQueryParams();
    this.subscribeToCurrentUser();
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
      },
      error: (err) => {
        console.error('Logout error:', err);
        // Force logout même en cas d'erreur
        this.authService.clearAuthData();
        this.currentUser = null;
      }
    });
  }
}
