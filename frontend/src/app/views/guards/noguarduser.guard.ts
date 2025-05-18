import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthuserService } from 'src/app/services/authuser.service';

export const noguarduserGuard: CanActivateFn = (route, state) => {
   const authService=inject(AuthuserService)
     const router= inject(Router)
     if(authService.userLoggedIn()==false){
     return true;
   }else 
   {
     router.navigate(['/users']);
     return false;
   }
  
};
