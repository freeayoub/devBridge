import { Component, OnInit, Input } from '@angular/core';
import { Router } from '@angular/router';
import { ProjectService } from '../project.service';

@Component({
  selector: 'app-project-kanban',
  templateUrl: './project-kanban.component.html',
  styleUrls: ['./project-kanban.component.scss']
})
export class ProjectKanbanComponent implements OnInit {
  @Input() projectId: string | null = null;
  
  loading = true;
  error = '';
  project: any = null;
  
  pendingTasks: any[] = [];
  inProgressTasks: any[] = [];
  reviewTasks: any[] = [];
  completedTasks: any[] = [];
  
  constructor(
    private projectService: ProjectService,
    private router: Router
  ) { }

  ngOnInit(): void {
    if (this.projectId) {
      this.loadProject(this.projectId);
    }
  }
  
  ngOnChanges(): void {
    if (this.projectId) {
      this.loadProject(this.projectId);
    }
  }
  
  loadProject(projectId: string): void {
    const token = localStorage.getItem('token');
    if (!token) {
      this.router.navigate(['/auth/login']);
      return;
    }

    this.loading = true;
    this.projectService.getProjectById(projectId, token).subscribe({
      next: (project) => {
        this.project = project;
        this.organizeTasks();
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading project for kanban:', err);
        this.error = err.error?.message || 'Failed to load project';
        this.loading = false;
      }
    });
  }
  
  organizeTasks(): void {
    if (!this.project || !this.project.tasks) return;
    
    this.pendingTasks = this.project.tasks.filter((task: any) => task.status === 'pending');
    this.inProgressTasks = this.project.tasks.filter((task: any) => task.status === 'in-progress');
    this.reviewTasks = this.project.tasks.filter((task: any) => task.status === 'review');
    this.completedTasks = this.project.tasks.filter((task: any) => task.status === 'completed');
  }
  
  updateTaskStatus(taskId: string, newStatus: string): void {
    const token = localStorage.getItem('token');
    if (!token || !this.projectId) return;
    
    const task = this.findTaskById(taskId);
    if (!task) return;
    
    const updatedTask = { ...task, status: newStatus };
    
    this.projectService.updateTask(taskId, updatedTask, token).subscribe({
      next: () => {
        // Update the task in our local data
        task.status = newStatus;
        this.organizeTasks();
      },
      error: (err) => {
        console.error('Error updating task status:', err);
        // Revert the change in the UI
        this.organizeTasks();
      }
    });
  }
  
  findTaskById(taskId: string): any {
    if (!this.project || !this.project.tasks) return null;
    
    return this.project.tasks.find((task: any) => task._id === taskId);
  }
  
  viewTaskDetails(taskId: string): void {
    if (this.projectId) {
      this.router.navigate(['/projects', this.projectId, 'tasks', taskId]);
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
  
  isTaskOverdue(task: any): boolean {
    if (!task || !task.dueDate || task.status === 'completed') return false;
    
    const dueDate = new Date(task.dueDate);
    const today = new Date();
    
    return dueDate < today;
  }
  
  getPriorityClass(priority: string): string {
    switch (priority) {
      case 'low':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
      case 'medium':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300';
      case 'high':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300';
      case 'urgent':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  }
}
