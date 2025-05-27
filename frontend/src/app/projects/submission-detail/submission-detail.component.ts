import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ProjectService } from '../project.service';

@Component({
  selector: 'app-submission-detail',
  template: `
    <div class="container mx-auto px-4 py-8">
      <div *ngIf="loading" class="flex justify-center my-8">
        <div class="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
      </div>

      <div *ngIf="error" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
        {{ error }}
      </div>

      <div *ngIf="success" class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
        {{ success }}
      </div>

      <div *ngIf="!loading && submission" class="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <!-- Submission Header -->
        <div class="flex justify-between items-start mb-6">
          <div>
            <h1 class="text-2xl font-bold">{{ submission.title }}</h1>
            <div class="flex items-center mt-2">
              <span class="px-3 py-1 text-sm rounded-full mr-2"
                [ngClass]="{
                  'bg-yellow-100 text-yellow-800': submission.status === 'pending-review',
                  'bg-green-100 text-green-800': submission.status === 'approved',
                  'bg-orange-100 text-orange-800': submission.status === 'needs-revision',
                  'bg-red-100 text-red-800': submission.status === 'rejected'
                }">
                {{ submission.status }}
              </span>
              <span class="text-gray-500 text-sm">
                Submitted by {{ submission.submittedBy?.fullName }} on {{ formatDate(submission.submittedAt) }}
              </span>
            </div>
          </div>
        </div>

        <!-- Submission Details -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div class="col-span-2">
            <h2 class="text-lg font-semibold mb-2">Description</h2>
            <p class="text-gray-700 dark:text-gray-300 whitespace-pre-line">{{ submission.description || 'No description provided.' }}</p>

            <!-- Files -->
            <div *ngIf="submission.files && submission.files.length > 0" class="mt-6">
              <h2 class="text-lg font-semibold mb-2">Files</h2>
              <div class="grid grid-cols-1 gap-3">
                <div *ngFor="let file of submission.files" class="p-3 bg-gray-50 dark:bg-gray-700 rounded flex justify-between items-center">
                  <div>
                    <p class="font-medium">{{ file.name }}</p>
                    <p class="text-sm text-gray-500">{{ formatFileSize(file.size) }}</p>
                  </div>
                  <a 
                    [href]="getFileUrl(file.path)" 
                    target="_blank" 
                    class="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                  >
                    Download
                  </a>
                </div>
              </div>
            </div>

            <!-- Links -->
            <div *ngIf="submission.links && submission.links.length > 0" class="mt-6">
              <h2 class="text-lg font-semibold mb-2">Links</h2>
              <div class="grid grid-cols-1 gap-3">
                <div *ngFor="let link of submission.links" class="p-3 bg-gray-50 dark:bg-gray-700 rounded flex justify-between items-center">
                  <p class="font-medium">{{ link.title || link.url }}</p>
                  <a 
                    [href]="link.url" 
                    target="_blank" 
                    class="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                  >
                    Open Link
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div>
            <div class="bg-gray-50 dark:bg-gray-700 p-4 rounded">
              <h2 class="text-lg font-semibold mb-3">Submission Details</h2>

              <div class="space-y-3">
                <div>
                  <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">Project</h3>
                  <p class="cursor-pointer text-blue-600 hover:underline" (click)="navigateToProject()">
                    {{ submission.project?.title }}
                  </p>
                </div>

                <div *ngIf="submission.task">
                  <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">Task</h3>
                  <p class="cursor-pointer text-blue-600 hover:underline" (click)="navigateToTask()">
                    {{ submission.task?.title }}
                  </p>
                </div>

                <div *ngIf="submission.grade && submission.grade.value !== undefined">
                  <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">Grade</h3>
                  <p class="font-bold text-lg">{{ submission.grade.value }}/100</p>
                  <p *ngIf="submission.grade.comments" class="text-sm mt-1">{{ submission.grade.comments }}</p>
                  <p *ngIf="submission.grade.gradedBy" class="text-xs text-gray-500 mt-1">
                    Graded by {{ submission.grade.gradedBy.fullName }} on {{ formatDate(submission.grade.gradedAt) }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Feedback Section -->
        <div class="mb-6">
          <h2 class="text-lg font-semibold mb-3">Feedback</h2>
          
          <div *ngIf="submission.feedback && submission.feedback.length > 0" class="space-y-4 mb-4">
            <div *ngFor="let feedback of submission.feedback" class="p-4 bg-gray-50 dark:bg-gray-700 rounded">
              <div class="flex items-center mb-2">
                <div class="flex-1">
                  <p class="font-medium">{{ feedback.givenBy?.fullName }}</p>
                  <p class="text-xs text-gray-500">{{ formatDate(feedback.givenAt) }}</p>
                </div>
                <div *ngIf="feedback.rating" class="flex">
                  <span *ngFor="let star of [1,2,3,4,5]" class="text-yellow-400">
                    <svg *ngIf="star <= feedback.rating" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    <svg *ngIf="star > feedback.rating" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                  </span>
                </div>
              </div>
              <p class="text-gray-700 dark:text-gray-300">{{ feedback.comment }}</p>
            </div>
          </div>

          <div *ngIf="!submission.feedback || submission.feedback.length === 0" class="text-gray-500 mb-4">
            No feedback provided yet.
          </div>

          <!-- Add Feedback Form (for teachers/admins) -->
          <div *ngIf="canReviewSubmission()" class="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded">
            <h3 class="font-medium mb-3">Add Feedback</h3>
            <form [formGroup]="feedbackForm" (ngSubmit)="addFeedback()" class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Comment</label>
                <textarea
                  formControlName="comment"
                  rows="3"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                ></textarea>
                <div *ngIf="feedbackForm.get('comment')?.invalid && feedbackForm.get('comment')?.touched" class="text-red-500 text-xs mt-1">
                  Comment is required
                </div>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rating</label>
                <div class="flex">
                  <button 
                    *ngFor="let star of [1,2,3,4,5]" 
                    type="button"
                    class="text-gray-300 hover:text-yellow-400 focus:outline-none"
                    [ngClass]="{'text-yellow-400': star <= feedbackForm.get('rating')?.value}"
                    (click)="setRating(star)"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" stroke="none">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                [disabled]="feedbackForm.invalid || submitting"
                class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Feedback
              </button>
            </form>
          </div>
        </div>

        <!-- Grading Section (for teachers/admins) -->
        <div *ngIf="canReviewSubmission()" class="mb-6">
          <h2 class="text-lg font-semibold mb-3">Grade Submission</h2>
          
          <form [formGroup]="gradeForm" (ngSubmit)="gradeSubmission()" class="p-4 bg-gray-50 dark:bg-gray-700 rounded space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Grade (0-100)</label>
              <input
                type="number"
                formControlName="value"
                min="0"
                max="100"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              >
              <div *ngIf="gradeForm.get('value')?.invalid && gradeForm.get('value')?.touched" class="text-red-500 text-xs mt-1">
                Grade must be between 0 and 100
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Comments</label>
              <textarea
                formControlName="comments"
                rows="3"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              ></textarea>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Submission Status</label>
              <select
                formControlName="status"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="pending-review">Pending Review</option>
                <option value="approved">Approved</option>
                <option value="needs-revision">Needs Revision</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            <button
              type="submit"
              [disabled]="gradeForm.invalid || submitting"
              class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save Grade
            </button>
          </form>
        </div>

        <!-- Action Buttons -->
        <div class="flex justify-between mt-8">
          <button
            class="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
            (click)="goBack()">
            Back
          </button>
        </div>
      </div>
    </div>
  `,
  styles: []
})
export class SubmissionDetailComponent implements OnInit {
  submissionId: string | null = null;
  submission: any = null;
  loading = false;
  submitting = false;
  error = '';
  success = '';
  currentUser: any = null;
  
