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
  message = '';
  error = '';
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
  }

  onSignupSubmit() {
    if (this.signupForm.invalid) return;

    const signupData = this.signupForm.value;
    this.submittedEmail = signupData.email;

    this.authService.signup(signupData).subscribe({
      next: (res: any) => {
        console.log('Signup successful:', res);
        this.message = res.message;
        this.error = '';

        // Attendre un court instant avant de rediriger
        setTimeout(() => {
          // Rediriger vers le composant de vérification d'email
          this.router.navigate(['/verify-email'], {
            queryParams: { email: this.submittedEmail },
          });
        }, 500);
      },
      error: (err) => {
        console.error('Signup error:', err);

        // Si l'utilisateur existe déjà mais que nous avons besoin de vérifier l'email
        if (
          err.error &&
          err.error.message === 'Email already exists' &&
          err.error.needsVerification
        ) {
          // Rediriger vers la vérification d'email
          this.router.navigate(['/verify-email'], {
            queryParams: { email: this.submittedEmail },
          });
          return;
        }

        // Gérer les autres erreurs
        this.error = err.error?.message || 'Signup failed';
        this.message = '';
      },
    });
  }
}
