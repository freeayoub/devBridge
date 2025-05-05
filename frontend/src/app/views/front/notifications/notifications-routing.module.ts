import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { NotificationLayoutComponent } from './notification-layout/notification-layout.component';
import { NotificationListComponent } from './notification-list/notification-list.component';

const routes: Routes = [
  {
    path:'',component:NotificationLayoutComponent,
    children: [
      { 
        path: '', 
        component: NotificationListComponent, data: { title: 'Notifications' }
      }
    ]
  }

];
@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class NotificationsRoutingModule { }
