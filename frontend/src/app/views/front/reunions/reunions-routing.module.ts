import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ReunionListComponent } from './reunion-list/reunion-list.component';
import { ReunionFormComponent } from './reunion-form/reunion-form.component';
import { ReunionDetailComponent } from './reunion-detail/reunion-detail.component';
import { ReunionSchedulerComponent } from './reunion-scheduler/reunion-scheduler.component';
import {ReunionEditComponent} from "./reunion-edit/reunion-edit.component";

const routes: Routes = [

    { path: '', component: ReunionListComponent},
    { path: 'nouvelleReunion', component: ReunionFormComponent},
    { path: 'planifierReunion', component: ReunionSchedulerComponent },
    { path: 'reunionDetails/:id', component: ReunionDetailComponent },
    { path: 'modifier/:id', component: ReunionEditComponent }

  ];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ReunionsRoutingModule { }