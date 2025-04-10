import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { JwtHelperService } from "@auth0/angular-jwt";
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthuserService {
  helper=new JwtHelperService()
  constructor(private http:HttpClient) { }

  register(body:any){
    return this.http.post(`${environment.urlBackend}user/register`,body)
  }
  login(body:any){
    return this.http.post(`${environment.urlBackend}user/login`,body)
  }
  saveToken(token:any){
    localStorage.setItem('token',token)
  }
  
  userLoggedIn(){
    if(!localStorage.getItem('token')){
      return false
    }
    let token:any=localStorage.getItem('token')
    let decodeToken=this.helper.decodeToken(token)
     if(!decodeToken.role){
       return false
     }
     if(this.helper.isTokenExpired(token)){
       return false
     }
     return true
  }
  getCurrentUserId(): string | null {
    const token = localStorage.getItem('token');
    if (!token) return null;
    
    const decoded = this.helper.decodeToken(token);
    return decoded?.id || null;
  }
  getCurrentUser(): any {
    const token = localStorage.getItem('token');
    if (!token) return null;
    
    const decoded = this.helper.decodeToken(token);
    return {
      id: decoded?.id,
      username: decoded?.username,
      email: decoded?.email,
      role: decoded?.role
    };
  }
  getCurrentUserRole(): string | null {
    const token = localStorage.getItem('token');
    if (!token) return null;
    
    const decoded = this.helper.decodeToken(token);
    return decoded?.role || null;
  }

  updateSelf(data: any) {
    const userId = this.getCurrentUserId();
    if (!userId) throw new Error('User not logged in');
    
    return this.http.put(`${environment.urlBackend}user/updateself/${userId}`, data);
  }

  deactivateSelf() {
    const userId = this.getCurrentUserId();
    if (!userId) throw new Error('User not logged in');
    
    return this.http.put(`${environment.urlBackend}user/deactivateself`, {});
  }

  changePassword(currentPassword: string, newPassword: string) {
    return this.updateSelf({ currentPassword, newPassword });
  }

}
