import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-change-password',
  templateUrl: './change-password.component.html'
})
export class ChangePasswordComponent {
  form: FormGroup;
  message = '';
  error = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.form = this.fb.group({
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  onSubmit() {
    if (this.form.invalid) return;

    const token = localStorage.getItem('token');
    this.authService.changePassword(this.form.value, token!).subscribe({
      next: (res: any) => {
        this.message = res.message;
        this.error = '';
        this.form.reset();
        setTimeout(() => this.router.navigate(['/auth/profile']), 1500);
      },
      error: (err) => {
        this.error = err.error.message || 'Failed to change password';
        this.message = '';
      }
    });
  }
}
