import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { AllusersRoutingModule } from './allusers-routing.module';
import { AllusersComponent } from './allusers.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';


@NgModule({
  declarations: [
    AllusersComponent
  ],
  imports: [
    CommonModule,
    AllusersRoutingModule,
    FormsModule,
    ReactiveFormsModule
  ]
})
export class AllusersModule { }
