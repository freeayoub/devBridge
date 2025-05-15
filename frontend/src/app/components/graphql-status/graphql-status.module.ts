import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GraphqlStatusComponent } from './graphql-status.component';

@NgModule({
  declarations: [
    GraphqlStatusComponent
  ],
  imports: [
    CommonModule
  ],
  exports: [
    GraphqlStatusComponent
  ]
})
export class GraphqlStatusModule { }
