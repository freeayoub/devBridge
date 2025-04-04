import { HttpClient} from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { User } from '../models/user.model';

@Injectable({
  providedIn: 'root',
})
export class DataService {
  private apiUrl = 'http://localhost:3000/user';
  constructor(private http: HttpClient) {}
  // Get all users
  getAllUser(){
    return this.http.get(`${this.apiUrl}/allusers`)
  }
  // Add a new user
  addUser(userData: any){
    return this.http.post(`${this.apiUrl}/newuser`, userData)
  }
  ///delete user 
  deleteUser(id:any){
    return this.http.delete<any>(`${this.apiUrl}/deleteuser/`+ id);
  }
  // Update the return type for update method
  updateUser(id: string, data: Partial<User>): Observable<User> {
    return this.http.put<User>(`${this.apiUrl}/updateuser/${id}`, data);
  }
// Get One User
getOnestUser(id: string): Observable<User> {
  return this.http.get<User>(`${this.apiUrl}/oneuser/`+id)
}
}
