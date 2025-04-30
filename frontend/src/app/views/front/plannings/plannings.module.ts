import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { PlanningsRoutingModule } from './plannings-routing.module';
import { PlanningListComponent } from './planning-list/planning-list.component';
import { PlanningDetailComponent } from './planning-detail/planning-detail.component';
import { PlanningFormComponent } from './planning-form/planning-form.component';
import { PlanningCalendarComponent } from './planning-calendar/planning-calendar.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

@NgModule({
  declarations: [
    PlanningListComponent,
    PlanningDetailComponent,
    PlanningFormComponent,
    PlanningCalendarComponent,
  ],
  imports: [
    CommonModule,
    PlanningsRoutingModule,
    FormsModule,
    ReactiveFormsModule,
  ],
})
export class PlanningsModule {}
