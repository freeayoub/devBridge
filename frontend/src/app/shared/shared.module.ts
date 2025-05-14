import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NavbarComponent } from './navbar/navbar.component';
import { ThemeService } from './theme.service';
import { ImageModalComponent } from './image-modal/image-modal.component';

@NgModule({
  declarations: [
    NavbarComponent,
    ImageModalComponent
  ],
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule
  ],
  exports: [
    NavbarComponent,
    ImageModalComponent,
    CommonModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule
  ],
  providers: [
    ThemeService
  ]
})
export class SharedModule { }
