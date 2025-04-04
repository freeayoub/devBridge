import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { User } from '../models/user.model';
import { Observable } from 'rxjs';
import { JwtHelperService } from '@auth0/angular-jwt';
@Injectable({
  providedIn: 'root'
})
export class AuthadminService {
  private apiUrl = 'http://localhost:3000/user';
  ProfilAdmin={
    username:'',
    role:''
  }

  helper = new JwtHelperService();
  constructor(private http:HttpClient) {
   
  }
    // login 
    login( data: Partial<User>): Observable<User> {
      return this.http.post<User>(`${this.apiUrl}/login`, data);
    }
    saveDataProfil(token:any){
      const decodedToken = this.helper.decodeToken(token);
      localStorage.setItem('token',token)
      localStorage.setItem('role',decodedToken.role)
      
   
      }
      getUserName(){
        let token:any=localStorage.getItem('token')
        let decodedToken = this.helper.decodeToken(token);
        return decodedToken.username
      }
      loggedIn(){
        let token:any=localStorage.getItem('token')
        let decodedToken = this.helper.decodeToken(token);
        let role =decodedToken.role
       
      }
}
