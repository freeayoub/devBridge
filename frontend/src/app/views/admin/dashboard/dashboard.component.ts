import { Component, OnInit } from '@angular/core';
import { AuthService } from 'src/app/services/auth.service';
import { ToastService } from 'src/app/services/toast.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
})
export class DashboardComponent implements OnInit {
  users: any[] = [];
  error = '';
  message = '';
  roles = ['student', 'teacher', 'admin'];
  loading = true;
  currentUser: any = null;
  searchTerm = '';
  filteredUsers: any[] = [];

  constructor(
    private authService: AuthService,
    private router: Router,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadUserData();
  }

  loadUserData(): void {
    this.loading = true;
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');

    if (!token || !userStr) {
      this.router.navigate(['/admin/login']);
      return;
    }

    this.currentUser = JSON.parse(userStr);

    // Check if user is admin
    if (this.currentUser.role !== 'admin') {
      this.router.navigate(['/']);
      return;
    }

    this.authService.getAllUsers(token).subscribe({
      next: (res: any) => {
        this.users = res;
        this.filteredUsers = [...this.users];
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to fetch users';
        this.loading = false;
      },
    });
  }
  searchUsers(): void {
    if (!this.searchTerm.trim()) {
      this.filteredUsers = [...this.users];
      return;
    }

    const term = this.searchTerm.toLowerCase().trim();
    this.filteredUsers = this.users.filter(
      (user) =>
        user.fullName.toLowerCase().includes(term) ||
        user.email.toLowerCase().includes(term) ||
        user.role.toLowerCase().includes(term)
    );
  }
  clearSearch(): void {
    this.searchTerm = '';
    this.filteredUsers = [...this.users];
  }

  applyFilters(): void {
    this.searchUsers();
  }

  onRoleChange(userId: string, newRole: string) {
    const token = localStorage.getItem('token');
    this.authService.updateUserRole(userId, newRole, token!).subscribe({
      next: (res: any) => {
        this.message = res.message;
        this.error = '';

        // Update the user in the local arrays
        const userIndex = this.users.findIndex((u) => u._id === userId);
        if (userIndex !== -1) {
          this.users[userIndex].role = newRole;
        }

        const filteredIndex = this.filteredUsers.findIndex(
          (u) => u._id === userId
        );
        if (filteredIndex !== -1) {
          this.filteredUsers[filteredIndex].role = newRole;
        }

        // Auto-hide message after 3 seconds
        setTimeout(() => {
          this.message = '';
        }, 3000);
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to update role';
        this.message = '';

        // Auto-hide error after 3 seconds
        setTimeout(() => {
          this.error = '';
        }, 3000);
      },
    });
  }
  onDeleteUser(userId: string) {
    const confirmDelete = confirm('Are you sure you want to delete this user?');
    if (!confirmDelete) return;

    const token = localStorage.getItem('token');
    this.authService.deleteUser(userId, token!).subscribe({
      next: (res: any) => {
        this.message = res.message;
        this.error = '';

        // Remove user from both arrays
        this.users = this.users.filter((u) => u._id !== userId);
        this.filteredUsers = this.filteredUsers.filter((u) => u._id !== userId);

        // Auto-hide message after 3 seconds
        setTimeout(() => {
          this.message = '';
        }, 3000);
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to delete user';
        this.message = '';

        // Auto-hide error after 3 seconds
        setTimeout(() => {
          this.error = '';
        }, 3000);
      },
    });
  }
  toggleUserActivation(userId: string, currentStatus: boolean) {
    const newStatus = !currentStatus;
    const action = newStatus ? 'activate' : 'deactivate';

    // Find the user to get their name for better messaging
    const user = this.users.find(u => u._id === userId);
    const userName = user?.fullName || user?.firstName || 'User';

    const confirmAction = confirm(
      `Are you sure you want to ${action} ${userName}?`
    );
    if (!confirmAction) return;

    const token = localStorage.getItem('token');
    this.authService.toggleUserActivation(userId, newStatus, token!).subscribe({
      next: (res: any) => {
        const statusText = newStatus ? 'activated' : 'deactivated';
        const successMessage = `${userName} has been ${statusText} successfully`;

        // Show success toast
        this.toastService.showSuccess(successMessage);

        // Clear any existing messages
        this.message = '';
        this.error = '';

        // Update user in both arrays
        const userIndex = this.users.findIndex((u) => u._id === userId);
        if (userIndex !== -1) {
          this.users[userIndex].isActive = newStatus;
        }

        const filteredIndex = this.filteredUsers.findIndex(
          (u) => u._id === userId
        );
        if (filteredIndex !== -1) {
          this.filteredUsers[filteredIndex].isActive = newStatus;
        }

        // Apply filters to refresh the view
        this.applyFilters();
      },
      error: (err) => {
        const statusText = newStatus ? 'activate' : 'deactivate';
        const errorMessage = err.error?.message || `Failed to ${statusText} ${userName}`;

        // Show error toast
        this.toastService.showError(errorMessage);

        // Clear any existing messages
        this.message = '';
        this.error = '';
      },
    });
  }
  getStudentCount(): number {
    return this.users.filter((u) => u.role === 'student').length;
  }
  getTeacherCount(): number {
    return this.users.filter((u) => u.role === 'teacher').length;
  }
  getAdminCount(): number {
    return this.users.filter((u) => u.role === 'admin').length;
  }
  getActiveCount(): number {
    return this.users.filter((u) => u.isActive !== false).length;
  }
  getInactiveCount(): number {
    return this.users.filter((u) => u.isActive === false).length;
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/admin/login']);
  }

  showUserDetails(userId: string) {
    this.router.navigate(['/admin/userdetails', userId]);
  }
}
