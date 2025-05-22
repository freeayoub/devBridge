import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ListProjectComponent } from './list-project/list-project.component';
import { AddProjectComponent } from './add-project/add-project.component';
import { UpdateProjectComponent } from './update-project/update-project.component';
import { DetailProjectComponent } from './detail-project/detail-project.component';
import { ListRendusComponent } from './list-rendus/list-rendus.component';
import { ProjectEvaluationComponent } from './project-evaluation/project-evaluation.component';
import { EvaluationDetailsComponent } from './evaluation-details/evaluation-details.component';
import { EvaluationsListComponent } from './evaluations-list/evaluations-list.component';
import { EditEvaluationComponent } from './edit-evaluation/edit-evaluation.component';

const routes: Routes = [
  { path: '', component: ListProjectComponent },
  { path: 'new', component: AddProjectComponent },
  { path: 'editProjet/:id', component: UpdateProjectComponent },
  { path: 'details/:id', component: DetailProjectComponent },
  { path: 'rendus', component: ListRendusComponent },
  { path: 'evaluate/:renduId', component: ProjectEvaluationComponent },
  { path: 'evaluation-details/:renduId', component: EvaluationDetailsComponent },
  { path: 'evaluations', component: EvaluationsListComponent },
  { path: 'edit-evaluation/:renduId', component: EditEvaluationComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ProjectsRoutingModule { }









