import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthadminService } from 'src/app/services/authadmin.service';

export const guardadminGuard: CanActivateFn = (route, state) => {
  const authService=inject(AuthadminService)
  const router= inject(Router)
  if(authService.loggedIn()==true){
  return true;
}else 
{

  router.navigate(['/admin/login'],{queryParams:{returnUrl:state.url}});
  localStorage.removeItem('token')
  return false;
}
};
