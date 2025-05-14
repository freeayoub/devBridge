import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class RoleGuard implements CanActivate {

  constructor(private router: Router, private authService: AuthService) {}

  canActivate(route: ActivatedRouteSnapshot): boolean {
    const token = localStorage.getItem('token');
    if (!token) {
      this.router.navigate(['/auth/login']);
      return false;
    }

    const expectedRole = route.data['expectedRole'];
    if (!expectedRole) {
      return true; // No role requirement specified
    }

    const userRole = this.authService.getUserRole();
    if (userRole === expectedRole) {
      return true;
    } else {
      // Redirect based on user role
      if (userRole === 'admin') {
        this.router.navigate(['/admin/dashboard']);
      } else {
        this.router.navigate(['/user/dashboard']);
      }
      return false;
    }
  }
}
