import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ReunionsRoutingModule } from './reunions-routing.module';
import { ReunionListComponent } from './reunion-list/reunion-list.component';
import { ReunionDetailComponent } from './reunion-detail/reunion-detail.component';
import { ReunionFormComponent } from './reunion-form/reunion-form.component';
import { ReunionSchedulerComponent } from './reunion-scheduler/reunion-scheduler.component';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ReunionEditComponent } from './reunion-edit/reunion-edit.component';
import { PipesModule } from '../../../pipes/pipes.module';

@NgModule({
  declarations: [
    ReunionListComponent,
    ReunionDetailComponent,
    ReunionFormComponent,
    ReunionSchedulerComponent,
    ReunionEditComponent,
  ],
  imports: [
    CommonModule,
    ReunionsRoutingModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    PipesModule,
  ],
})
export class ReunionsModule {}
