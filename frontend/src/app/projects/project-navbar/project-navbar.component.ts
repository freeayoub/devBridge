import { Component, OnInit } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../auth/auth.service';

@Component({
  selector: 'app-project-navbar',
  templateUrl: './project-navbar.component.html',
  styleUrls: ['./project-navbar.component.scss']
})
export class ProjectNavbarComponent implements OnInit {
  currentRoute: string = '';
  currentUser: any = null;
  
  constructor(
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadUserData();
    
    // Track current route for active link highlighting
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.currentRoute = event.url;
    });
    
    // Initialize with current route
    this.currentRoute = this.router.url;
  }

  loadUserData(): void {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      this.currentUser = JSON.parse(userStr);
    }
  }

  canCreateProject(): boolean {
    return this.currentUser && 
           (this.currentUser.role === 'teacher' || this.currentUser.role === 'admin');
  }

  isActive(route: string): boolean {
    if (route === '/projects' && this.currentRoute === '/projects') {
      return true;
    }
    return this.currentRoute.startsWith(route);
  }
}
