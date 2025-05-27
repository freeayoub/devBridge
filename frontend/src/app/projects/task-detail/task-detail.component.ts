import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ProjectService } from '../project.service';

@Component({
  selector: 'app-task-detail',
  template: `
    <div class="container mx-auto px-4 py-8">
      <div *ngIf="loading" class="flex justify-center my-8">
        <div class="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
      </div>

      <div *ngIf="error" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
        {{ error }}
      </div>

      <div *ngIf="!loading && task" class="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <!-- Task Header -->
        <div class="flex justify-between items-start mb-6">
          <div>
            <h1 class="text-2xl font-bold">{{ task.title }}</h1>
            <div class="flex items-center mt-2">
              <span class="px-3 py-1 text-sm rounded-full mr-2"
                [ngClass]="{
                  'bg-gray-100 text-gray-800': task.status === 'pending',
                  'bg-blue-100 text-blue-800': task.status === 'in-progress',
                  'bg-yellow-100 text-yellow-800': task.status === 'review',
                  'bg-green-100 text-green-800': task.status === 'completed'
                }">
                {{ task.status }}
              </span>
              <span class="px-3 py-1 text-sm rounded-full mr-2"
                [ngClass]="{
                  'bg-green-100 text-green-800': task.priority === 'low',
                  'bg-blue-100 text-blue-800': task.priority === 'medium',
                  'bg-orange-100 text-orange-800': task.priority === 'high',
                  'bg-red-100 text-red-800': task.priority === 'urgent'
                }">
                {{ task.priority }} priority
              </span>
              <span class="text-gray-500 text-sm">
                Created by {{ task.createdBy?.fullName }}
              </span>
            </div>
          </div>

          <div class="flex space-x-2" *ngIf="canEditTask()">
            <button
              class="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
              (click)="editTask()">
              Edit Task
            </button>
            <button
              class="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
              (click)="deleteTask()">
              Delete
            </button>
          </div>
        </div>

        <!-- Task Details -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div class="col-span-2">
            <h2 class="text-lg font-semibold mb-2">Description</h2>
            <p class="text-gray-700 dark:text-gray-300 whitespace-pre-line">{{ task.description || 'No description provided.' }}</p>
          </div>

          <div>
            <div class="bg-gray-50 dark:bg-gray-700 p-4 rounded">
              <h2 class="text-lg font-semibold mb-3">Task Details</h2>

              <div class="space-y-3">
                <div>
                  <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">Project</h3>
                  <p class="cursor-pointer text-blue-600 hover:underline" (click)="navigateToProject()">
                    {{ task.project?.title }}
                  </p>
                </div>

                <div>
                  <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">Due Date</h3>
                  <p [ngClass]="{'text-red-600': isOverdue()}">{{ formatDate(task.dueDate) }}</p>
                </div>

                <div *ngIf="task.estimatedHours">
                  <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">Estimated Hours</h3>
                  <p>{{ task.estimatedHours }} hours</p>
                </div>

                <div *ngIf="task.actualHours">
                  <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">Actual Hours</h3>
                  <p>{{ task.actualHours }} hours</p>
                </div>

                <div *ngIf="task.completedDate">
                  <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">Completed On</h3>
                  <p>{{ formatDate(task.completedDate) }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Assigned Students -->
        <div class="mb-6">
          <h2 class="text-lg font-semibold mb-3">Assigned Students</h2>

          <div *ngIf="task.assignedTo && task.assignedTo.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div *ngFor="let student of task.assignedTo" class="flex items-center p-3 bg-gray-50 dark:bg-gray-700 rounded">
              <img [src]="student.profileImageURL || 'assets/default-avatar.png'" alt="{{ student.fullName }}" class="w-10 h-10 rounded-full mr-3">
              <div>
                <p class="font-medium">{{ student.fullName }}</p>
                <p class="text-sm text-gray-500 dark:text-gray-400">{{ student.email }}</p>
              </div>
            </div>
          </div>

          <div *ngIf="!task.assignedTo || task.assignedTo.length === 0" class="text-gray-500">
            No students assigned to this task.
          </div>
        </div>

        <!-- Update Status Section (for students) -->
        <div *ngIf="isAssignedToCurrentUser() && !isTaskCompleted()" class="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded">
          <h2 class="text-lg font-semibold mb-3">Update Task Status</h2>

          <form [formGroup]="statusForm" (ngSubmit)="updateTaskStatus()" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
              <select
                formControlName="status"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="pending">Pending</option>
                <option value="in-progress">In Progress</option>
                <option value="review">Ready for Review</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Actual Hours Spent</label>
              <input
                type="number"
                formControlName="actualHours"
                min="0"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              >
            </div>

            <button
              type="submit"
              [disabled]="statusForm.invalid || statusUpdating"
              class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Update Status
            </button>
          </form>
        </div>

        <!-- Submit Work Section (for students) -->
        <div *ngIf="isAssignedToCurrentUser() && !isTaskCompleted()" class="mb-6">
          <h2 class="text-lg font-semibold mb-3">Submit Your Work</h2>
          <button
            class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            (click)="navigateToSubmissionForm()"
          >
            Submit Work
          </button>
        </div>

        <!-- Submissions Section -->
        <div class="mb-6">
          <h2 class="text-lg font-semibold mb-3">Submissions</h2>

          <div *ngIf="submissions.length === 0" class="text-gray-500">
            No submissions yet.
          </div>

          <div *ngIf="submissions.length > 0" class="space-y-4">
            <div *ngFor="let submission of submissions" class="p-4 border border-gray-200 dark:border-gray-700 rounded">
              <div class="flex justify-between items-start">
                <div>
                  <h3 class="font-medium">{{ submission.title }}</h3>
                  <p class="text-sm text-gray-500 dark:text-gray-400">
                    Submitted by {{ submission.submittedBy?.fullName }} on {{ formatDate(submission.submittedAt) }}
                  </p>
                </div>
                <span class="px-2 py-1 text-xs rounded-full"
                  [ngClass]="{
                    'bg-yellow-100 text-yellow-800': submission.status === 'pending-review',
                    'bg-green-100 text-green-800': submission.status === 'approved',
                    'bg-orange-100 text-orange-800': submission.status === 'needs-revision',
                    'bg-red-100 text-red-800': submission.status === 'rejected'
                  }">
                  {{ submission.status }}
                </span>
              </div>

              <p *ngIf="submission.description" class="mt-2 text-gray-700 dark:text-gray-300">
                {{ submission.description }}
              </p>

              <div *ngIf="submission.files && submission.files.length > 0" class="mt-3">
                <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300">Files:</h4>
                <ul class="list-disc list-inside text-sm text-blue-600">
                  <li *ngFor="let file of submission.files" class="mt-1">
                    <a [href]="getFileUrl(file.path)" target="_blank" class="hover:underline">
                      {{ file.name }}
                    </a>
                  </li>
                </ul>
              </div>

              <div *ngIf="submission.links && submission.links.length > 0" class="mt-3">
                <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300">Links:</h4>
                <ul class="list-disc list-inside text-sm text-blue-600">
                  <li *ngFor="let link of submission.links" class="mt-1">
                    <a [href]="link.url" target="_blank" class="hover:underline">
                      {{ link.title || link.url }}
                    </a>
                  </li>
                </ul>
              </div>

              <button
                *ngIf="canReviewSubmissions()"
                class="mt-3 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                (click)="viewSubmissionDetails(submission._id)"
              >
                Review Submission
              </button>
            </div>
          </div>
        </div>

        <!-- Comments Section -->
        <div class="mb-6">
          <h2 class="text-lg font-semibold mb-3">Comments</h2>

          <div *ngIf="task.comments && task.comments.length > 0" class="space-y-4 mb-4">
            <div *ngFor="let comment of task.comments" class="p-3 bg-gray-50 dark:bg-gray-700 rounded">
              <p class="text-gray-700 dark:text-gray-300">{{ comment.text }}</p>
              <p class="text-xs text-gray-500 mt-1">
                {{ formatDate(comment.createdAt) }}
              </p>
            </div>
          </div>

          <form [formGroup]="commentForm" (ngSubmit)="addComment()" class="space-y-3">
            <textarea
              formControlName="comment"
              rows="3"
              placeholder="Add a comment..."
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            ></textarea>
            <button
              type="submit"
              [disabled]="commentForm.invalid || commentSubmitting"
              class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add Comment
            </button>
          </form>
        </div>

        <!-- Action Buttons -->
        <div class="flex justify-between mt-8">
          <button
            class="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
            (click)="navigateToProject()">
            Back to Project
          </button>
        </div>
      </div>
    </div>
  `,
  styles: []
})
export class TaskDetailComponent implements OnInit {
  taskId: string | null = null;
  projectId: string | null = null;
  task: any = null;
  submissions: any[] = [];
  loading = false;
  error = '';
  currentUser: any = null;

