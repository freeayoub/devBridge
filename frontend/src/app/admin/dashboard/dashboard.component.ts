import { Component, OnInit } from '@angular/core';
import { AuthService } from 'src/app/auth/auth.service';
import { Router } from '@angular/router';
import { ThemeService } from 'src/app/shared/theme.service';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
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

  // Image modal properties
  showImageModal = false;
  selectedImageUrl = '';
  selectedUserName = '';

  // Bulk actions properties
  selectedUsers: string[] = [];
  selectAll = false;
  showBulkActions = false;
  bulkActionRole = 'student';
  bulkActionConfirmation = false;

  // Sidebar properties
  isMobileSidebarOpen = false;

  // Pagination properties
  currentPage = 1;
  itemsPerPage = 10;
  totalPages = 1;
  paginatedUsers: any[] = [];
  Math = Math; // Make Math available in the template

  constructor(
    private authService: AuthService,
    private router: Router,
    private themeService: ThemeService
  ) {}

  ngOnInit(): void {
    this.loadUserData();
  }

  loadUserData(): void {
    this.loading = true;
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');

    if (!token || !userStr) {
      this.router.navigate(['/auth/login']);
      return;
    }

    this.currentUser = JSON.parse(userStr);
    console.log('Current user:', this.currentUser);

    // Check if user is admin
    if (this.currentUser.role !== 'admin') {
      this.router.navigate(['/user/dashboard']);
      return;
    }

    this.authService.getAllUsers(token).subscribe({
      next: (res: any) => {
        console.log('API response from getAllUsers:', res);
        this.users = res;
        this.filteredUsers = [...this.users];
        this.loading = false;
        this.updatePagination();
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to fetch users';
        this.loading = false;
      }
    });
  }

  searchUsers(): void {
    if (!this.searchTerm.trim()) {
      this.filteredUsers = [...this.users];
    } else {
      const term = this.searchTerm.toLowerCase().trim();
      this.filteredUsers = this.users.filter(user =>
        user.fullName.toLowerCase().includes(term) ||
        user.email.toLowerCase().includes(term) ||
        user.role.toLowerCase().includes(term)
      );
    }

    // Reset to first page when searching
    this.currentPage = 1;
    this.updatePagination();
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.filteredUsers = [...this.users];
    this.updatePagination();
  }

  // Pagination methods
  updatePagination(): void {
    this.totalPages = Math.ceil(this.filteredUsers.length / this.itemsPerPage);
    this.paginateUsers();
  }

  paginateUsers(): void {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    this.paginatedUsers = this.filteredUsers.slice(startIndex, endIndex);

    console.log('Paginated users:', this.paginatedUsers);
    console.log('Sample user isActive value:', this.paginatedUsers.length > 0 ? this.paginatedUsers[0].isActive : 'No users');

    // Update select all state for the current page
    this.updateSelectAllState();
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.paginateUsers();
    }
  }

  getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxPagesToShow = 5;

    if (this.totalPages <= maxPagesToShow) {
      // Show all pages if there are few
      for (let i = 1; i <= this.totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Show a subset of pages with current page in the middle
      let startPage = Math.max(1, this.currentPage - Math.floor(maxPagesToShow / 2));
      let endPage = startPage + maxPagesToShow - 1;

      if (endPage > this.totalPages) {
        endPage = this.totalPages;
        startPage = Math.max(1, endPage - maxPagesToShow + 1);
      }

      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
    }

    return pages;
  }

  // Mobile sidebar methods
  toggleMobileSidebar(): void {
    this.isMobileSidebarOpen = !this.isMobileSidebarOpen;
  }

  closeMobileSidebar(): void {
    this.isMobileSidebarOpen = false;
  }

  onRoleChange(userId: string, newRole: string) {
    const token = localStorage.getItem('token');
    this.authService.updateUserRole(userId, newRole, token!).subscribe({
      next: (res: any) => {
        this.message = res.message;
        this.error = '';

        // Update the user in the local arrays
        const userIndex = this.users.findIndex(u => u._id === userId);
        if (userIndex !== -1) {
          this.users[userIndex].role = newRole;
        }

        const filteredIndex = this.filteredUsers.findIndex(u => u._id === userId);
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
      }
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
        this.users = this.users.filter(u => u._id !== userId);
        this.filteredUsers = this.filteredUsers.filter(u => u._id !== userId);

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
      }
    });
  }

  toggleUserActivation(userId: string, newStatus: boolean) {
    const action = newStatus ? 'activate' : 'deactivate';
    const confirmAction = confirm(`Are you sure you want to ${action} this user?`);
    if (!confirmAction) return;

    console.log(`Attempting to ${action} user with ID: ${userId}, setting isActive to: ${newStatus}`);

    const token = localStorage.getItem('token');
    this.authService.toggleUserActivation(userId, newStatus, token!).subscribe({
      next: (res: any) => {
        console.log('API response:', res);
        this.message = res.message || `User ${action}d successfully`;
        this.error = '';

        // Update user in both arrays
        const userIndex = this.users.findIndex(u => u._id === userId);
        if (userIndex !== -1) {
          this.users[userIndex].isActive = newStatus;
          console.log(`Updated user in users array, new isActive value: ${this.users[userIndex].isActive}`);
        }

        const filteredIndex = this.filteredUsers.findIndex(u => u._id === userId);
        if (filteredIndex !== -1) {
          this.filteredUsers[filteredIndex].isActive = newStatus;
          console.log(`Updated user in filteredUsers array, new isActive value: ${this.filteredUsers[filteredIndex].isActive}`);
        }

        // Auto-hide message after 3 seconds
        setTimeout(() => {
          this.message = '';
        }, 3000);
      },
      error: (err) => {
        this.error = err.error?.message || `Failed to ${action} user`;
        this.message = '';

        // Auto-hide error after 3 seconds
        setTimeout(() => {
          this.error = '';
        }, 3000);
      }
    });
  }

  toggleUserVerification(userId: string, currentStatus: boolean) {
    const newStatus = !currentStatus;
    const action = newStatus ? 'verify' : 'unverify';
    const confirmAction = confirm(`Are you sure you want to ${action} this user's email?`);
    if (!confirmAction) return;

    const token = localStorage.getItem('token');
    this.authService.toggleUserVerification(userId, newStatus, token!).subscribe({
      next: (res: any) => {
        this.message = res.message || `User email ${action}d successfully`;
        this.error = '';

        // Update user in both arrays
        const userIndex = this.users.findIndex(u => u._id === userId);
        if (userIndex !== -1) {
          this.users[userIndex].verified = newStatus;
        }

        const filteredIndex = this.filteredUsers.findIndex(u => u._id === userId);
        if (filteredIndex !== -1) {
          this.filteredUsers[filteredIndex].verified = newStatus;
        }

        // Auto-hide message after 3 seconds
        setTimeout(() => {
          this.message = '';
        }, 3000);
      },
      error: (err) => {
        this.error = err.error?.message || `Failed to ${action} user's email`;
        this.message = '';

        // Auto-hide error after 3 seconds
        setTimeout(() => {
          this.error = '';
        }, 3000);
      }
    });
  }

  triggerPasswordReset(userId: string, userName: string, userEmail: string) {
    const confirmAction = confirm(`Are you sure you want to reset the password for ${userName} (${userEmail})? A new random password will be generated and sent to the user's email.`);
    if (!confirmAction) return;

    const token = localStorage.getItem('token');
    this.authService.triggerPasswordReset(userId, token!).subscribe({
      next: (res: any) => {
        this.message = res.message || `New password generated and sent to user's email`;
        this.error = '';

        // Auto-hide message after 5 seconds (longer because it's important)
        setTimeout(() => {
          this.message = '';
        }, 5000);
      },
      error: (err) => {
        this.error = err.error?.message || `Failed to reset password`;
        this.message = '';

        // Auto-hide error after 3 seconds
        setTimeout(() => {
          this.error = '';
        }, 3000);
      }
    });
  }

  getStudentCount(): number {
    return this.users.filter(u => u.role === 'student').length;
  }

  getTeacherCount(): number {
    return this.users.filter(u => u.role === 'teacher').length;
  }

  getAdminCount(): number {
    return this.users.filter(u => u.role === 'admin').length;
  }

  getActiveCount(): number {
    return this.users.filter(u => u.isActive !== false).length;
  }

  getInactiveCount(): number {
    return this.users.filter(u => u.isActive === false).length;
  }

  toggleDarkMode(): void {
    this.themeService.toggleDarkMode();
  }

  openImageModal(imageUrl: string, userName: string): void {
    this.selectedImageUrl = imageUrl;
    this.selectedUserName = userName;
    this.showImageModal = true;
  }

  closeImageModal(): void {
    this.showImageModal = false;
    this.selectedImageUrl = '';
    this.selectedUserName = '';
  }

  // Bulk actions methods
  toggleUserSelection(userId: string, event: Event): void {
    event.stopPropagation(); // Prevent row click event

    const index = this.selectedUsers.indexOf(userId);
    if (index === -1) {
      this.selectedUsers.push(userId);
    } else {
      this.selectedUsers.splice(index, 1);
    }

    this.updateBulkActionsVisibility();
    this.updateSelectAllState();
  }

  toggleSelectAll(event: Event): void {
    event.stopPropagation(); // Prevent row click event

    this.selectAll = !this.selectAll;
    const currentUserId = this.currentUser?._id || this.currentUser?.id;

    if (this.selectAll) {
      // Add all users from current page to selection (except current admin)
      const pageUserIds = this.paginatedUsers
        .filter(user => user._id !== currentUserId)
        .map(user => user._id);

      // Merge with existing selections from other pages (avoid duplicates)
      this.selectedUsers = [...new Set([...this.selectedUsers, ...pageUserIds])];
    } else {
      // Remove all users from current page from selection
      const pageUserIds = this.paginatedUsers.map(user => user._id);
      this.selectedUsers = this.selectedUsers.filter(id => !pageUserIds.includes(id));
    }

    this.updateBulkActionsVisibility();
  }

  updateSelectAllState(): void {
    // Check if all users on the current page (except current admin) are selected
    const currentUserId = this.currentUser?._id || this.currentUser?.id;
    const selectableUsers = this.paginatedUsers.filter(user => user._id !== currentUserId);

    if (selectableUsers.length === 0) {
      this.selectAll = false;
      return;
    }

    // Check if all selectable users on the current page are selected
    this.selectAll = selectableUsers.every(user =>
      this.selectedUsers.includes(user._id)
    );
  }

  updateBulkActionsVisibility(): void {
    this.showBulkActions = this.selectedUsers.length > 0;
  }

  isUserSelected(userId: string): boolean {
    return this.selectedUsers.includes(userId);
  }

  clearSelection(): void {
    this.selectedUsers = [];
    this.selectAll = false;
    this.showBulkActions = false;
    this.bulkActionConfirmation = false;
  }

  showBulkRoleChangeConfirmation(): void {
    this.bulkActionConfirmation = true;
  }

  cancelBulkAction(): void {
    this.bulkActionConfirmation = false;
  }

  executeBulkRoleChange(): void {
    const token = localStorage.getItem('token');
    if (!token) return;

    const totalUsers = this.selectedUsers.length;
    let processedCount = 0;
    let successCount = 0;
    let errorCount = 0;

    this.selectedUsers.forEach(userId => {
      this.authService.updateUserRole(userId, this.bulkActionRole, token).subscribe({
        next: (res: any) => {
          processedCount++;
          successCount++;

          // Update user in both arrays
          const userIndex = this.users.findIndex(u => u._id === userId);
          if (userIndex !== -1) {
            this.users[userIndex].role = this.bulkActionRole;
          }

          const filteredIndex = this.filteredUsers.findIndex(u => u._id === userId);
          if (filteredIndex !== -1) {
            this.filteredUsers[filteredIndex].role = this.bulkActionRole;
          }

          // Check if all users have been processed
          if (processedCount === totalUsers) {
            this.message = `Successfully changed role to ${this.bulkActionRole} for ${successCount} users. ${errorCount > 0 ? `Failed for ${errorCount} users.` : ''}`;
            this.clearSelection();

            // Auto-hide message after 3 seconds
            setTimeout(() => {
              this.message = '';
            }, 3000);
          }
        },
        error: (err) => {
          processedCount++;
          errorCount++;

          // Check if all users have been processed
          if (processedCount === totalUsers) {
            if (successCount > 0) {
              this.message = `Successfully changed role to ${this.bulkActionRole} for ${successCount} users. Failed for ${errorCount} users.`;
            } else {
              this.error = 'Failed to change roles for selected users.';

              // Auto-hide error after 3 seconds
              setTimeout(() => {
                this.error = '';
              }, 3000);
            }

            this.clearSelection();
          }
        }
      });
    });
  }

  executeBulkActivation(activate: boolean): void {
    const token = localStorage.getItem('token');
    if (!token) return;

    const totalUsers = this.selectedUsers.length;
    let processedCount = 0;
    let successCount = 0;
    let errorCount = 0;

    this.selectedUsers.forEach(userId => {
      this.authService.toggleUserActivation(userId, activate, token).subscribe({
        next: (res: any) => {
          processedCount++;
          successCount++;

          // Update user in both arrays
          const userIndex = this.users.findIndex(u => u._id === userId);
          if (userIndex !== -1) {
            this.users[userIndex].isActive = activate;
          }

          const filteredIndex = this.filteredUsers.findIndex(u => u._id === userId);
          if (filteredIndex !== -1) {
            this.filteredUsers[filteredIndex].isActive = activate;
          }

          // Check if all users have been processed
          if (processedCount === totalUsers) {
            const action = activate ? 'activated' : 'deactivated';
            this.message = `Successfully ${action} ${successCount} users. ${errorCount > 0 ? `Failed for ${errorCount} users.` : ''}`;
            this.clearSelection();

            // Auto-hide message after 3 seconds
            setTimeout(() => {
              this.message = '';
            }, 3000);
          }
        },
        error: (err) => {
          processedCount++;
          errorCount++;

          // Check if all users have been processed
          if (processedCount === totalUsers) {
            const action = activate ? 'activate' : 'deactivate';

            if (successCount > 0) {
              this.message = `Successfully ${action}d ${successCount} users. Failed for ${errorCount} users.`;
            } else {
              this.error = `Failed to ${action} selected users.`;

              // Auto-hide error after 3 seconds
              setTimeout(() => {
                this.error = '';
              }, 3000);
            }

            this.clearSelection();
          }
        }
      });
    });
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/']);
  }

}
