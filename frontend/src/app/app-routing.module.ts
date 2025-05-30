import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { FrontLayoutComponent } from './layouts/front-layout/front-layout.component';
import { AdminLayoutComponent } from './layouts/admin-layout/admin-layout.component';
import { AuthAdminLayoutComponent } from './layouts/auth-admin-layout/auth-admin-layout.component';
import { guardadminGuard } from './views/guards/guardadmin.guard';
import { guarduserGuard } from './views/guards/guarduser.guard';
import { noguarduserGuard } from './views/guards/noguarduser.guard';
const routes: Routes = [
  // Espace Front
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
        path: 'profile',
        loadChildren: () =>
          import('./views/front/profile/profile.module').then(
            (m) => m.ProfileModule
          ),
        canActivateChild: [guarduserGuard],
      },
      {
        path: 'messages',
        loadChildren: () =>
          import('./views/front/messages/messages.module').then(
            (m) => m.MessagesModule
          ),
        canActivateChild: [guarduserGuard],
      },
      {
        path: 'plannings',
        loadChildren: () =>
          import('./views/front/plannings/plannings.module').then(
            (m) => m.PlanningsModule
          ),
        canActivateChild: [guarduserGuard],
      },
      {
        path: 'reunions',
        loadChildren: () =>
          import('./views/front/reunions/reunions.module').then(
            (m) => m.ReunionsModule
          ),
        canActivateChild: [guarduserGuard],
      },
      {
        path: 'notifications',
        loadChildren: () =>
          import('./views/front/notifications/notifications.module').then(
            (m) => m.NotificationsModule
          ),
        canActivateChild: [guarduserGuard],
      },
      {
        path: 'change-password',
        loadChildren: () =>
          import('./views/front/change-password/change-password.module').then(
            (m) => m.ChangePasswordModule
          ),
        canActivateChild: [guarduserGuard],
      },
      {
        path: 'signup',
        loadChildren: () =>
          import('./views/front/signup/signup.module').then(
            (m) => m.SignupModule
          ),
        canActivateChild: [noguarduserGuard],
      },
      {
        path: 'login',
        loadChildren: () =>
          import('./views/front/login/login.module').then((m) => m.LoginModule),
        canActivateChild: [noguarduserGuard],
      },
      {
        path: 'verify-email',
        loadChildren: () =>
          import('./views/front/verify-email/verify-email.module').then(
            (m) => m.VerifyEmailModule
          ),
      },
      {
        path: 'reset-password',
        loadChildren: () =>
          import('./views/front/reset-password/reset-password.module').then(
            (m) => m.ResetPasswordModule
          ),
        canActivateChild: [guarduserGuard],
      },
      {
        path: 'forgot-password',
        loadChildren: () =>
          import('./views/front/forgot-password/forgot-password.module').then(
            (m) => m.ForgotPasswordModule
          ),
      },
      {
        path: 'projects',
        loadChildren: () =>
          import('./views/front/projects/projects.module').then(
            (m) => m.ProjectsModule
          ),
        canActivateChild: [guarduserGuard], // Protection pour utilisateurs authentifiés
      },
      {
        path: 'equipes',
        loadChildren: () =>
          import('./views/front/equipes/equipes.module').then(
            (m) => m.EquipesModule
          ),
        canActivateChild: [guarduserGuard], // Protection pour utilisateurs authentifiés
      },
    ],
  },
  //  Espace Admin
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
        path: 'userdetails/:id',
        loadChildren: () =>
          import('./views/admin/userdetails/userdetails.module').then(
            (m) => m.UserdetailsModule
          ),
      },
      {
        path: 'plannings',
        loadChildren: () =>
          import('./views/admin/plannings/plannings.module').then(
            (m) => m.PlanningsModule
          ),
      },
      {
        path: 'reunions',
        loadChildren: () =>
          import('./views/admin/reunions/reunions.module').then(
            (m) => m.ReunionsModule
          ),
      },
      {
        path: 'projects',
        loadChildren: () =>
          import('./views/admin/projects/projects.module').then(
            (m) => m.ProjectsModule
          ),
        canActivateChild: [guarduserGuard],
      },
      {
        path: 'profile',
        loadChildren: () =>
          import('./views/admin/profile/profile.module').then(
            (m) => m.ProfileModule
          ),
      },
      {
        path: 'equipes',
        loadChildren: () =>
          import('./views/admin/equipes/equipes.module').then(
            (m) => m.EquipesModule
          ),
      },
    ],
  },
  //  Espace Auth-admin
  { path: 'admin/login', component: AuthAdminLayoutComponent },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
