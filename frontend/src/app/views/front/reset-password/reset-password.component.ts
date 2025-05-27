import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../../../services/auth.service';
import { Router, ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-reset-password',
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.css'],
})
export class ResetPasswordComponent implements OnInit {
  resetForm: FormGroup;
  message = '';
  error = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.resetForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      code: ['', [Validators.required, Validators.minLength(6)]],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
    });
  }

  ngOnInit() {
    // Check if email is provided in query parameters
    this.route.queryParams.subscribe(params => {
      if (params['email']) {
        this.resetForm.patchValue({
          email: params['email']
        });
      }
    });
  }

  onSubmit() {
    if (this.resetForm.invalid) return;

    this.authService.resetPassword(this.resetForm.value).subscribe({
      next: (res: any) => {
        this.message = res.message + ' Redirecting to login...';
        this.error = '';
        setTimeout(() => this.router.navigate(['/login']), 1500);
      },
      error: (err) => {
        this.error = err.error.message || 'Reset failed';
        this.message = '';
      },
    });
  }
}
