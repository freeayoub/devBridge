import { Component, EventEmitter, Output } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from 'src/app/services/auth.service';
import { ToastService } from 'src/app/services/toast.service';

@Component({
  selector: 'app-create-user-modal',
  templateUrl: './create-user-modal.component.html',
  styleUrls: ['./create-user-modal.component.css']
})
export class CreateUserModalComponent {
  @Output() closeModal = new EventEmitter<boolean>();
  @Output() userCreated = new EventEmitter<any>();

  createUserForm: FormGroup;
  loading = false;
  roles = ['student', 'teacher', 'admin'];

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private toastService: ToastService
  ) {
    this.createUserForm = this.fb.group({
      fullName: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      role: ['student', Validators.required]
    });
  }

  onSubmit() {
    if (this.createUserForm.invalid) {
      console.log('Form is invalid:', this.createUserForm.errors);
      return;
    }

    this.loading = true;
    const token = localStorage.getItem('token');

    if (!token) {
      this.toastService.showError('Authentication token not found');
      this.loading = false;
      return;
    }

    const userData = this.createUserForm.value;
    console.log('Submitting user data:', userData);

    // The password will be generated on the server side
    this.authService.createUser(userData, token).subscribe({
      next: (response: any) => {
        console.log('User created successfully:', response);
        const message = response.emailSent
          ? `User created successfully! Login credentials have been sent to ${userData.email}.`
          : 'User created successfully. Please check the console for the generated password.';
        this.toastService.showSuccess(message);
        this.userCreated.emit(response.user);
        this.closeModal.emit(true);
        this.loading = false;
      },
      error: (error: any) => {
        console.error('Error creating user:', error);
        this.toastService.showError(error.error?.message || 'Failed to create user');
        this.loading = false;
      }
    });
  }

  close() {
    this.closeModal.emit(true);
  }
} 