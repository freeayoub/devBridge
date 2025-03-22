import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { UserdetailsRoutingModule } from './userdetails-routing.module';
import { UserdetailsComponent } from './userdetails.component';


@NgModule({
  declarations: [
    UserdetailsComponent
  ],
  imports: [
    CommonModule,
    UserdetailsRoutingModule
  ]
})
export class UserdetailsModule { }
