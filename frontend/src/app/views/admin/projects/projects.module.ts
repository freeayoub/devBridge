import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { ProjectsRoutingModule } from './projects-routing.module';
import { ListProjectComponent } from './list-project/list-project.component';
import { AddProjectComponent } from './add-project/add-project.component';
import { UpdateProjectComponent } from './update-project/update-project.component';
import { DetailProjectComponent } from './detail-project/detail-project.component';
import { ListRendusComponent } from './list-rendus/list-rendus.component';
import { ProjectEvaluationComponent } from './project-evaluation/project-evaluation.component';
import { EvaluationDetailsComponent } from './evaluation-details/evaluation-details.component';
import { EvaluationsListComponent } from './evaluations-list/evaluations-list.component';
import { EditEvaluationComponent } from './edit-evaluation/edit-evaluation.component';
import { MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { RouterModule } from '@angular/router';

@NgModule({
  declarations: [
    ListProjectComponent,
    AddProjectComponent,
    UpdateProjectComponent,
    DetailProjectComponent,
    ListRendusComponent,
    ProjectEvaluationComponent,
    EvaluationDetailsComponent,
    EvaluationsListComponent,
    EditEvaluationComponent,
  ],
  imports: [
    CommonModule,
    ProjectsRoutingModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    MatDialogModule,
    MatButtonModule,
  ],
})
export class ProjectsModule {}
