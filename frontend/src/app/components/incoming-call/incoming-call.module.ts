import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IncomingCallComponent } from './incoming-call.component';

@NgModule({
  declarations: [
    IncomingCallComponent
  ],
  imports: [
    CommonModule
  ],
  exports: [
    IncomingCallComponent
  ]
})
export class IncomingCallModule { }
