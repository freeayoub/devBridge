import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { MessageChatComponent } from './message-chat/message-chat.component';
import { MessagesListComponent } from './messages-list/messages-list.component';
import { UserListComponent } from './user-list/user-list.component';
import { MessageLayoutComponent } from './message-layout/message-layout.component';

const routes: Routes = [
  {
    path: '',
    component: MessageLayoutComponent,
    children: [
      { path: '', redirectTo: 'conversations', pathMatch: 'full' },
      {
        path: 'conversations',
        component: MessagesListComponent,
        data: { title: 'Conversations' },
      },
      {
        path: 'conversations/chat/:id',
        component: MessageChatComponent,
        data: { title: 'Chat' },
      },
      {
        path: 'chat/:id',
        component: MessageChatComponent,
        data: { title: 'Chat' },
      },
      {
        path: 'users',
        component: UserListComponent,
        data: { title: 'Utilisateurs' },
      },

      {
        path: 'new',
        redirectTo: 'users',
        pathMatch: 'full',
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class MessagesRoutingModule {}
