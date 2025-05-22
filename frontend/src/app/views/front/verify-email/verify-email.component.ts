import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-verify-email',
  templateUrl: './verify-email.component.html',
  styleUrls: ['./verify-email.component.css'],
})
export class VerifyEmailComponent implements OnInit {
  verifyForm: FormGroup;
  loading = false;
  error: string | null = null;
  message: string | null = null;
  email: string = '';
  timer = 60;
  canResend = false;
  intervalId: any;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private fb: FormBuilder
  ) {
    this.verifyForm = this.fb.group({
      code: [
        '',
        [Validators.required, Validators.minLength(6), Validators.maxLength(6)],
      ],
    });
  }

  ngOnInit(): void {
    // Get email from URL query params
    this.email = this.route.snapshot.queryParamMap.get('email') || '';

    // Check if we have an email to verify
    if (!this.email) {
      this.error = 'No email address provided for verification.';
      return;
    }

    // Start the countdown for resend
    this.startCountdown();
  }

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

  onVerifySubmit() {
    if (this.verifyForm.invalid) return;

    this.loading = true;
    this.error = null;
    this.message = null;

    const verifyData = {
      email: this.email,
      code: this.verifyForm.value.code,
    };

    this.authService.verifyEmail(verifyData).subscribe({
      next: (res: any) => {
        this.loading = false;
        this.message =
          res.message + ' Redirection vers la page de connexion...';

        // Reset form
        this.verifyForm.reset();

        // Redirect after 1.5 seconds
        setTimeout(() => {
          this.router.navigate(['/login'], {
            queryParams: {
              message:
                'Votre compte a été vérifié avec succès. Vous pouvez maintenant vous connecter.',
            },
          });
        }, 1500);
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.message || 'Échec de la vérification';
      },
    });
  }

  resendCode() {
    if (!this.canResend) return;

    this.loading = true;
    this.error = null;
    this.message = null;

    this.authService.resendCode(this.email).subscribe({
      next: (res: any) => {
        this.loading = false;
        this.message = res.message || 'Code renvoyé avec succès.';
        this.startCountdown();
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.message || "Erreur lors de l'envoi du code.";
      },
    });
  }
}
