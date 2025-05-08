import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationsRoutingModule } from './notifications-routing.module';
import { RouterModule } from '@angular/router';
import { NotificationListComponent } from './notification-list/notification-list.component';
import { MessageService } from '@app/services/message.service';

@NgModule({
  declarations: [NotificationListComponent],
  imports: [CommonModule, NotificationsRoutingModule, RouterModule],
  providers: [MessageService],
})
export class NotificationsModule {}
