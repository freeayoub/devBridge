import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { NotificationsRoutingModule } from './notifications-routing.module';
import { NotificationsComponent } from './notifications.component';
import { RouterModule } from '@angular/router';
import { NotificationLayoutComponent } from './notification-layout/notification-layout.component';
import { NotificationListComponent } from './notification-list/notification-list.component';
import { NotificationService } from '@app/services/notification.service';
import { GraphqlDataService } from '@app/services/graphql-data.service';


@NgModule({
  declarations: [
    NotificationsComponent,
    NotificationLayoutComponent,
    NotificationListComponent
  ],
  imports: [
    CommonModule,
    NotificationsRoutingModule,
    RouterModule,
  ],
    providers: [NotificationService,GraphqlDataService]
  
})
export class NotificationsModule { }
