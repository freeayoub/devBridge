import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PlanningListComponent } from './planning-list/planning-list.component';
import { PlanningDetailComponent } from './planning-detail/planning-detail.component';
import { PlanningFormComponent } from './planning-form/planning-form.component';
import { PlanningCalendarComponent } from './planning-calendar/planning-calendar.component';

const routes: Routes = [

  {
    path:'',component:PlanningListComponent
  },
  {
     path: 'detailsPlanning', component: PlanningDetailComponent
     },
  {
    path:'planningForm',component:PlanningFormComponent
  },
  {
    path: 'calandarPlanning',
    component:PlanningCalendarComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class PlanningsRoutingModule { }
