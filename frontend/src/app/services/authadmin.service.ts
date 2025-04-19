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
  constructor(private http:HttpClient,private jwtHelper: JwtHelperService ) {}
    // login 
    login( body: Partial<User>): Observable<User> {
      return this.http.post<User>(`${environment.urlBackend}users/login`, body);
    }
    saveDataProfil(token:any){
      localStorage.setItem('token',token)
      }
      getUser(){
        let token:any=localStorage.getItem('token')
        let decodedToken = this.jwtHelper.decodeToken(token);
        return decodedToken
      }

      loggedIn(){
        let token:any=localStorage.getItem('token')
        if (!token) {
          return false
         }
       if(this.jwtHelper.decodeToken(token).role!=="admin"){
        return false
       }
       if(this.jwtHelper.isTokenExpired(token)){
        return false
       }
       return true
      }
      clearAuthData(): void {
        localStorage.removeItem('token');
      }
    
      
}
