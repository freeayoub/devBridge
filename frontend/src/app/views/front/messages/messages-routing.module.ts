import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { MessageChatComponent } from './message-chat/message-chat.component';
import { MessagesListComponent } from './messages-list/messages-list.component';
import { UserListComponent } from './user-list/user-list.component';
import { MessageUserProfileComponent } from './message-user-profile/message-user-profile.component';

const routes: Routes = [
  {
    path: '',
    component: MessagesListComponent,
    children: [
      {
        path: 'new',
        component: UserListComponent,
      },
      {
        path: 'chat/:conversationId',
        component: MessageChatComponent,
        data: { fullPage: true },
      },
      { path: 'profile/:userId', component: MessageUserProfileComponent },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class MessagesRoutingModule {}