  // Forms
  feedbackForm: FormGroup;
  gradeForm: FormGroup;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private projectService: ProjectService
  ) {
    this.feedbackForm = this.fb.group({
      comment: ['', Validators.required],
      rating: [0]
    });

    this.gradeForm = this.fb.group({
      value: [null, [Validators.required, Validators.min(0), Validators.max(100)]],
      comments: [''],
      status: ['approved']
    });
  }

  ngOnInit(): void {
    this.submissionId = this.route.snapshot.paramMap.get('submissionId');
    this.loadUserData();
    
    if (this.submissionId) {
      this.loadSubmission(this.submissionId);
    } else {
      this.error = 'Submission ID is missing';
    }
  }

  loadUserData(): void {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      this.currentUser = JSON.parse(userStr);
    }
  }

  loadSubmission(submissionId: string): void {
    const token = localStorage.getItem('token');
    if (!token) {
      this.router.navigate(['/auth/login']);
      return;
    }

    this.loading = true;
    this.projectService.getSubmissionById(submissionId, token).subscribe({
      next: (submission) => {
        this.submission = submission;
        this.loading = false;
        
        // If submission has a grade, populate the grade form
        if (submission.grade && submission.grade.value !== undefined) {
          this.gradeForm.patchValue({
            value: submission.grade.value,
            comments: submission.grade.comments || '',
            status: submission.status
          });
        } else {
          // Default to current status
          this.gradeForm.patchValue({
            status: submission.status
          });
        }
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to load submission';
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
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  canReviewSubmission(): boolean {
    if (!this.currentUser) return false;
    
    return this.currentUser.role === 'admin' || this.currentUser.role === 'teacher';
  }

  setRating(rating: number): void {
    this.feedbackForm.patchValue({ rating });
  }

  addFeedback(): void {
    if (this.feedbackForm.invalid || !this.submissionId) return;
    
    const token = localStorage.getItem('token');
    if (!token) return;
    
    this.submitting = true;
    const feedbackData = this.feedbackForm.value;
    
    this.projectService.addFeedback(this.submissionId, feedbackData, token).subscribe({
      next: (response) => {
        this.submission = response.submission;
        this.submitting = false;
        this.success = 'Feedback added successfully';
        this.feedbackForm.reset({ rating: 0 });
        
        // Auto-hide success message after 3 seconds
        setTimeout(() => {
          this.success = '';
        }, 3000);
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to add feedback';
        this.submitting = false;
        
        // Auto-hide error message after 3 seconds
        setTimeout(() => {
          this.error = '';
        }, 3000);
      }
    });
  }

  gradeSubmission(): void {
    if (this.gradeForm.invalid || !this.submissionId) return;
    
    const token = localStorage.getItem('token');
    if (!token) return;
    
    this.submitting = true;
    const gradeData = {
      ...this.gradeForm.value,
      status: this.gradeForm.value.status
    };
    
    this.projectService.gradeSubmission(this.submissionId, gradeData, token).subscribe({
      next: (response) => {
        this.submission = response.submission;
        this.submitting = false;
        this.success = 'Submission graded successfully';
        
        // Auto-hide success message after 3 seconds
        setTimeout(() => {
          this.success = '';
        }, 3000);
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to grade submission';
        this.submitting = false;
        
        // Auto-hide error message after 3 seconds
        setTimeout(() => {
          this.error = '';
        }, 3000);
      }
    });
  }

  navigateToProject(): void {
    if (this.submission && this.submission.project?._id) {
      this.router.navigate(['/projects', this.submission.project._id]);
    } else {
      this.router.navigate(['/projects']);
    }
  }

  navigateToTask(): void {
    if (this.submission && this.submission.task?._id && this.submission.project?._id) {
      this.router.navigate(['/projects', this.submission.project._id, 'tasks', this.submission.task._id]);
    }
  }

  goBack(): void {
    if (this.submission && this.submission.task?._id && this.submission.project?._id) {
      this.router.navigate(['/projects', this.submission.project._id, 'tasks', this.submission.task._id]);
    } else if (this.submission && this.submission.project?._id) {
      this.router.navigate(['/projects', this.submission.project._id]);
    } else {
      this.router.navigate(['/projects']);
    }
  }

  getFileUrl(filePath: string): string {
    // Assuming the backend serves files from a '/uploads' endpoint
    if (filePath.startsWith('http')) {
      return filePath;
    }
    return `${this.projectService.getApiBaseUrl()}/uploads/${filePath.split('/').pop()}`;
  }
}
