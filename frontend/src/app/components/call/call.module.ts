import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IncomingCallModule } from '../incoming-call/incoming-call.module';
import { ActiveCallModule } from '../active-call/active-call.module';

@NgModule({
  imports: [
    CommonModule,
    IncomingCallModule,
    ActiveCallModule
  ],
  exports: [
    IncomingCallModule,
    ActiveCallModule
  ]
})
export class CallModule { }
