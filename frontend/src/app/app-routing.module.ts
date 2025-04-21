import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { FrontLayoutComponent } from './layouts/front-layout/front-layout.component';
import { AdminLayoutComponent } from './layouts/admin-layout/admin-layout.component';
import { AuthAdminLayoutComponent } from './layouts/auth-admin-layout/auth-admin-layout.component';
import { guardadminGuard } from './views/guards/guardadmin.guard';
import { guarduserGuard } from './views/guards/guarduser.guard';
import { noguarduserGuard } from './views/guards/noguarduser.guard';

const routes: Routes = [
  {
    path: '',
    component: FrontLayoutComponent,
    children: [
      {
        path: '',
        loadChildren: () =>
          import('./views/front/home/home.module').then((m) => m.HomeModule),
      },
      {
        path: 'loginuser',
        loadChildren: () =>
          import('./views/front/loginuser/loginuser.module').then(
            (m) => m.LoginuserModule
          ),
        canActivateChild: [noguarduserGuard],
      },
      {
        path: 'registeruser',
        loadChildren: () =>
          import('./views/front/register/register.module').then(
            (m) => m.RegisterModule
          ),
      },
      {
        path: 'profile',
        loadChildren: () =>
          import('./views/front/profile/profile.module').then((m) => m.ProfileModule),
        canActivateChild: [guarduserGuard],
      },
      {
        path: 'messages',
        loadChildren: () =>
          import('./views/front/messages/messages.module').then(
            (m) => m.MessagesModule),
        canActivateChild: [guarduserGuard],
      },

    ],
  },

  {
    path: 'admin',
    component: AdminLayoutComponent,
    canActivate: [guardadminGuard],
    children: [
      {
        path: '',
        loadChildren: () =>
          import('./views/admin/dashboard/dashboard.module').then(
            (m) => m.DashboardModule
          ),
      },
      {
        path: 'dashboard',
        loadChildren: () =>
          import('./views/admin/dashboard/dashboard.module').then(
            (m) => m.DashboardModule
          ),
      },
      {
        path: 'allusers',
        loadChildren: () =>
          import('./views/admin/allusers/allusers.module').then(
            (m) => m.AllusersModule
          ),
      },
      {
        path: 'adduser',
        loadChildren: () =>
          import('./views/admin/adduser/adduser.module').then(
            (m) => m.AdduserModule
          ),
      },
      {
        path: 'userdetails/:id',
        loadChildren: () =>
          import('./views/admin/userdetails/userdetails.module').then(
            (m) => m.UserdetailsModule
          ),
      },
    ],
  },
  { path: 'admin/login', component: AuthAdminLayoutComponent },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
