import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ListProjectComponent } from './list-project/list-project.component';
import { AddProjectComponent } from './add-project/add-project.component';
import { DetailProjectComponent } from './detail-project/detail-project.component';
import { UpdateProjectComponent } from './update-project/update-project.component';

const routes: Routes = [
      { path: '', component:ListProjectComponent},
      { path: 'add', component: AddProjectComponent},
      { path: 'detail/id', component: DetailProjectComponent },
      { path: 'update/:id', component:UpdateProjectComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ProjectsRoutingModule { }
