import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { VerifyEmailRoutingModule } from './verify-email-routing.module';
import { VerifyEmailComponent } from './verify-email.component';

@NgModule({
  declarations: [VerifyEmailComponent],
  imports: [CommonModule, ReactiveFormsModule, VerifyEmailRoutingModule],
})
export class VerifyEmailModule {}
