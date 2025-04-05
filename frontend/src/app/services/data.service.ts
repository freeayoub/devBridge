import { HttpClient, HttpHeaders, HttpParams} from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { User } from '../models/user.model';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root',
})
export class DataService {
  constructor(private http: HttpClient) {}

  private getAdminHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Authorization': 'Bearer ' + localStorage.getItem('token'),
      'role': 'Admin',
      'Content-Type': 'application/json',
    });
  }
  private getUserHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Authorization': 'Bearer ' + (localStorage.getItem('token') || ''),
    });
  }
  private getCommonParams(): HttpParams {
    return new HttpParams()
      .set('secret', environment.secret)
      .set('client', environment.client);
  }
  // Get all users
  getAllUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${environment.urlBackend}user/allusers`,{
      headers: this.getUserHeaders(),
      params: this.getCommonParams(),
    });
  }
  // Get One User
getOnestUser(id: string): Observable<User> {
  return this.http.get<User>(`${environment.urlBackend}user/oneuser/`+id,{
    headers: this.getUserHeaders(),
    params: this.getCommonParams(),
  })
}
  // Add a new user
  addUser(userData: any){
    return this.http.post(`${environment.urlBackend}user/newuser`, userData,{
      headers:this.getAdminHeaders(),
      params:this.getCommonParams(),
    })
  }
  ///delete user 
  deleteUser(id:any){
    return this.http.delete<any>(`${environment.urlBackend}user/deleteuser/`+ id,{
      headers:this.getAdminHeaders(),
      params:this.getCommonParams(),
    });
  }
  // Update the return type for update method
  updateUser(id: string, data: Partial<User>): Observable<User> {
    return this.http.put<User>(`${environment.urlBackend}user/updateuser/}`+id, data,{
      headers:this.getAdminHeaders(),
      params:this.getCommonParams(),
    });
  }

}
