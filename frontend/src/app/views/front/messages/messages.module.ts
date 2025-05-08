import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { MessagesRoutingModule } from './messages-routing.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ApolloModule } from 'apollo-angular';
import { MessageChatComponent } from './message-chat/message-chat.component';
import { MessagesListComponent } from './messages-list/messages-list.component';
import { UserListComponent } from './user-list/user-list.component';
import { MessageUserProfileComponent } from './message-user-profile/message-user-profile.component';
import { MessageLayoutComponent } from './message-layout/message-layout.component';
import { MessagesSidebarComponent } from './messages-sidebar/messages-sidebar.component';
import { UserStatusService } from '@app/services/user-status.service';
import { MessageService } from '@app/services/message.service';

@NgModule({
  declarations: [
    MessageChatComponent,
    MessagesListComponent,
    UserListComponent,
    MessageUserProfileComponent,
    MessageLayoutComponent,
    MessagesSidebarComponent,
  ],
  imports: [
    CommonModule,
    MessagesRoutingModule,
    FormsModule,

    ReactiveFormsModule,
    ApolloModule,
    RouterModule,
  ],
  providers: [UserStatusService,MessageService],
})
export class MessagesModule {}
