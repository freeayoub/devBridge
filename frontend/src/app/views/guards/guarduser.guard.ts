import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthuserService } from 'src/app/services/authuser.service';

export const guarduserGuard: CanActivateFn = (route, state) => {
  const authService=inject(AuthuserService)
   const router= inject(Router)
   if(authService.userLoggedIn()==true){
   return true;
 }else 
 {
   router.navigate(['/loginuser'],{queryParams:{returnUrl:state.url}});
   localStorage.removeItem('token')
   return false;
 }

};
