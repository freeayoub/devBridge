import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from '../auth/auth.guard';
import { RoleGuard } from '../auth/role.guard';

import { ProjectListComponent } from './project-list/project-list.component';
import { ProjectDetailComponent } from './project-detail/project-detail.component';
import { ProjectFormComponent } from './project-form/project-form.component';
import { TaskFormComponent } from './task-form/task-form.component';
import { TaskDetailComponent } from './task-detail/task-detail.component';
import { SubmissionFormComponent } from './submission-form/submission-form.component';
import { SubmissionDetailComponent } from './submission-detail/submission-detail.component';

const routes: Routes = [
  {
    path: '',
    component: ProjectListComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'new',
    component: ProjectFormComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { expectedRole: 'teacher' }
  },
  {
    path: 'submissions/:submissionId',
    component: SubmissionDetailComponent,
    canActivate: [AuthGuard]
  },
  {
    path: ':id',
    component: ProjectDetailComponent,
    canActivate: [AuthGuard]
  },
  {
    path: ':id/edit',
    component: ProjectFormComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { expectedRole: 'teacher' }
  },
  {
    path: ':projectId/tasks/new',
    component: TaskFormComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { expectedRole: 'teacher' }
  },
  {
    path: ':projectId/tasks/:taskId',
    component: TaskDetailComponent,
    canActivate: [AuthGuard]
  },
  {
    path: ':projectId/tasks/:taskId/edit',
    component: TaskFormComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { expectedRole: 'teacher' }
  },
  {
    path: ':projectId/tasks/:taskId/submit',
    component: SubmissionFormComponent,
    canActivate: [AuthGuard]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ProjectsRoutingModule { }
