import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { UserdetailsRoutingModule } from './userdetails-routing.module';
import { UserdetailsComponent } from './userdetails.component';
import { FormsModule } from '@angular/forms';


@NgModule({
  declarations: [
    UserdetailsComponent
  ],
  imports: [
    CommonModule,
    UserdetailsRoutingModule,
    FormsModule
  ]
})
export class UserdetailsModule { }
