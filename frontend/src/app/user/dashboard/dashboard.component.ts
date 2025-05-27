import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../auth/auth.service';
import { ProjectService } from '../../projects/project.service';
import { ThemeService } from '../../shared/theme.service';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  user: any = null;
  loading = true;
  error = '';
  projects: any[] = [];
  projectsLoading = false;
  projectsError = '';
  tasks: any[] = [];
  tasksLoading = false;
  tasksError = '';

  constructor(
    private authService: AuthService,
    private projectService: ProjectService,
    private router: Router,
    private themeService: ThemeService
  ) {}

  ngOnInit(): void {
    this.loadUserData();
  }

  loadUserData(): void {
    const token = localStorage.getItem('token');
    if (!token) {
      this.router.navigate(['/auth/login']);
      return;
    }

    this.loading = true;
    this.authService.getProfile(token).subscribe({
      next: (res: any) => {
        this.user = res;
        this.loading = false;
        this.loadUserProjects();
        this.loadUserTasks();
      },
      error: (err) => {
        this.error = 'Failed to load user data. Please try again.';
        this.loading = false;
      }
    });
  }

  loadUserTasks(): void {
    const token = localStorage.getItem('token');
    if (!token) {
      return;
    }

    this.tasksLoading = true;
    this.tasksError = '';

    // Make sure we have a user ID before trying to load tasks
    if (!this.user || !this.user._id) {
      console.log('User data not available yet, waiting for user data to load first');
      // Wait for user data to be available
      setTimeout(() => this.loadUserTasks(), 1000);
      return;
    }

    console.log('Loading tasks for user:', this.user._id);

    // Get tasks assigned to the current user
    this.projectService.getUserTasks(token).subscribe({
      next: (tasks: any) => {
        console.log('Tasks loaded successfully:', tasks);
        this.tasks = tasks || [];
        this.tasksLoading = false;
      },
      error: (err) => {
        console.error('Error loading tasks:', err);
        this.tasksError = `Failed to load tasks: ${err.status} ${err.statusText}. Please try again.`;
        this.tasksLoading = false;

        // Try to load tasks directly using a different approach
        this.tryAlternativeTaskLoading();
      }
    });
  }

  // Alternative method to try loading tasks if the main method fails
  tryAlternativeTaskLoading(): void {
    const token = localStorage.getItem('token');
    if (!token || !this.user || !this.user._id) {
      return;
    }

    console.log('Trying alternative task loading approach');

    // Try to get tasks from projects
    this.projectService.getAllProjects(token).subscribe({
      next: (projects: any[]) => {
        console.log('Loaded projects to extract tasks:', projects.length);

        // Initialize an empty array for tasks
        const allTasks: any[] = [];

        // Process each project to extract tasks
        projects.forEach(project => {
          if (project._id) {
            // Get tasks for this project
            this.projectService.getProjectTasks(project._id, token).subscribe({
              next: (tasks: any[]) => {
                console.log(`Loaded ${tasks.length} tasks from project ${project.title}`);

                // Filter tasks assigned to the current user
                const userTasks = tasks.filter(task =>
                  task.assignedTo &&
                  task.assignedTo.some((user: any) =>
                    user._id === this.user._id || user === this.user._id
                  )
                );

                if (userTasks.length > 0) {
                  console.log(`Found ${userTasks.length} tasks assigned to current user`);
                  allTasks.push(...userTasks);
                  this.tasks = [...allTasks];
                  this.tasksError = '';
                }
              },
              error: (err) => {
                console.error(`Error loading tasks for project ${project._id}:`, err);
              }
            });
          }
        });
      },
      error: (err) => {
        console.error('Error loading projects for alternative task loading:', err);
      }
    });
  }

  loadUserProjects(): void {
    const token = localStorage.getItem('token');
    if (!token) {
      return;
    }

    this.projectsLoading = true;
    // Get projects assigned to the current user
    this.projectService.getAllProjects(token, { assignedTo: this.user._id }).subscribe({
      next: (res: any) => {
        this.projects = res;
        this.projectsLoading = false;
      },
      error: (err) => {
        this.projectsError = 'Failed to load projects. Please try again.';
        this.projectsLoading = false;
      }
    });
  }

  getActiveProjects(): number {
    return this.projects.filter(p => p.status === 'in-progress').length;
  }

  getCompletedProjects(): number {
    return this.projects.filter(p => p.status === 'completed').length;
  }

  getPendingTasks(): number {
    return this.tasks.filter(task => task.status !== 'completed').length;
  }

  getUpcomingTasks(): any[] {
    // Get tasks that are due within the next 7 days and not completed
    const today = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(today.getDate() + 7);

    return this.tasks.filter(task => {
      if (task.status === 'completed') return false;
      if (!task.dueDate) return false;

      const dueDate = new Date(task.dueDate);
      return dueDate >= today && dueDate <= nextWeek;
    }).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }

  getOverdueTasks(): any[] {
    // Get tasks that are past due and not completed
    const today = new Date();

    return this.tasks.filter(task => {
      if (task.status === 'completed') return false;
      if (!task.dueDate) return false;

      const dueDate = new Date(task.dueDate);
      return dueDate < today;
    }).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }

  getRemainingTasks(): any[] {
    // Get tasks that are not in the overdue or upcoming categories
    const overdueTasks = this.getOverdueTasks();
    const upcomingTasks = this.getUpcomingTasks();

    return this.tasks.filter(task => {
      // Skip completed tasks
      if (task.status === 'completed') return false;

      // Skip tasks that are in the overdue or upcoming lists
      const isOverdue = overdueTasks.some(t => t._id === task._id);
      const isUpcoming = upcomingTasks.some(t => t._id === task._id);

      return !isOverdue && !isUpcoming;
    });
  }

  formatDate(dateString: string): string {
    if (!dateString) return 'No due date';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  navigateToTask(projectId: string, taskId: string): void {
    this.router.navigate(['/projects', projectId, 'tasks', taskId]);
  }

  navigateToProjects(): void {
    this.router.navigate(['/projects']);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/']);
  }
}
