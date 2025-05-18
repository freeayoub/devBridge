import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../../../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-signup',
  templateUrl: './signup.component.html',
  styleUrls: ['./signup.component.css'],
})
export class SignupComponent {
  signupForm: FormGroup;
  verifyForm: FormGroup;
  roles = ['student', 'teacher', 'admin'];

  message = '';
  error = '';
  awaitingVerification = false;
  submittedEmail = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.signupForm = this.fb.group({
      fullName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
    });

    this.verifyForm = this.fb.group({
      code: [
        '',
        [Validators.required, Validators.minLength(6), Validators.maxLength(6)],
      ],
    });
  }

  timer = 60;
  canResend = false;
  intervalId: any;

  startCountdown() {
    this.canResend = false;
    this.timer = 60;

    this.intervalId = setInterval(() => {
      this.timer--;
      if (this.timer === 0) {
        this.canResend = true;
        clearInterval(this.intervalId);
      }
    }, 1000);
  }

  onSignupSubmit() {
    if (this.signupForm.invalid) return;

    const signupData = this.signupForm.value;
    this.submittedEmail = signupData.email;

    this.authService.signup(signupData).subscribe({
      next: (res: any) => {
        this.message = res.message;
        this.error = '';
        this.awaitingVerification = true;
        this.startCountdown(); // ⬅️ START TIMER HERE
      },
      error: (err) => {
        this.error = err.error.message || 'Signup failed';
        this.message = '';
      },
    });
  }

  onVerifySubmit() {
    if (this.verifyForm.invalid) return;

    const verifyData = {
      email: this.submittedEmail,
      code: this.verifyForm.value.code,
    };

    this.authService.verifyEmail(verifyData).subscribe({
      next: (res: any) => {
        this.message = res.message + ' Redirecting to login...';
        this.error = '';

        // Reset forms and state
        this.awaitingVerification = false;
        this.signupForm.reset();
        this.verifyForm.reset();

        // Redirect after 1.5 seconds (optional delay)
        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 1500);
      },
      error: (err) => {
        this.error = err.error.message || 'Verification failed';
        this.message = '';
      },
    });
  }
  resendCode() {
    if (!this.canResend) return;

    this.authService.resendCode(this.submittedEmail).subscribe({
      next: (res: any) => {
        this.message = res.message || 'Code renvoyé avec succès.';
        this.error = '';
        this.startCountdown(); // ⬅️ START TIMER AGAIN
      },
      error: (err) => {
        this.error = err.error.message || "Erreur lors de l'envoi du code.";
        this.message = '';
      },
    });
  }
}
