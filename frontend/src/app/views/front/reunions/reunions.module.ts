import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ReunionsRoutingModule } from './reunions-routing.module';
import { ReunionListComponent } from './reunion-list/reunion-list.component';
import { ReunionDetailComponent } from './reunion-detail/reunion-detail.component';
import { ReunionFormComponent } from './reunion-form/reunion-form.component';
import { ReunionSchedulerComponent } from './reunion-scheduler/reunion-scheduler.component';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

@NgModule({
  declarations: [
    ReunionListComponent,
    ReunionDetailComponent,
    ReunionFormComponent,
    ReunionSchedulerComponent,
  ],
  imports: [
    CommonModule,
    ReunionsRoutingModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule
    
    
    ],
})
export class ReunionsModule {}
