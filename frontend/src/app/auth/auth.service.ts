import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { environment } from "../../environments/environment";

@Injectable({ providedIn: 'root' })
export class AuthService {
  private AUTH_API = `${environment.apiUrl}/auth`;
  private ADMIN_API = `${environment.apiUrl}/admin`;

  constructor(private http: HttpClient) {}

  // Auth endpoints
  signup(data: any) {
    return this.http.post(`${this.AUTH_API}/signup`, data);
  }

  verifyEmail(data: { email: string, code: string }) {
    return this.http.post(`${this.AUTH_API}/verify-email`, data);
  }

  login(data: any) {
    return this.http.post(`${this.AUTH_API}/login`, data);
  }

  forgotPassword(email: string) {
    return this.http.post(`${this.AUTH_API}/forgot-password`, { email });
  }

  resetPassword(data: { email: string, code: string, newPassword: string }) {
    return this.http.post(`${this.AUTH_API}/reset-password`, data);
  }

  getProfile(token: string) {
    return this.http.get(`${this.AUTH_API}/profile`, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  updateProfile(formData: FormData, token: string) {
    return this.http.put(`${this.AUTH_API}/update-profile`, formData, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  changePassword(data: any, token: string) {
    return this.http.put(`${this.AUTH_API}/change-password`, data, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  // Admin endpoints
  getAllUsers(token: string) {
    return this.http.get(`${this.ADMIN_API}/users`, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  updateUserRole(userId: string, role: string, token: string) {
    return this.http.put(`${this.ADMIN_API}/users/${userId}/role`, { role }, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  deleteUser(userId: string, token: string) {
    return this.http.delete(`${this.ADMIN_API}/users/${userId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  toggleUserActivation(userId: string, isActive: boolean, token: string) {
    console.log(`Auth service: Toggling user activation for ${userId}, setting isActive to ${isActive}`);
    return this.http.put(`${this.ADMIN_API}/users/${userId}/activation`, { isActive }, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  toggleUserVerification(userId: string, verified: boolean, token: string) {
    return this.http.put(`${this.ADMIN_API}/users/${userId}/verification`, { verified }, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  triggerPasswordReset(userId: string, token: string) {
    return this.http.post(`${this.ADMIN_API}/users/${userId}/reset-password`, {}, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  createUser(userData: any, token: string) {
    return this.http.post(`${this.ADMIN_API}/users`, userData, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  updateUser(userId: string, userData: any, token: string) {
    return this.http.put(`${this.ADMIN_API}/users/${userId}`, userData, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }



  getUserGrowthData(period: string, token: string) {
    return this.http.get(`${this.ADMIN_API}/user-growth?period=${period}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  getUserRole(): string {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user?.role || '';
  }

  isAdmin(): boolean {
    return this.getUserRole() === 'admin';
  }

  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }

  resendCode(email: string) {
  return this.http.post(`${this.AUTH_API}/resend-code`, { email });
}


}
