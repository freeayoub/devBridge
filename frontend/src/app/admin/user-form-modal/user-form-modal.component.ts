import { Component, EventEmitter, Input, OnInit, Output, OnChanges, SimpleChanges } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from 'src/app/auth/auth.service';

@Component({
  selector: 'app-user-form-modal',
  templateUrl: './user-form-modal.component.html',
  styleUrls: ['./user-form-modal.component.scss']
})
export class UserFormModalComponent implements OnInit, OnChanges {
  @Input() show = false;
  @Input() editMode = false;
  @Input() userData: any = null;
  @Output() close = new EventEmitter<void>();
  @Output() userCreated = new EventEmitter<any>();
  @Output() userUpdated = new EventEmitter<any>();

  userForm: FormGroup;
  roles = ['student', 'teacher', 'admin'];
  loading = false;
  error = '';
  message = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService
  ) {
    this.userForm = this.fb.group({
      fullName: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      role: ['student', [Validators.required]]
    });
  }

  ngOnInit(): void {
  }

  ngOnChanges(changes: SimpleChanges): void {
    // If userData changes and we're in edit mode, populate the form
    if (changes['userData'] && this.userData && this.editMode) {
      this.userForm.patchValue({
        fullName: this.userData.fullName || '',
        email: this.userData.email || '',
        role: this.userData.role || 'student'
      });
    }

    // If show changes to true and we're not in edit mode, reset the form
    if (changes['show'] && this.show && !this.editMode) {
      this.userForm.reset({
        role: 'student'
      });
    }
  }

  onSubmit(): void {
    if (this.userForm.invalid) {
      // Mark all fields as touched to trigger validation messages
      Object.keys(this.userForm.controls).forEach(key => {
        this.userForm.get(key)?.markAsTouched();
      });
      return;
    }

    this.loading = true;
    this.error = '';
    this.message = '';

    const formData = this.userForm.value;

    const token = localStorage.getItem('token');
    if (!token) {
      this.error = 'Authentication token not found';
      this.loading = false;
      return;
    }

    if (this.editMode && this.userData?._id) {
      // Update existing user
      this.authService.updateUser(this.userData._id, formData, token).subscribe({
        next: (res: any) => {
          this.loading = false;
          this.message = res.message || 'User updated successfully';
          this.userUpdated.emit(res.user);

          // Close modal after a short delay
          setTimeout(() => {
            this.closeModal();
          }, 2000);
        },
        error: (err) => {
          this.loading = false;
          this.error = err.error?.message || 'Failed to update user';
        }
      });
    } else {
      // Create new user
      this.authService.createUser(formData, token).subscribe({
        next: (res: any) => {
          this.loading = false;
          this.message = res.message || 'User created successfully';
          this.userCreated.emit(res.user);

          // Reset form
          this.userForm.reset({
            role: 'student'
          });

          // Close modal after a short delay
          setTimeout(() => {
            this.closeModal();
          }, 3000); // Increased to 3 seconds to give more time to read the message
        },
        error: (err) => {
          this.loading = false;
          this.error = err.error?.message || 'Failed to create user';
        }
      });
    }
  }

  closeModal(): void {
    this.close.emit();
    // Reset form and errors when closing
    this.userForm.reset({
      role: 'student'
    });
    this.error = '';
    this.message = '';
  }
}
