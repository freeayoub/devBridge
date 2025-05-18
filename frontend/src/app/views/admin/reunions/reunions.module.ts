import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ReunionsRoutingModule } from './reunions-routing.module';
import { ReunionsComponent } from './reunions.component';


@NgModule({
  declarations: [
    ReunionsComponent
  ],
  imports: [
    CommonModule,
    ReunionsRoutingModule
  ]
})
export class ReunionsModule { }
