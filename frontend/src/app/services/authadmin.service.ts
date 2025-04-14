import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { User } from '../models/user.model';
import { Observable } from 'rxjs';
import { JwtHelperService } from '@auth0/angular-jwt';
import { environment } from 'src/environments/environment';
@Injectable({
  providedIn: 'root'
})
export class AuthadminService {
  helper = new JwtHelperService();
  constructor(private http:HttpClient) {}
    // login 
    login( body: Partial<User>): Observable<User> {
      return this.http.post<User>(`${environment.urlBackend}users/login`, body);
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
