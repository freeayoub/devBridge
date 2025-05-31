import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthuserService } from 'src/app/services/authuser.service';

export const profileCompletionGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthuserService);
  const router = inject(Router);

  // Check if user is logged in
  if (!authService.userLoggedIn()) {
    router.navigate(['/login']);
    return false;
  }

  const currentUser = authService.getCurrentUser();

  // If user is not found, redirect to login
  if (!currentUser) {
    router.navigate(['/login']);
    return false;
  }

  // If this is the profile completion page itself, allow access
  if (state.url === '/complete-profile') {
    return true;
  }

  // Only redirect for first-time logins or truly incomplete profiles
  const isFirstLogin = currentUser.isFirstLogin;

  // Check if profile has essential information (more lenient check)
  const hasEssentialInfo = currentUser.firstName &&
                          currentUser.lastName &&
                          currentUser.email;

  // Only redirect if it's first login OR missing essential information
  if (isFirstLogin || !hasEssentialInfo) {
    router.navigate(['/complete-profile']);
    return false;
  }

  // Allow access to other pages if profile is complete
  return true;
};
