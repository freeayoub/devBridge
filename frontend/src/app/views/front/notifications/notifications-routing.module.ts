import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { NotificationListComponent } from './notification-list/notification-list.component';
import { MessageLayoutComponent } from '../messages/message-layout/message-layout.component';

const routes: Routes = [
  {
    path: '',
    component: MessageLayoutComponent,
    data: { context: 'notifications' },
    children: [
      {
        path: '',
        component: NotificationListComponent,
        data: { title: 'Notifications' },
      },
    ],
  },
];
@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class NotificationsRoutingModule { }
