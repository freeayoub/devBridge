import { HttpClient} from '@angular/common/http';
import { Injectable } from '@angular/core';

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
    return this.http.post<any>(`${this.apiUrl}/newuser`, userData)
  }
  ///delete user 
  deleteUser(id:any){
    return this.http.delete<any>(`${this.apiUrl}/deleteuser/`+ id);
  }
// update Student 
updateUser(id:string,newprofile:any){
  return this.http.put(`${this.apiUrl}/updateuser/`+id,newprofile)
}
// Get One User
getOnestUser(id:any){
  return this.http.get(`${this.apiUrl}/oneuser/${id}`)
}

}
