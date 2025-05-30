import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PlanningListComponent } from './planning-list/planning-list.component';
import { PlanningDetailComponent } from './planning-detail/planning-detail.component';
import { PlanningFormComponent } from './planning-form/planning-form.component';
import {PlanningEditComponent} from "@app/views/front/plannings/planning-edit/planning-edit.component";

const routes: Routes = [
  {
    path: '', component: PlanningListComponent
  },
  {
    path: 'nouveau', component: PlanningFormComponent
  },
  {
    path: 'edit/:id', component: PlanningEditComponent
  },
  {
    path: ':id', component: PlanningDetailComponent  // <-- put this last
  }
];




@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class PlanningsRoutingModule { }