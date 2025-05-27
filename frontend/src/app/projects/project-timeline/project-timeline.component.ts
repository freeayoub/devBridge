import { Component, OnInit, Input } from '@angular/core';

@Component({
  selector: 'app-project-timeline',
  templateUrl: './project-timeline.component.html',
  styleUrls: ['./project-timeline.component.scss']
})
export class ProjectTimelineComponent implements OnInit {
  @Input() project: any;
  timelineEvents: any[] = [];
  
  constructor() { }

  ngOnInit(): void {
    this.generateTimelineEvents();
  }
  
  ngOnChanges(): void {
    this.generateTimelineEvents();
  }

  generateTimelineEvents(): void {
    if (!this.project) return;
    
    this.timelineEvents = [];
    
    // Add project creation
    if (this.project.createdAt) {
      this.timelineEvents.push({
        date: new Date(this.project.createdAt),
        title: 'Project Created',
        description: `Project "${this.project.title}" was created`,
        icon: 'create',
        type: 'project'
      });
    }
    
    // Add project status changes if available
    if (this.project.statusHistory && this.project.statusHistory.length > 0) {
      this.project.statusHistory.forEach((statusChange: any) => {
        this.timelineEvents.push({
          date: new Date(statusChange.date),
          title: 'Status Changed',
          description: `Project status changed to "${statusChange.status}"`,
          icon: 'status',
          type: 'status',
          status: statusChange.status
        });
      });
    }
    
    // Add tasks
    if (this.project.tasks && this.project.tasks.length > 0) {
      this.project.tasks.forEach((task: any) => {
        this.timelineEvents.push({
          date: new Date(task.createdAt),
          title: 'Task Created',
          description: `Task "${task.title}" was created`,
          icon: 'task',
          type: 'task',
          taskId: task._id
        });
        
        if (task.status === 'completed' && task.completedAt) {
          this.timelineEvents.push({
            date: new Date(task.completedAt),
            title: 'Task Completed',
            description: `Task "${task.title}" was completed`,
            icon: 'complete',
            type: 'task-complete',
            taskId: task._id
          });
        }
      });
    }
    
    // Sort events by date
    this.timelineEvents.sort((a, b) => b.date.getTime() - a.date.getTime());
    
    // Limit to most recent 10 events
    this.timelineEvents = this.timelineEvents.slice(0, 10);
  }
  
  formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
  
  getTimeAgo(date: Date): string {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) {
      return `${diffInSeconds} seconds ago`;
    }
    
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
      return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
    }
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    }
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 30) {
      return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
    }
    
    const diffInMonths = Math.floor(diffInDays / 30);
    if (diffInMonths < 12) {
      return `${diffInMonths} month${diffInMonths > 1 ? 's' : ''} ago`;
    }
    
    const diffInYears = Math.floor(diffInMonths / 12);
    return `${diffInYears} year${diffInYears > 1 ? 's' : ''} ago`;
  }
  
  getIconClass(type: string): string {
    switch (type) {
      case 'project':
        return 'bg-blue-100 dark:bg-blue-900/20 text-blue-500';
      case 'status':
        return 'bg-purple-100 dark:bg-purple-900/20 text-purple-500';
      case 'task':
        return 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-500';
      case 'task-complete':
        return 'bg-green-100 dark:bg-green-900/20 text-green-500';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-500';
    }
  }
  
  getStatusClass(status: string): string {
    switch (status) {
      case 'planning':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300';
      case 'in-progress':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
      case 'on-hold':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  }
}
