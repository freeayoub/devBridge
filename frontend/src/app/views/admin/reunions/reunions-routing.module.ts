import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ReunionsComponent } from './reunions.component';

const routes: Routes = [
  { path: '', component: ReunionsComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ReunionsRoutingModule { }
