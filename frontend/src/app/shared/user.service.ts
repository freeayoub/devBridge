import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private API_URL = `${environment.apiUrl}`;

  constructor(private http: HttpClient) {}

  // Get all students (for project assignment)
  getStudents(token: string): Observable<any> {
    return this.http.get(`${this.API_URL}/admin/users?role=student`, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  // Get all groups (for project assignment)
  getGroups(token: string): Observable<any> {
    return this.http.get(`${this.API_URL}/groups`, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }
}
