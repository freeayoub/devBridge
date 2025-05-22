import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PlanningListComponent } from './planning-list/planning-list.component';
import { PlanningFormComponent } from './planning-form/planning-form.component';
import { PlanningCalendarComponent } from './planning-calendar/planning-calendar.component';
import { PlanningEditComponent } from './planning-edit/planning-edit.component';
import { PlanningDetailComponent } from './planning-detail/planning-detail.component';

const routes: Routes = [
  {
    path: '', component: PlanningListComponent
  },
  {
    path: 'nouveau', component: PlanningFormComponent
  },
  {
    path: 'calandarPlanning', component: PlanningCalendarComponent
  
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
