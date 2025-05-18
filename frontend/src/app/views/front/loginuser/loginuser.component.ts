import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthuserService } from 'src/app/services/authuser.service';

@Component({
  selector: 'app-loginuser',
  templateUrl: './loginuser.component.html',
  styleUrls: ['./loginuser.component.css']
})
export class LoginuserComponent implements OnInit {
  datatoken: any;
  messageError: any;
  isLoading = false;
  constructor(private authService:AuthuserService,private route:Router) { }

  ngOnInit(): void {
  }


  login(f:any){
    this.isLoading = true;
    this.messageError = null;
    let data=f.value
    this.authService.login(data).subscribe({
      next:(response)=> {
      this.datatoken=response;
      this.authService.saveToken(this.datatoken.token)
      this.route.navigate(['/']);
    },error: (err: HttpErrorResponse) => {
    this.messageError = err.error;
    this.isLoading = false;
  },
  complete: () => {
    this.isLoading = false;
  }
});
}

}