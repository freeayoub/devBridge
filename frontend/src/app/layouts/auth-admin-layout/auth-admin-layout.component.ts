import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthadminService } from 'src/app/services/authadmin.service';

@Component({
  selector: 'app-auth-admin-layout',
  templateUrl: './auth-admin-layout.component.html',
  styleUrls: ['./auth-admin-layout.component.css'],
})
export class AuthAdminLayoutComponent implements OnInit {
  messageAuthError: string = '';

  constructor(private authService: AuthadminService, private router: Router) {}

  ngOnInit(): void {
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
          this.router.navigateByUrl('/admin/dashboard');
      },
      error: (err: HttpErrorResponse) => {
        console.error('Erreur de connexion:', err.message);
        this.messageAuthError =
          'Échec de la connexion. Vérifiez vos identifiants.';
      },
    });
  }
}
