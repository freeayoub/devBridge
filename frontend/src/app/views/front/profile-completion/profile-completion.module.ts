import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';

import { ProfileCompletionComponent } from './profile-completion.component';

const routes: Routes = [
  {
    path: '',
    component: ProfileCompletionComponent
  }
];

@NgModule({
  declarations: [
    ProfileCompletionComponent
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule.forChild(routes)
  ]
})
export class ProfileCompletionModule { }
