import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthadminService } from 'src/app/services/authadmin.service';

@Component({
  selector: 'app-auth-admin-layout',
  templateUrl: './auth-admin-layout.component.html',
  styleUrls: ['./auth-admin-layout.component.css'],
})
export class AuthAdminLayoutComponent implements OnInit {
  messageAuthError: string = '';
  url:any
  constructor(private authService: AuthadminService, private router: Router,private act:ActivatedRoute) {
    if(this.authService.loggedIn()==true){
      this.router.navigateByUrl('/admin')
    }
  }

  ngOnInit(): void {
    this.url=this.act.snapshot.queryParams['returnUrl'] || '/admin/'
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
        this.messageAuthError =err.error;
      },
    });
  }
  
}
