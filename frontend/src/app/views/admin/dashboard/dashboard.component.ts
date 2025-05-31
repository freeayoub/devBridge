import { Component, OnInit, HostListener, ElementRef } from '@angular/core';
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
  showCreateUserModal = false;
  showExportDropdown = false;

  // Enhanced statistics
  stats = {
    totalUsers: 0,
    activeUsers: 0,
    inactiveUsers: 0,
    verifiedUsers: 0,
    onlineUsers: 0,
    recentRegistrations: 0,
    studentsCount: 0,
    teachersCount: 0,
    adminsCount: 0,
    usersThisMonth: 0,
    usersThisWeek: 0,
    averageUsersPerDay: 0
  };

  recentActivities: any[] = [];
  systemAlerts: any[] = [];

  constructor(
    private authService: AuthService,
    private router: Router,
    private toastService: ToastService,
    private elementRef: ElementRef
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
        this.calculateStatistics();
        this.generateRecentActivities();
        this.checkSystemAlerts();
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

  calculateStatistics(): void {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    this.stats = {
      totalUsers: this.users.length,
      activeUsers: this.users.filter(u => u.isActive !== false).length,
      inactiveUsers: this.users.filter(u => u.isActive === false).length,
      verifiedUsers: this.users.filter(u => u.verified === true).length,
      onlineUsers: this.users.filter(u => u.isOnline === true).length,
      studentsCount: this.users.filter(u => u.role === 'student').length,
      teachersCount: this.users.filter(u => u.role === 'teacher').length,
      adminsCount: this.users.filter(u => u.role === 'admin').length,
      recentRegistrations: this.users.filter(u => {
        const createdAt = new Date(u.createdAt);
        return createdAt >= oneWeekAgo;
      }).length,
      usersThisWeek: this.users.filter(u => {
        const createdAt = new Date(u.createdAt);
        return createdAt >= oneWeekAgo;
      }).length,
      usersThisMonth: this.users.filter(u => {
        const createdAt = new Date(u.createdAt);
        return createdAt >= oneMonthAgo;
      }).length,
      averageUsersPerDay: this.users.length > 0 ? Math.round(this.users.length / 30) : 0
    };
  }

  generateRecentActivities(): void {
    this.recentActivities = [];

    // Get recent user registrations
    const recentUsers = this.users
      .filter(u => u.createdAt)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);

    recentUsers.forEach(user => {
      this.recentActivities.push({
        type: 'registration',
        message: `New user registered: ${user.fullName || user.username}`,
        time: this.getTimeAgo(user.createdAt),
        icon: 'fas fa-user-plus',
        color: 'text-green-600'
      });
    });

    // Get recently activated/deactivated users
    const recentlyModified = this.users
      .filter(u => u.updatedAt && u.updatedAt !== u.createdAt)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 3);

    recentlyModified.forEach(user => {
      const action = user.isActive ? 'activated' : 'deactivated';
      this.recentActivities.push({
        type: 'status_change',
        message: `User ${action}: ${user.fullName || user.username}`,
        time: this.getTimeAgo(user.updatedAt),
        icon: user.isActive ? 'fas fa-user-check' : 'fas fa-user-slash',
        color: user.isActive ? 'text-green-600' : 'text-red-600'
      });
    });

    // Sort all activities by time
    this.recentActivities.sort((a, b) => {
      // This is a simplified sort - in a real app you'd want proper timestamp comparison
      return 0;
    });

    // Limit to 8 most recent activities
    this.recentActivities = this.recentActivities.slice(0, 8);
  }

  checkSystemAlerts(): void {
    this.systemAlerts = [];

    // Check for unverified users
    const unverifiedCount = this.users.filter(u => !u.verified).length;
    if (unverifiedCount > 0) {
      this.systemAlerts.push({
        type: 'warning',
        message: `${unverifiedCount} users need email verification`,
        icon: 'fas fa-exclamation-triangle',
        color: 'text-yellow-600'
      });
    }

    // Check for inactive users
    const inactiveCount = this.stats.inactiveUsers;
    if (inactiveCount > this.stats.activeUsers * 0.3) {
      this.systemAlerts.push({
        type: 'info',
        message: `High number of inactive users (${inactiveCount})`,
        icon: 'fas fa-info-circle',
        color: 'text-blue-600'
      });
    }

    // Check for admin count
    if (this.stats.adminsCount < 2) {
      this.systemAlerts.push({
        type: 'warning',
        message: 'Consider adding more administrators',
        icon: 'fas fa-user-shield',
        color: 'text-orange-600'
      });
    }

    // Check for recent growth
    if (this.stats.recentRegistrations > 10) {
      this.systemAlerts.push({
        type: 'success',
        message: `${this.stats.recentRegistrations} new users this week!`,
        icon: 'fas fa-chart-line',
        color: 'text-green-600'
      });
    }
  }

  getTimeAgo(dateString: string): string {
    const now = new Date();
    const date = new Date(dateString);
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return `${Math.floor(diffInSeconds / 2592000)}mo ago`;
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/admin/login']);
  }

  showUserDetails(userId: string) {
    this.router.navigate(['/admin/userdetails', userId]);
  }

  openCreateUserModal() {
    this.showCreateUserModal = true;
  }

  onModalClose() {
    this.showCreateUserModal = false;
  }

  onUserCreated(newUser: any) {
    this.users.unshift(newUser);
    this.applyFilters();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    const target = event.target as HTMLElement;
    const exportDropdown = this.elementRef.nativeElement.querySelector('[data-export-dropdown]');

    if (this.showExportDropdown && exportDropdown && !exportDropdown.contains(target)) {
      this.showExportDropdown = false;
    }
  }

  toggleExportDropdown() {
    this.showExportDropdown = !this.showExportDropdown;
  }

  exportUsers(format: string) {
    this.showExportDropdown = false;

    const token = localStorage.getItem('token');
    if (!token) {
      this.toastService.showError('Authentication token not found');
      return;
    }

    // Use current search term to export filtered results
    const searchFilter = this.searchTerm.trim();

    this.toastService.showInfo(`Preparing ${format.toUpperCase()} export...`);

    this.authService.exportUsers(format, searchFilter, token).subscribe({
      next: (blob: Blob) => {
        // Create download link
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;

        // Generate filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const filename = `users-export-${timestamp}.${format}`;
        link.download = filename;

        // Trigger download
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Clean up
        window.URL.revokeObjectURL(url);

        const userCount = searchFilter ? this.filteredUsers.length : this.users.length;
        this.toastService.showSuccess(`Successfully exported ${userCount} users as ${format.toUpperCase()}`);
      },
      error: (err) => {
        console.error('Export error:', err);
        this.toastService.showError(err.error?.message || `Failed to export users as ${format.toUpperCase()}`);
      }
    });
  }
}
