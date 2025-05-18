import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthadminService } from 'src/app/services/authadmin.service';
import { AuthuserService } from 'src/app/services/authuser.service';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from 'src/app/services/auth.service';
@Component({
  selector: 'app-auth-admin-layout',
  templateUrl: './auth-admin-layout.component.html',
  styleUrls: ['./auth-admin-layout.component.css'],
})
export class AuthAdminLayoutComponent implements OnInit, OnDestroy {
  messageAuthError: string = '';
  messageFromRedirect: string = '';
  private destroy$ = new Subject<void>();
  private returnUrl: string | undefined;

  constructor(
    private authAdminService: AuthadminService,
    public authUserService: AuthuserService,
    public authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.checkExistingAuth();
  }

  ngOnInit(): void {
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/admin/';
    this.subscribeToQueryParams();
  }
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
  private checkExistingAuth(): void {
    if (this.authUserService.userLoggedIn()) {
      this.router.navigate(['/'], {
        queryParams: {
          message:
            "Vous êtes déjà connecté en tant qu'utilisateur. Veuillez vous déconnecter d'abord.",
        },
      });
      return;
    }

    if (this.authAdminService.loggedIn()) {
      this.router.navigateByUrl('/admin');
    }
  }
  private subscribeToQueryParams(): void {
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe((params) => {
        this.messageFromRedirect = params['message'] || '';
        this.clearMessageAfterDelay();
      });
  }
  private clearMessageAfterDelay(): void {
    if (this.messageFromRedirect) {
      setTimeout(() => (this.messageFromRedirect = ''), 5000);
    }
  }
  loginAdmin(form: any): void {
    if (!form.valid) {
      this.messageAuthError = 'Veuillez remplir correctement le formulaire.';
      return;
    }
    const data = form.value;
    this.authAdminService.login(data).subscribe({
      next: (response) => {
        this.handleLoginSuccess(response);
      },
      error: (err: HttpErrorResponse) => {
        this.handleLoginError(err);
      },
    });
  }
  private handleLoginSuccess(response: any): void {
    this.authAdminService.saveDataProfil(response.token);
    this.router.navigate([this.returnUrl]);
  }
  private handleLoginError(err: HttpErrorResponse): void {
    this.messageAuthError =
      err.error?.message || 'Une erreur est survenue lors de la connexion';

    // Effacer le message d'erreur après 5 secondes
    setTimeout(() => (this.messageAuthError = ''), 5000);
  }
  
}

