import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { EquipesRoutingModule } from './equipes-routing.module';
import { EquipeListComponent } from './equipe-list/equipe-list.component';
import { EquipeFormComponent } from './equipe-form/equipe-form.component';
import { EquipeDetailComponent } from './equipe-detail/equipe-detail.component';
import { TaskListComponent } from './task-list/task-list.component';
import { AiChatComponent } from './ai-chat/ai-chat.component';
import { EquipeComponent } from './equipe/equipe.component';
import { NotificationComponent } from './notification/notification.component';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { EquipeLayoutComponent } from './equipe-layout/equipe-layout.component';

@NgModule({
  declarations: [
    EquipeListComponent,
    EquipeFormComponent,
    EquipeDetailComponent,
    TaskListComponent,
    AiChatComponent,
    EquipeComponent,
    NotificationComponent,
    EquipeLayoutComponent,
  ],
  imports: [
    CommonModule,
    EquipesRoutingModule,
    FormsModule,
    DragDropModule,
    HttpClientModule,
  ],
  providers: [],
})
export class EquipesModule {}
