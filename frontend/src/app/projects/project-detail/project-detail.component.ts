import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ProjectService } from '../project.service';

@Component({
  selector: 'app-project-detail',
  templateUrl: './project-detail.component.html',
  styleUrls: ['./project-detail.component.scss']
})
export class ProjectDetailComponent implements OnInit {
  projectId: string | null = null;
  project: any = null;
  loading = false;
  error = '';
  currentUser: any = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private projectService: ProjectService
  ) {}

  ngOnInit(): void {
    this.projectId = this.route.snapshot.paramMap.get('id');
    this.loadUserData();
    if (this.projectId) {
      this.loadProject(this.projectId);
    }
  }

  loadUserData(): void {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      this.currentUser = JSON.parse(userStr);
    }
  }

  loadProject(projectId: string): void {
    const token = localStorage.getItem('token');
    if (!token) {
      this.router.navigate(['/auth/login']);
      return;
    }

    this.loading = true;
    console.log('Fetching project details for ID:', projectId);
    this.projectService.getProjectById(projectId, token).subscribe({
      next: (project) => {
        console.log('Project details fetched successfully:', project);
        this.project = project;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error fetching project details:', err);
        this.error = err.error?.message || 'Failed to load project';
        this.loading = false;
      }
    });
  }

  formatDate(dateString: string): string {
    if (!dateString) return 'Not set';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  canEditProject(): boolean {
    if (!this.currentUser || !this.project) return false;

    // Admins can edit any project
    if (this.currentUser.role === 'admin') return true;

    // Teachers can edit projects they created
    if (this.currentUser.role === 'teacher' &&
        this.project.createdBy &&
        this.project.createdBy._id === this.currentUser._id) {
      return true;
    }

    return false;
  }

  editProject(): void {
    if (this.projectId) {
      this.router.navigate(['/projects', this.projectId, 'edit']);
    }
  }

  deleteProject(): void {
    if (!confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      return;
    }

    const token = localStorage.getItem('token');
    if (!token || !this.projectId) return;

    this.loading = true;
    this.projectService.deleteProject(this.projectId, token).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['/projects']);
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to delete project';
        this.loading = false;
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/projects']);
  }

  createTask(): void {
    if (this.projectId) {
      this.router.navigate(['/projects', this.projectId, 'tasks', 'new']);
    }
  }

  viewTaskDetails(taskId: string): void {
    if (this.projectId) {
      this.router.navigate(['/projects', this.projectId, 'tasks', taskId]);
    }
  }

  isTaskOverdue(task: any): boolean {
    if (!task || !task.dueDate || task.status === 'completed') return false;

    const dueDate = new Date(task.dueDate);
    const today = new Date();

    return dueDate < today;
  }

  getAdditionalAssignees(task: any): string {
    if (!task || !task.assignedTo || task.assignedTo.length <= 3) return '';

    const additionalAssignees = task.assignedTo.slice(3);
    return additionalAssignees.map((student: any) => student.fullName).join(', ');
  }
}
