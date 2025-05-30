import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HighlightPresencePipe } from './highlight-presence.pipe';

@NgModule({
  declarations: [
    HighlightPresencePipe
  ],
  imports: [
    CommonModule
  ],
  exports: [
    HighlightPresencePipe
  ]
})
export class PipesModule { }
