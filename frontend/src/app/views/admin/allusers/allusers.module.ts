import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { AllusersRoutingModule } from './allusers-routing.module';
import { AllusersComponent } from './allusers.component';


@NgModule({
  declarations: [
    AllusersComponent
  ],
  imports: [
    CommonModule,
    AllusersRoutingModule
  ]
})
export class AllusersModule { }
