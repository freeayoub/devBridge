import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ProjectListComponent } from './project-list/project-list.component';
import { ProjectDetailComponent } from './project-detail/project-detail.component';
import { ProjectSubmissionComponent } from './project-submission/project-submission.component';

const routes: Routes = [
  { path: '', component: ProjectListComponent },
  { path: 'detail/:id', component: ProjectDetailComponent },
  { path: 'submit/:id', component: ProjectSubmissionComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ProjectsRoutingModule { }
