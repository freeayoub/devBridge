import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';

import { ProjectsRoutingModule } from './projects-routing.module';
import { SharedModule } from '../shared/shared.module';

import { ProjectListComponent } from './project-list/project-list.component';
import { ProjectDetailComponent } from './project-detail/project-detail.component';
import { ProjectFormComponent } from './project-form/project-form.component';
import { TaskFormComponent } from './task-form/task-form.component';
import { TaskDetailComponent } from './task-detail/task-detail.component';
import { SubmissionFormComponent } from './submission-form/submission-form.component';
import { SubmissionDetailComponent } from './submission-detail/submission-detail.component';
import { ProjectNavbarComponent } from './project-navbar/project-navbar.component';
import { ProjectStatsComponent } from './project-stats/project-stats.component';
import { ProjectTimelineComponent } from './project-timeline/project-timeline.component';
import { ProjectKanbanComponent } from './project-kanban/project-kanban.component';

@NgModule({
  declarations: [
    ProjectListComponent,
    ProjectDetailComponent,
    ProjectFormComponent,
    TaskFormComponent,
    TaskDetailComponent,
    SubmissionFormComponent,
    SubmissionDetailComponent,
    ProjectNavbarComponent,
    ProjectStatsComponent,
    ProjectTimelineComponent,
    ProjectKanbanComponent
  ],
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    FormsModule,
    HttpClientModule,
    ProjectsRoutingModule,
    SharedModule
  ],
  exports: [
    ProjectListComponent,
    ProjectDetailComponent,
    ProjectFormComponent,
    TaskFormComponent,
    TaskDetailComponent,
    SubmissionFormComponent,
    SubmissionDetailComponent,
    ProjectNavbarComponent,
    ProjectStatsComponent,
    ProjectTimelineComponent,
    ProjectKanbanComponent
  ]
})
export class ProjectsModule { }
