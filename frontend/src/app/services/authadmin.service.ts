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
  helper = new JwtHelperService();
  constructor(private http:HttpClient) {}
    // login 
    login( data: Partial<User>): Observable<User> {
      return this.http.post<User>(`${this.apiUrl}/login`, data);
    }
    saveDataProfil(token:any){
      localStorage.setItem('token',token)
      }
      getUserName(){
        let token:any=localStorage.getItem('token')
        let decodedToken = this.helper.decodeToken(token);
        return decodedToken.username
      }
      loggedIn(){
        let token:any=localStorage.getItem('token')
        if (!token) {
          return false
         }
       if(this.helper.decodeToken(token).role!=="admin"){
        return false
       }
       if(this.helper.isTokenExpired(token)){
        return false
       }
       return true
      }

}
