import { Component, OnInit } from '@angular/core';
import { ProjectService } from '../project.service';

@Component({
  selector: 'app-project-stats',
  templateUrl: './project-stats.component.html',
  styleUrls: ['./project-stats.component.scss']
})
export class ProjectStatsComponent implements OnInit {
  loading = true;
  error = '';
  stats = {
    total: 0,
    planning: 0,
    inProgress: 0,
    completed: 0,
    onHold: 0,
    tasksTotal: 0,
    tasksCompleted: 0
  };

  constructor(private projectService: ProjectService) { }

  ngOnInit(): void {
    this.loadStats();
  }

  loadStats(): void {
    const token = localStorage.getItem('token');
    if (!token) return;

    this.loading = true;
    this.projectService.getAllProjects(token).subscribe({
      next: (projects: any[]) => {
        this.calculateStats(projects);
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading project stats:', err);
        this.error = 'Failed to load project statistics';
        this.loading = false;
      }
    });
  }

  calculateStats(projects: any[]): void {
    this.stats.total = projects.length;
    this.stats.planning = projects.filter(p => p.status === 'planning').length;
    this.stats.inProgress = projects.filter(p => p.status === 'in-progress').length;
    this.stats.completed = projects.filter(p => p.status === 'completed').length;
    this.stats.onHold = projects.filter(p => p.status === 'on-hold').length;
    
    // Calculate task statistics
    let tasksTotal = 0;
    let tasksCompleted = 0;
    
    projects.forEach(project => {
      if (project.tasks && Array.isArray(project.tasks)) {
        tasksTotal += project.tasks.length;
        tasksCompleted += project.tasks.filter((task: any) => task.status === 'completed').length;
      }
    });
    
    this.stats.tasksTotal = tasksTotal;
    this.stats.tasksCompleted = tasksCompleted;
  }

  getCompletionPercentage(): number {
    if (this.stats.total === 0) return 0;
    return Math.round((this.stats.completed / this.stats.total) * 100);
  }

  getTaskCompletionPercentage(): number {
    if (this.stats.tasksTotal === 0) return 0;
    return Math.round((this.stats.tasksCompleted / this.stats.tasksTotal) * 100);
  }
}