  // Forms
  statusForm: FormGroup;
  commentForm: FormGroup;

  // Form submission states
  statusUpdating = false;
  commentSubmitting = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private projectService: ProjectService
  ) {
    this.statusForm = this.fb.group({
      status: ['', Validators.required],
      actualHours: [null]
    });

    this.commentForm = this.fb.group({
      comment: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    this.taskId = this.route.snapshot.paramMap.get('taskId');
    this.projectId = this.route.snapshot.paramMap.get('projectId');
    this.loadUserData();

    if (this.taskId) {
      this.loadTask(this.taskId);
    } else {
      this.error = 'Task ID is missing';
    }
  }

  loadUserData(): void {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      this.currentUser = JSON.parse(userStr);
    }
  }

  loadTask(taskId: string): void {
    const token = localStorage.getItem('token');
    if (!token) {
      this.router.navigate(['/auth/login']);
      return;
    }

    this.loading = true;
    this.projectService.getTaskById(taskId, token).subscribe({
      next: (task) => {
        this.task = task;
        this.loading = false;

        // Set initial values for status form
        this.statusForm.patchValue({
          status: task.status,
          actualHours: task.actualHours
        });

        // Load submissions for this task
        this.loadSubmissions();
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to load task';
        this.loading = false;
      }
    });
  }

  loadSubmissions(): void {
    if (!this.taskId || !this.task.project?._id) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    this.projectService.getProjectSubmissions(this.task.project._id, token, { taskId: this.taskId }).subscribe({
      next: (response) => {
        this.submissions = response.submissions || [];
      },
      error: (err) => {
        console.error('Failed to load submissions:', err);
      }
    });
  }

  formatDate(dateString: string): string {
    if (!dateString) return 'Not set';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  isOverdue(): boolean {
    if (!this.task || !this.task.dueDate || this.task.status === 'completed') return false;

    const dueDate = new Date(this.task.dueDate);
    const today = new Date();

    return dueDate < today;
  }

  canEditTask(): boolean {
    if (!this.currentUser || !this.task) return false;

    // Admins can edit any task
    if (this.currentUser.role === 'admin') return true;

    // Teachers can edit tasks they created or in projects they created
    if (this.currentUser.role === 'teacher') {
      return this.task.createdBy?._id === this.currentUser._id ||
             this.task.project?.createdBy === this.currentUser._id;
    }

    return false;
  }

  isAssignedToCurrentUser(): boolean {
    if (!this.currentUser || !this.task || !this.task.assignedTo) return false;

    return this.task.assignedTo.some((student: any) => student._id === this.currentUser._id);
  }

  isTaskCompleted(): boolean {
    return this.task && this.task.status === 'completed';
  }

  canReviewSubmissions(): boolean {
    if (!this.currentUser) return false;

    return this.currentUser.role === 'admin' || this.currentUser.role === 'teacher';
  }

  updateTaskStatus(): void {
    if (this.statusForm.invalid || !this.taskId) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    this.statusUpdating = true;
    const statusData = this.statusForm.value;

    this.projectService.updateTask(this.taskId, statusData, token).subscribe({
      next: (response) => {
        this.task = response.task;
        this.statusUpdating = false;
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to update task status';
        this.statusUpdating = false;
      }
    });
  }

  addComment(): void {
    if (this.commentForm.invalid || !this.taskId) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    this.commentSubmitting = true;
    const comment = this.commentForm.value.comment;

    this.projectService.addTaskComment(this.taskId, comment, token).subscribe({
      next: (response) => {
        // Update the task with the new comment
        this.task = response.task;
        this.commentSubmitting = false;
        this.commentForm.reset();
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to add comment';
        this.commentSubmitting = false;
      }
    });
  }

  editTask(): void {
    if (this.taskId && this.task.project?._id) {
      this.router.navigate(['/projects', this.task.project._id, 'tasks', this.taskId, 'edit']);
    }
  }

  deleteTask(): void {
    if (!confirm('Are you sure you want to delete this task? This action cannot be undone.')) {
      return;
    }

    const token = localStorage.getItem('token');
    if (!token || !this.taskId) return;

    this.loading = true;
    this.projectService.deleteTask(this.taskId, token).subscribe({
      next: () => {
        this.loading = false;
        this.navigateToProject();
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to delete task';
        this.loading = false;
      }
    });
  }

  navigateToProject(): void {
    if (this.task && this.task.project?._id) {
      this.router.navigate(['/projects', this.task.project._id]);
    } else if (this.projectId) {
      this.router.navigate(['/projects', this.projectId]);
    } else {
      this.router.navigate(['/projects']);
    }
  }

  navigateToSubmissionForm(): void {
    if (this.taskId && this.task.project?._id) {
      this.router.navigate(['/projects', this.task.project._id, 'tasks', this.taskId, 'submit']);
    }
  }

  viewSubmissionDetails(submissionId: string): void {
    this.router.navigate(['/projects/submissions', submissionId]);
  }

  getFileUrl(filePath: string): string {
    // Assuming the backend serves files from a '/uploads' endpoint
    if (filePath.startsWith('http')) {
      return filePath;
    }
    return `${this.projectService.getApiBaseUrl()}/uploads/${filePath.split('/').pop()}`;
  }
}
