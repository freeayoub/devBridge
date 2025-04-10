import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthadminService } from 'src/app/services/authadmin.service';
import { AuthuserService } from 'src/app/services/authuser.service';

@Component({
  selector: 'app-auth-admin-layout',
  templateUrl: './auth-admin-layout.component.html',
  styleUrls: ['./auth-admin-layout.component.css']
})
export class AuthAdminLayoutComponent implements OnInit {
  messageAuthError: string = '';
  url: any;

  constructor(
    private authService: AuthadminService,
    public authuser: AuthuserService,
    private router: Router,
    private act: ActivatedRoute
  ) {
    // Redirection si déjà connecté
    if (this.authuser.userLoggedIn()) {
      this.router.navigate(['/'], {
        queryParams: {
          message: "Vous êtes déjà connecté en tant qu'utilisateur. Veuillez vous déconnecter d'abord."
        }
      });
    }
    if (this.authService.loggedIn()) {
      this.router.navigateByUrl('/admin');
    }
  }

  ngOnInit(): void {
    this.url = this.act.snapshot.queryParams['returnUrl'] || '/admin/';
  }

  loginadmin(form: any): void {
    if (!form.valid) {
      this.messageAuthError = 'Veuillez remplir correctement le formulaire.';
      return;
    }
    
    const data = form.value;
    this.authService.login(data).subscribe({
      next: (response: any) => {
        const dataReceived = response;
        this.authService.saveDataProfil(dataReceived.token);
        this.router.navigate([this.url]);
      },
      error: (err: HttpErrorResponse) => {
        this.messageAuthError = err.error || 'Une erreur est survenue lors de la connexion';
      },
    });
  }
}