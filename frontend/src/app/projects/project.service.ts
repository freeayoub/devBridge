import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ProjectService {
  private PROJECT_API = `${environment.apiUrl}/projects`;

  constructor(private http: HttpClient) {}

  // Helper method to get the API base URL (for file downloads)
  getApiBaseUrl(): string {
    return environment.apiUrl;
  }

  // Project endpoints
  getAllProjects(token: string, params?: any): Observable<any> {
    const queryParams = params ? this.buildQueryParams(params) : '';
    return this.http.get(`${this.PROJECT_API}${queryParams}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  getProjectById(id: string, token: string): Observable<any> {
    return this.http.get(`${this.PROJECT_API}/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  createProject(projectData: any, token: string): Observable<any> {
    return this.http.post(`${this.PROJECT_API}`, projectData, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  updateProject(id: string, projectData: any, token: string): Observable<any> {
    return this.http.put(`${this.PROJECT_API}/${id}`, projectData, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  deleteProject(id: string, token: string): Observable<any> {
    return this.http.delete(`${this.PROJECT_API}/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  // Task endpoints
  getProjectTasks(projectId: string, token: string, params?: any): Observable<any> {
    const queryParams = params ? this.buildQueryParams(params) : '';
    return this.http.get(`${this.PROJECT_API}/${projectId}/tasks${queryParams}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  getTaskById(id: string, token: string): Observable<any> {
    return this.http.get(`${this.PROJECT_API}/tasks/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  getUserTasks(token: string, params?: any): Observable<any> {
    const queryParams = params ? this.buildQueryParams(params) : '';
    const userTasksUrl = `${environment.apiUrl}/user/tasks${queryParams}`;
    console.log(`Requesting user tasks from: ${userTasksUrl}`);

    // Try the direct route first
    return this.http.get(userTasksUrl, {
      headers: { Authorization: `Bearer ${token}` }
    }).pipe(
      catchError(error => {
        console.error('Error fetching user tasks from direct route:', error);

        // If direct route fails, try the original route as fallback
        console.log(`Falling back to original route: ${this.PROJECT_API}/user/tasks${queryParams}`);
        return this.http.get(`${this.PROJECT_API}/user/tasks${queryParams}`, {
          headers: { Authorization: `Bearer ${token}` }
        }).pipe(
          catchError(fallbackError => {
            console.error('Error fetching user tasks from fallback route:', fallbackError);
            // Rethrow the error after logging it
            return throwError(() => fallbackError);
          })
        );
      })
    );
  }

  createTask(projectId: string, taskData: any, token: string): Observable<any> {
    return this.http.post(`${this.PROJECT_API}/${projectId}/tasks`, taskData, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  updateTask(id: string, taskData: any, token: string): Observable<any> {
    return this.http.put(`${this.PROJECT_API}/tasks/${id}`, taskData, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  deleteTask(id: string, token: string): Observable<any> {
    return this.http.delete(`${this.PROJECT_API}/tasks/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  addTaskComment(id: string, comment: string, token: string): Observable<any> {
    return this.http.post(`${this.PROJECT_API}/tasks/${id}/comments`, { text: comment }, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  // Submission endpoints
  getProjectSubmissions(projectId: string, token: string, params?: any): Observable<any> {
    const queryParams = params ? this.buildQueryParams(params) : '';
    return this.http.get(`${this.PROJECT_API}/${projectId}/submissions${queryParams}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  getSubmissionById(id: string, token: string): Observable<any> {
    return this.http.get(`${this.PROJECT_API}/submissions/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  createSubmission(projectId: string, formData: FormData, token: string): Observable<any> {
    return this.http.post(`${this.PROJECT_API}/${projectId}/submissions`, formData, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  addFeedback(id: string, feedback: any, token: string): Observable<any> {
    return this.http.post(`${this.PROJECT_API}/submissions/${id}/feedback`, feedback, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  gradeSubmission(id: string, gradeData: any, token: string): Observable<any> {
    return this.http.post(`${this.PROJECT_API}/submissions/${id}/grade`, gradeData, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  // Helper method to build query parameters
  private buildQueryParams(params: any): string {
    const queryParams = Object.keys(params)
      .filter(key => params[key] !== null && params[key] !== undefined)
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
      .join('&');

    return queryParams ? `?${queryParams}` : '';
  }
}
