import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConnectionStatusComponent } from './connection-status.component';

@NgModule({
  declarations: [
    ConnectionStatusComponent
  ],
  imports: [
    CommonModule
  ],
  exports: [
    ConnectionStatusComponent
  ]
})
export class ConnectionStatusModule { }
