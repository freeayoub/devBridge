import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../../../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styles: [
    `
      @keyframes shake {
        0%,
        100% {
          transform: translateX(0);
        }
        10%,
        30%,
        50%,
        70%,
        90% {
          transform: translateX(-5px);
        }
        20%,
        40%,
        60%,
        80% {
          transform: translateX(5px);
        }
      }
      .shake-animation {
        animation: shake 0.6s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
      }
    `,
  ],
})
export class LoginComponent {
  loginForm: FormGroup;
  message = '';
  error = '';
  isLoading = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
    });
  }

  onSubmit() {
    if (this.loginForm.invalid) return;

    // Reset previous error messages
    this.error = '';
    this.message = '';
    this.isLoading = true;

    this.authService.login(this.loginForm.value).subscribe({
      next: (res: any) => {
        this.isLoading = false;
        localStorage.setItem('token', res.token);
        localStorage.setItem('user', JSON.stringify(res.user));
        this.router.navigate(['/']);
      },
      error: (err) => {
        this.isLoading = false;
        // Handle authentication errors
        if (err.status === 401) {
          this.error = 'Email ou mot de passe incorrect. Veuillez réessayer.';
        } else if (err.status === 403) {
          this.error =
            "Votre compte n'est pas vérifié. Veuillez vérifier votre email.";
        } else {
          this.error =
            err.error?.message ||
            'Une erreur est survenue lors de la connexion. Veuillez réessayer.';
        }
      },
    });
  }
}
