import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PlanningsComponent } from './plannings.component';

const routes: Routes = [{ path: '', component: PlanningsComponent }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class PlanningsRoutingModule { }
