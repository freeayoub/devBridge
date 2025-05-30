import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ReunionsRoutingModule } from './reunions-routing.module';
import { ReunionListComponent } from './reunion-list/reunion-list.component';
import { ReunionDetailComponent } from './reunion-detail/reunion-detail.component';
import { ReunionFormComponent } from './reunion-form/reunion-form.component';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { PipesModule } from '../../../pipes/pipes.module';
import { ReunionEditComponent } from './reunion-edit/reunion-edit.component';

@NgModule({
  declarations: [
    ReunionListComponent,
    ReunionDetailComponent,
    ReunionFormComponent,
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
