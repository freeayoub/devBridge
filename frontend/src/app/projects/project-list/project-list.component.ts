import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ProjectService } from '../project.service';
import { AuthService } from '../../auth/auth.service';

@Component({
  selector: 'app-project-list',
  templateUrl: './project-list.component.html',
  styleUrls: ['./project-list.component.scss']
})
export class ProjectListComponent implements OnInit {
  projects: any[] = [];
  filteredProjects: any[] = [];
  loading = true;
  error = '';
  currentUser: any;

  // Filter options
  statusFilter: string = '';
  searchQuery: string = '';

  constructor(
    private projectService: ProjectService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadUserData();
    this.loadProjects();
  }

  loadUserData(): void {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');

    if (!token || !userStr) {
      this.router.navigate(['/auth/login']);
      return;
    }

    this.currentUser = JSON.parse(userStr);
  }

  loadProjects(): void {
    this.loading = true;
    const token = localStorage.getItem('token');

    if (!token) {
      this.router.navigate(['/auth/login']);
      return;
    }

    console.log('Fetching projects...');
    this.projectService.getAllProjects(token).subscribe({
      next: (res: any) => {
        console.log('Projects fetched successfully:', res);
        this.projects = res;
        this.filteredProjects = [...this.projects];
        this.loading = false;
      },
      error: (err) => {
        console.error('Error fetching projects:', err);
        this.error = err.error?.message || 'Failed to fetch projects';
        this.loading = false;
      }
    });
  }

  applyFilters(): void {
    this.filteredProjects = this.projects.filter(project => {
      // Apply status filter
      if (this.statusFilter && project.status !== this.statusFilter) {
        return false;
      }

      // Apply search query
      if (this.searchQuery) {
        const query = this.searchQuery.toLowerCase();
        return project.title.toLowerCase().includes(query) ||
               project.description.toLowerCase().includes(query);
      }

      return true;
    });
  }

  clearFilters(): void {
    this.statusFilter = '';
    this.searchQuery = '';
    this.filteredProjects = [...this.projects];
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'planning':
        return 'status-planning';
      case 'in-progress':
        return 'status-in-progress';
      case 'completed':
        return 'status-completed';
      case 'on-hold':
        return 'status-on-hold';
      default:
        return '';
    }
  }

  formatDate(dateString: string): string {
    if (!dateString) return 'Not set';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  canCreateProject(): boolean {
    return this.currentUser &&
           (this.currentUser.role === 'teacher' || this.currentUser.role === 'admin');
  }

  navigateToProjectDetail(projectId: string): void {
    this.router.navigate(['/projects', projectId]);
  }

  navigateToCreateProject(): void {
    this.router.navigate(['/projects/new']);
  }
}
