import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { MessagesRoutingModule } from './messages-routing.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ApolloModule } from 'apollo-angular';
import { MessageChatComponent } from './message-chat/message-chat.component';
import { MessagesListComponent } from './messages-list/messages-list.component';
import { UserListComponent } from './user-list/user-list.component';
import { MessageLayoutComponent } from './message-layout/message-layout.component';
import { CallInterfaceComponent } from './call-interface/call-interface.component';

import { UserStatusService } from 'src/app/services/user-status.service';
import { MessageService } from 'src/app/services/message.service';
import { VoiceMessageModule } from 'src/app/components/voice-message/voice-message.module';

@NgModule({
  declarations: [
    MessageChatComponent,
    MessagesListComponent,
    UserListComponent,
    MessageLayoutComponent,
    CallInterfaceComponent,
  ],
  imports: [
    CommonModule,
    MessagesRoutingModule,
    FormsModule,
    ReactiveFormsModule,
    ApolloModule,
    RouterModule,
    VoiceMessageModule,
  ],
  providers: [UserStatusService, MessageService],
})
export class MessagesModule {}
