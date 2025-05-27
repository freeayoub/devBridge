import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ProjectService } from '../project.service';
import { UserService } from '../../shared/user.service';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-project-form',
  template: `
    <div class="container mx-auto px-4 py-8">
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <h1 class="text-2xl font-bold mb-4">{{ isEditMode ? 'Edit Project' : 'Create New Project' }}</h1>

        <div *ngIf="error" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {{ error }}
        </div>

        <div *ngIf="success" class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {{ success }}
        </div>

        <div *ngIf="loading" class="flex justify-center my-8">
          <div class="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>

        <form *ngIf="!loading" [formGroup]="projectForm" (ngSubmit)="onSubmit()" class="space-y-6">
          <!-- Project Title -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Project Title*</label>
            <input
              type="text"
              formControlName="title"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            >
            <div *ngIf="projectForm.get('title')?.invalid && projectForm.get('title')?.touched" class="text-red-500 text-xs mt-1">
              Title is required
            </div>
          </div>

          <!-- Project Description -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description*</label>
            <textarea
              formControlName="description"
              rows="4"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            ></textarea>
            <div *ngIf="projectForm.get('description')?.invalid && projectForm.get('description')?.touched" class="text-red-500 text-xs mt-1">
              Description is required
            </div>
          </div>

          <!-- Project Dates -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date*</label>
              <input
                type="date"
                formControlName="startDate"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              >
              <div *ngIf="projectForm.get('startDate')?.invalid && projectForm.get('startDate')?.touched" class="text-red-500 text-xs mt-1">
                Start date is required
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date*</label>
              <input
                type="date"
                formControlName="endDate"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              >
              <div *ngIf="projectForm.get('endDate')?.invalid && projectForm.get('endDate')?.touched" class="text-red-500 text-xs mt-1">
                End date is required
              </div>
            </div>
          </div>

          <!-- Project Status -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
            <select
              formControlName="status"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="planning">Planning</option>
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="on-hold">On Hold</option>
            </select>
          </div>

          <!-- Assign to Students -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Assign to Students</label>
            <div class="max-h-60 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-md p-2">
              <div *ngFor="let student of students" class="flex items-center mb-2">
                <input
                  type="checkbox"
                  [id]="'student-' + student._id"
                  [value]="student._id"
                  (change)="onStudentSelectionChange($event)"
                  class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                >
                <label [for]="'student-' + student._id" class="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                  {{ student.fullName }} ({{ student.email }})
                </label>
              </div>
              <div *ngIf="students.length === 0" class="text-gray-500 text-sm">
                No students available
              </div>
            </div>
          </div>

          <!-- Assign to Group -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Assign to Group</label>
            <select
              formControlName="assignedGroup"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="">None</option>
              <option *ngFor="let group of groups" [value]="group._id">{{ group.name }}</option>
            </select>
          </div>

          <!-- Tags -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tags (comma separated)</label>
            <input
              type="text"
              formControlName="tags"
              placeholder="e.g. web, development, design"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            >
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
              [disabled]="projectForm.invalid || submitting"
              class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{ isEditMode ? 'Update Project' : 'Create Project' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
  styles: []
})
export class ProjectFormComponent implements OnInit {
  projectForm!: FormGroup;
  isEditMode = false;
  projectId: string | null = null;
  loading = false;
  submitting = false;
  error = '';
  success = '';
  students: any[] = [];
  groups: any[] = [];
  selectedStudents: string[] = [];

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private projectService: ProjectService,
    private userService: UserService
  ) {}

  ngOnInit(): void {
    this.projectId = this.route.snapshot.paramMap.get('id');
    this.isEditMode = !!this.projectId;

    this.initForm();
    this.loadData();
  }

  initForm(): void {
    this.projectForm = this.fb.group({
      title: ['', [Validators.required]],
      description: ['', [Validators.required]],
      startDate: ['', [Validators.required]],
      endDate: ['', [Validators.required]],
      status: ['planning'],
      assignedTo: [[]],
      assignedGroup: [''],
      tags: ['']
    });
  }

  loadData(): void {
    const token = localStorage.getItem('token');
    if (!token) {
      this.router.navigate(['/auth/login']);
      return;
    }

    this.loading = true;

    // Load students and groups in parallel
    const sources: any = {
      students: this.userService.getStudents(token),
      groups: this.userService.getGroups(token)
    };

    // Only add project to sources if we're in edit mode
    if (this.isEditMode && this.projectId) {
      sources.project = this.projectService.getProjectById(this.projectId, token);
    }

    forkJoin(sources).subscribe({
      next: (results: any) => {
        this.students = results.students || [];
        this.groups = results.groups || [];

        // If editing, populate the form with project data
        if (this.isEditMode && results.project) {
          const project = results.project;

          // Format dates for the date inputs (YYYY-MM-DD)
          const startDate = project.startDate ? new Date(project.startDate).toISOString().split('T')[0] : '';
          const endDate = project.endDate ? new Date(project.endDate).toISOString().split('T')[0] : '';

          // Format tags from array to comma-separated string
          const tagsString = project.tags ? project.tags.join(', ') : '';

          this.projectForm.patchValue({
            title: project.title,
            description: project.description,
            startDate: startDate,
            endDate: endDate,
            status: project.status,
            assignedGroup: project.assignedGroup?._id || '',
            tags: tagsString
          });

          // Set selected students
          if (project.assignedTo && project.assignedTo.length > 0) {
            this.selectedStudents = project.assignedTo.map((user: any) => user._id || user);
          }
        }

        this.loading = false;
      },
      error: (err) => {
        this.error = 'Failed to load data. Please try again.';
        this.loading = false;
        console.error('Error loading data:', err);
      }
    });
  }

  onStudentSelectionChange(event: Event): void {
    const checkbox = event.target as HTMLInputElement;
    const studentId = checkbox.value;

    if (checkbox.checked) {
      // Add student to selected list if not already there
      if (!this.selectedStudents.includes(studentId)) {
        this.selectedStudents.push(studentId);
      }
    } else {
      // Remove student from selected list
      this.selectedStudents = this.selectedStudents.filter(id => id !== studentId);
    }
  }

  onSubmit(): void {
    if (this.projectForm.invalid) {
      // Mark all fields as touched to trigger validation messages
      Object.keys(this.projectForm.controls).forEach(key => {
        this.projectForm.get(key)?.markAsTouched();
      });
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      this.router.navigate(['/auth/login']);
      return;
    }

    this.submitting = true;
    this.error = '';
    this.success = '';

    // Prepare project data
    const formData = this.projectForm.value;

    // Convert tags from comma-separated string to array
    const tags = formData.tags ?
      formData.tags.split(',').map((tag: string) => tag.trim()).filter((tag: string) => tag) :
      [];

    const projectData = {
      title: formData.title,
      description: formData.description,
      startDate: formData.startDate,
      endDate: formData.endDate,
      status: formData.status,
      assignedTo: this.selectedStudents,
      assignedGroup: formData.assignedGroup || null,
      tags: tags
    };

    // Create or update project
    const request = this.isEditMode && this.projectId ?
      this.projectService.updateProject(this.projectId, projectData, token) :
      this.projectService.createProject(projectData, token);

    request.subscribe({
      next: (response) => {
        this.success = this.isEditMode ?
          'Project updated successfully!' :
          'Project created successfully!';
        this.submitting = false;

        // Navigate back to projects list after a short delay
        setTimeout(() => {
          this.router.navigate(['/projects']);
        }, 1500);
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to save project. Please try again.';
        this.submitting = false;
        console.error('Error saving project:', err);
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/projects']);
  }
}
