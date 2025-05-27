import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ProjectService } from '../project.service';
import { UserService } from '../../shared/user.service';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-task-form',
  template: `
    <div class="container mx-auto px-4 py-8">
      <div class="max-w-3xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <h1 class="text-2xl font-bold mb-6">{{ isEditMode ? 'Edit Task' : 'Create New Task' }}</h1>

        <div *ngIf="loading" class="flex justify-center my-8">
          <div class="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>

        <div *ngIf="error" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {{ error }}
        </div>

        <div *ngIf="success" class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {{ success }}
        </div>

        <form *ngIf="!loading" [formGroup]="taskForm" (ngSubmit)="onSubmit()" class="space-y-6">
          <!-- Task Title -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Task Title*</label>
            <input
              type="text"
              formControlName="title"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            >
            <div *ngIf="taskForm.get('title')?.invalid && taskForm.get('title')?.touched" class="text-red-500 text-xs mt-1">
              Title is required
            </div>
          </div>

          <!-- Task Description -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
            <textarea
              formControlName="description"
              rows="4"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            ></textarea>
          </div>

          <!-- Due Date -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Due Date*</label>
            <input
              type="date"
              formControlName="dueDate"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            >
            <div *ngIf="taskForm.get('dueDate')?.invalid && taskForm.get('dueDate')?.touched" class="text-red-500 text-xs mt-1">
              Due date is required
            </div>
          </div>

          <!-- Priority -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Priority</label>
            <select
              formControlName="priority"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          <!-- Estimated Hours -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Estimated Hours</label>
            <input
              type="number"
              formControlName="estimatedHours"
              min="0"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            >
          </div>

          <!-- Assigned Students -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Assign to Students</label>
            <div class="border border-gray-300 dark:border-gray-600 rounded-md p-3 max-h-60 overflow-y-auto">
              <div *ngIf="students.length === 0" class="text-gray-500 text-sm">
                No students available
              </div>
              <div *ngFor="let student of students" class="flex items-center mb-2">
                <input
                  type="checkbox"
                  [id]="'student-' + student._id"
                  [value]="student._id"
                  (change)="onStudentSelectionChange($event)"
                  [checked]="isStudentSelected(student._id)"
                  class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                >
                <label [for]="'student-' + student._id" class="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                  {{ student.fullName }} ({{ student.email }})
                </label>
              </div>
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
              [disabled]="taskForm.invalid || submitting"
              class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{ isEditMode ? 'Update Task' : 'Create Task' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
  styles: []
})
export class TaskFormComponent implements OnInit {
  taskForm: FormGroup;
  projectId: string | null = null;
  taskId: string | null = null;
  isEditMode = false;
  loading = false;
  submitting = false;
  error = '';
  success = '';
  students: any[] = [];
  selectedStudents: string[] = [];

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private projectService: ProjectService,
    private userService: UserService
  ) {
    this.taskForm = this.fb.group({
      title: ['', Validators.required],
      description: [''],
      dueDate: ['', Validators.required],
      priority: ['medium'],
      estimatedHours: [null]
    });
  }

  ngOnInit(): void {
    this.projectId = this.route.snapshot.paramMap.get('projectId');
    this.taskId = this.route.snapshot.paramMap.get('taskId');
    this.isEditMode = !!this.taskId;

    if (!this.projectId) {
      this.error = 'Project ID is missing';
      return;
    }

    this.loadData();
  }

  loadData(): void {
    const token = localStorage.getItem('token');
    if (!token) {
      this.router.navigate(['/auth/login']);
      return;
    }

    this.loading = true;

    // Load students and task (if in edit mode) in parallel
    const sources: any = {
      students: this.userService.getStudents(token)
    };

    // Only add task to sources if we're in edit mode
    if (this.isEditMode && this.taskId) {
      sources.task = this.projectService.getTaskById(this.taskId, token);
    }

    forkJoin(sources).subscribe({
      next: (results: any) => {
        this.students = results.students || [];

        // If in edit mode, populate form with task data
        if (this.isEditMode && results.task) {
          const task = results.task;
          this.taskForm.patchValue({
            title: task.title,
            description: task.description,
            dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '',
            priority: task.priority,
            estimatedHours: task.estimatedHours
          });

          // Set selected students
          if (task.assignedTo && task.assignedTo.length > 0) {
            this.selectedStudents = task.assignedTo.map((student: any) => student._id);
          }
        }

        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to load data';
        this.loading = false;
      }
    });
  }

  onStudentSelectionChange(event: any): void {
    const studentId = event.target.value;
    const isChecked = event.target.checked;

    if (isChecked) {
      // Add student to selected list if not already there
      if (!this.selectedStudents.includes(studentId)) {
        this.selectedStudents.push(studentId);
      }
    } else {
      // Remove student from selected list
      this.selectedStudents = this.selectedStudents.filter(id => id !== studentId);
    }
  }

  isStudentSelected(studentId: string): boolean {
    return this.selectedStudents.includes(studentId);
  }

  onSubmit(): void {
    if (this.taskForm.invalid) {
      // Mark all fields as touched to trigger validation messages
      Object.keys(this.taskForm.controls).forEach(key => {
        this.taskForm.get(key)?.markAsTouched();
      });
      return;
    }

    const token = localStorage.getItem('token');
    if (!token || !this.projectId) {
      this.router.navigate(['/auth/login']);
      return;
    }

    this.submitting = true;
    this.error = '';
    this.success = '';

    // Prepare task data
    const formData = this.taskForm.value;

    // Ensure we have valid student IDs
    const validStudentIds = this.selectedStudents.filter(id => id && id.trim() !== '');

    console.log('Selected students for task:', validStudentIds);

    const taskData = {
      title: formData.title,
      description: formData.description,
      dueDate: formData.dueDate,
      priority: formData.priority,
      estimatedHours: formData.estimatedHours,
      assignedTo: validStudentIds,
      projectId: this.projectId
    };

    console.log('Submitting task data:', taskData);

    // Create or update task
    const request = this.isEditMode && this.taskId ?
      this.projectService.updateTask(this.taskId, taskData, token) :
      this.projectService.createTask(this.projectId, taskData, token);

    request.subscribe({
      next: (response) => {
        console.log('Task saved successfully:', response);
        this.success = this.isEditMode ?
          'Task updated successfully!' :
          'Task created successfully!';
        this.submitting = false;

        // Navigate back to project detail after a short delay
        setTimeout(() => {
          this.router.navigate(['/projects', this.projectId]);
        }, 1500);
      },
      error: (err) => {
        console.error('Error saving task:', err);
        this.error = err.error?.message || 'Failed to save task. Please try again.';
        this.submitting = false;
      }
    });
  }

  goBack(): void {
    if (this.projectId) {
      this.router.navigate(['/projects', this.projectId]);
    } else {
      this.router.navigate(['/projects']);
    }
  }
}
