import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private AUTH_API = 'http://localhost:3000/api/auth';
  private ADMIN_API = 'http://localhost:3000/api/admin';

  constructor(private http: HttpClient) {}

  // Auth endpoints
  signup(data: any) {
    return this.http.post(`${this.AUTH_API}/signup`, data);
  }

  verifyEmail(data: { email: string; code: string }) {
    return this.http.post(`${this.AUTH_API}/verify-email`, data);
  }

  login(data: any) {
    return this.http.post(`${this.AUTH_API}/login`, data);
  }

  forgotPassword(email: string) {
    return this.http.post(`${this.AUTH_API}/forgot-password`, { email });
  }

  resetPassword(data: { email: string; code: string; newPassword: string }) {
    return this.http.post(`${this.AUTH_API}/reset-password`, data);
  }

  getProfile(token: string) {
    return this.http.get(`${this.AUTH_API}/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  updateProfile(formData: FormData, token: string) {
    return this.http.put(`${this.AUTH_API}/update-profile`, formData, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  removeProfileImage(token: string) {
    return this.http.delete(`${this.AUTH_API}/remove-profile-image`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  changePassword(data: any, token: string) {
    return this.http.put(`${this.AUTH_API}/change-password`, data, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  // Admin endpoints
  getAllUsers(token: string) {
    return this.http.get(`${this.ADMIN_API}/users`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  updateUserRole(userId: string, role: string, token: string) {
    return this.http.put(
      `${this.ADMIN_API}/users/${userId}/role`,
      { role },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
  }

  deleteUser(userId: string, token: string) {
    return this.http.delete(`${this.ADMIN_API}/users/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  toggleUserActivation(userId: string, isActive: boolean, token: string) {
    return this.http.put(
      `${this.ADMIN_API}/users/${userId}/activation`,
      { isActive },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
  }

  getUserById(userId: string, token: string) {
    return this.http.get(`${this.ADMIN_API}/users/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
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
