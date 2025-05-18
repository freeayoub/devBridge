import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { PlanningsRoutingModule } from './plannings-routing.module';
import { PlanningsComponent } from './plannings.component';


@NgModule({
  declarations: [
    PlanningsComponent
  ],
  imports: [
    CommonModule,
    PlanningsRoutingModule
  ]
})
export class PlanningsModule { }
