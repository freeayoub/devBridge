import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { MessagesRoutingModule } from './messages-routing.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ApolloModule } from 'apollo-angular';
import { MessageChatComponent } from './message-chat/message-chat.component';
import { MessagesListComponent } from './messages-list/messages-list.component';
import { UserListComponent } from './user-list/user-list.component';
import { MessageUserProfileComponent } from './message-user-profile/message-user-profile.component';
import { RouterModule } from '@angular/router';
import { MessageLayoutComponent } from './message-layout/message-layout.component';
import { GraphqlDataService } from '@app/services/graphql-data.service';
import { NotificationService } from '@app/services/notification.service';
import { UserStatusService } from '@app/services/user-status.service';

@NgModule({
  declarations: [
    MessageChatComponent,
    MessagesListComponent,
    UserListComponent,
    MessageUserProfileComponent,
    MessageLayoutComponent,
  ],
  imports: [
    CommonModule,
    MessagesRoutingModule,
    FormsModule,
    ReactiveFormsModule,
    ApolloModule,
    RouterModule,
  ],
  providers: [UserStatusService,GraphqlDataService,NotificationService],
})
export class MessagesModule {}
