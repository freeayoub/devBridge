import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ProjectService } from '../project.service';

@Component({
  selector: 'app-submission-form',
  template: `
    <div class="container mx-auto px-4 py-8">
      <div class="max-w-3xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <h1 class="text-2xl font-bold mb-6">Submit Your Work</h1>

        <div *ngIf="loading" class="flex justify-center my-8">
          <div class="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>

        <div *ngIf="error" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {{ error }}
        </div>

        <div *ngIf="success" class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {{ success }}
        </div>

        <div *ngIf="project && task" class="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded">
          <h2 class="font-semibold">Submitting for:</h2>
          <p class="mt-1">Project: <span class="font-medium">{{ project.title }}</span></p>
          <p class="mt-1">Task: <span class="font-medium">{{ task.title }}</span></p>
          <p class="mt-1" [ngClass]="{'text-red-600': isOverdue()}">
            Due Date: <span class="font-medium">{{ formatDate(task.dueDate) }}</span>
            <span *ngIf="isOverdue()" class="ml-2 text-red-600">(Overdue)</span>
          </p>
        </div>

        <form *ngIf="!loading" [formGroup]="submissionForm" (ngSubmit)="onSubmit()" class="space-y-6">
          <!-- Submission Title -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Submission Title*</label>
            <input
              type="text"
              formControlName="title"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            >
            <div *ngIf="submissionForm.get('title')?.invalid && submissionForm.get('title')?.touched" class="text-red-500 text-xs mt-1">
              Title is required
            </div>
          </div>

          <!-- Submission Description -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
            <textarea
              formControlName="description"
              rows="4"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            ></textarea>
          </div>

          <!-- File Upload -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Upload Files</label>
            <div class="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-md">
              <div class="space-y-1 text-center">
                <svg class="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                  <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
                <div class="flex text-sm text-gray-600 dark:text-gray-400">
                  <label for="file-upload" class="relative cursor-pointer bg-white dark:bg-gray-700 rounded-md font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500 focus-within:outline-none">
                    <span>Upload files</span>
                    <input id="file-upload" name="file-upload" type="file" class="sr-only" multiple (change)="onFileChange($event)">
                  </label>
                  <p class="pl-1">or drag and drop</p>
                </div>
                <p class="text-xs text-gray-500 dark:text-gray-400">
                  Upload up to 5 files (10MB max each)
                </p>
              </div>
            </div>
            <div *ngIf="selectedFiles.length > 0" class="mt-2">
              <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300">Selected Files:</h3>
              <ul class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                <li *ngFor="let file of selectedFiles" class="flex items-center justify-between py-1">
                  <span>{{ file.name }} ({{ formatFileSize(file.size) }})</span>
                  <button
                    type="button"
                    class="text-red-500 hover:text-red-700"
                    (click)="removeFile(file)"
                  >
                    Remove
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <!-- Links -->
          <div formArrayName="links">
            <div class="flex justify-between items-center mb-2">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Add Links</label>
              <button
                type="button"
                class="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                (click)="addLink()"
              >
                Add Link
              </button>
            </div>

            <div *ngFor="let link of links.controls; let i = index" class="mb-2 flex space-x-2">
              <div class="flex-grow" [formGroupName]="i">
                <div class="grid grid-cols-3 gap-2">
                  <div class="col-span-1">
                    <input
                      type="text"
                      formControlName="title"
                      placeholder="Title (optional)"
                      class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                    >
                  </div>
                  <div class="col-span-2">
                    <input
                      type="url"
                      formControlName="url"
                      placeholder="URL (e.g., https://github.com/...)"
                      class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                    >
                    <div *ngIf="link.get('url')?.invalid && link.get('url')?.touched" class="text-red-500 text-xs mt-1">
                      Please enter a valid URL
                    </div>
                  </div>
                </div>
              </div>
              <button
                type="button"
                class="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 self-start mt-1"
                (click)="removeLink(i)"
              >
                Remove
              </button>
            </div>
          </div>

          <!-- Form Actions -->
          <div class="flex justify-between">
            <button
              type="button"
              class="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
              (click)="goBack()"
            >
              Cancel
            </button>
            <button
              type="submit"
              [disabled]="submissionForm.invalid || submitting"
              class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Submit Work
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
  styles: []
})
export class SubmissionFormComponent implements OnInit {
  submissionForm: FormGroup;
  projectId: string | null = null;
  taskId: string | null = null;
  project: any = null;
  task: any = null;
  loading = false;
  submitting = false;
  error = '';
  success = '';
  selectedFiles: File[] = [];

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private projectService: ProjectService
  ) {
    this.submissionForm = this.fb.group({
      title: ['', Validators.required],
      description: [''],
      links: this.fb.array([])
    });
  }

  ngOnInit(): void {
    this.projectId = this.route.snapshot.paramMap.get('projectId');
    this.taskId = this.route.snapshot.paramMap.get('taskId');

    if (!this.projectId || !this.taskId) {
      this.error = 'Project ID or Task ID is missing';
      return;
    }

    this.loadData();
  }

  get links(): FormArray {
    return this.submissionForm.get('links') as FormArray;
  }

  loadData(): void {
    const token = localStorage.getItem('token');
    if (!token) {
      this.router.navigate(['/auth/login']);
      return;
    }

    this.loading = true;

    // Load project and task data
    this.projectService.getProjectById(this.projectId!, token).subscribe({
      next: (project) => {
        this.project = project;

        // Now load the task
        this.projectService.getTaskById(this.taskId!, token).subscribe({
          next: (task) => {
            this.task = task;
            this.loading = false;
          },
          error: (err) => {
            this.error = err.error?.message || 'Failed to load task';
            this.loading = false;
          }
        });
      },
      error: (err) => {
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

  isOverdue(): boolean {
    if (!this.task || !this.task.dueDate) return false;

    const dueDate = new Date(this.task.dueDate);
    const today = new Date();

    return dueDate < today;
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  onFileChange(event: any): void {
    const files = event.target.files;

    if (files) {
      // Check if adding these files would exceed the limit
      if (this.selectedFiles.length + files.length > 5) {
        this.error = 'You can only upload up to 5 files';
        return;
      }

      // Add files to the selectedFiles array
      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // Check file size (10MB limit)
        if (file.size > 10 * 1024 * 1024) {
          this.error = `File ${file.name} exceeds the 10MB size limit`;
          continue;
        }

        this.selectedFiles.push(file);
      }
    }
  }

  removeFile(file: File): void {
    this.selectedFiles = this.selectedFiles.filter(f => f !== file);
  }

  addLink(): void {
    this.links.push(this.fb.group({
      title: [''],
      url: ['', [Validators.required, Validators.pattern('https?://.+')]]
    }));
  }

  removeLink(index: number): void {
    this.links.removeAt(index);
  }

  onSubmit(): void {
    if (this.submissionForm.invalid) {
      // Mark all fields as touched to trigger validation messages
      Object.keys(this.submissionForm.controls).forEach(key => {
        const control = this.submissionForm.get(key);
        if (control instanceof FormArray) {
          for (let i = 0; i < control.length; i++) {
            const formGroup = control.at(i) as FormGroup;
            Object.keys(formGroup.controls).forEach(k => {
              formGroup.get(k)?.markAsTouched();
            });
          }
        } else {
          control?.markAsTouched();
        }
      });
      return;
    }

    const token = localStorage.getItem('token');
    if (!token || !this.projectId || !this.taskId) {
      this.router.navigate(['/auth/login']);
      return;
    }

    this.submitting = true;
    this.error = '';
    this.success = '';

    // Prepare form data for submission
    const formData = new FormData();
    formData.append('title', this.submissionForm.value.title);
    formData.append('description', this.submissionForm.value.description || '');
    formData.append('projectId', this.projectId);
    formData.append('taskId', this.taskId);

    // Add files
    this.selectedFiles.forEach(file => {
      formData.append('files', file);
    });

    // Add links
    if (this.links.length > 0) {
      formData.append('links', JSON.stringify(this.submissionForm.value.links));
    }

    this.projectService.createSubmission(this.projectId, formData, token).subscribe({
      next: (response) => {
        this.success = 'Work submitted successfully!';
        this.submitting = false;

        // Also update the task status to 'review'
        const taskData = { status: 'review' };
        this.projectService.updateTask(this.taskId!, taskData, token).subscribe();

        // Navigate back to task detail after a short delay
        setTimeout(() => {
          this.router.navigate(['/projects', this.projectId, 'tasks', this.taskId]);
        }, 1500);
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to submit work. Please try again.';
        this.submitting = false;
      }
    });
  }

  goBack(): void {
    if (this.projectId && this.taskId) {
      this.router.navigate(['/projects', this.projectId, 'tasks', this.taskId]);
    } else if (this.projectId) {
      this.router.navigate(['/projects', this.projectId]);
    } else {
      this.router.navigate(['/projects']);
    }
  }
}
