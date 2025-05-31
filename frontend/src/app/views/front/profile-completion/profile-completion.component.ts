import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthuserService } from 'src/app/services/authuser.service';
import { DataService } from 'src/app/services/data.service';
import { User } from 'src/app/models/user.model';

@Component({
  selector: 'app-profile-completion',
  templateUrl: './profile-completion.component.html',
  styleUrls: ['./profile-completion.component.css']
})
export class ProfileCompletionComponent implements OnInit {
  profileForm: FormGroup;
  currentUser: User | null = null;
  progressPercentage: number = 0;
  isLoading = false;
  message = '';
  error = '';
  selectedFile: File | null = null;
  previewUrl: string | ArrayBuffer | null = null;

  // Form steps for better UX
  currentStep = 1;
  totalSteps = 3;

  constructor(
    private fb: FormBuilder,
    private authService: AuthuserService,
    private dataService: DataService,
    private router: Router
  ) {
    this.profileForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      dateOfBirth: ['', Validators.required],
      phoneNumber: ['', [Validators.required, Validators.pattern(/^[0-9+\-\s()]+$/)]],
      department: ['', Validators.required],
      position: [''],
      bio: ['', [Validators.required, Validators.minLength(10)]],
      address: [''],
      skills: ['']
    });
  }

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    if (!this.currentUser) {
      this.router.navigate(['/login']);
      return;
    }

    // Check if profile is already complete
    if (this.currentUser.isProfileComplete) {
      this.router.navigate(['/']);
      return;
    }

    this.calculateProgress();
    this.prefillForm();
  }

  prefillForm(): void {
    if (this.currentUser) {
      this.profileForm.patchValue({
        firstName: this.currentUser.firstName || '',
        lastName: this.currentUser.lastName || '',
        dateOfBirth: this.currentUser.dateOfBirth || '',
        phoneNumber: this.currentUser.phoneNumber || '',
        department: this.currentUser.department || '',
        position: this.currentUser.position || '',
        bio: this.currentUser.bio || '',
        address: this.currentUser.address || '',
        skills: this.currentUser.skills?.join(', ') || ''
      });
    }
  }

  calculateProgress(): void {
    const formValues = this.profileForm.value;
    const requiredFields = ['firstName', 'lastName', 'dateOfBirth', 'phoneNumber', 'department', 'bio'];
    const optionalFields = ['position', 'address', 'skills'];
    
    let completedRequired = 0;
    let completedOptional = 0;

    // Check required fields
    requiredFields.forEach(field => {
      if (formValues[field] && formValues[field].toString().trim() !== '') {
        completedRequired++;
      }
    });

    // Check optional fields
    optionalFields.forEach(field => {
      if (formValues[field] && formValues[field].toString().trim() !== '') {
        completedOptional++;
      }
    });

    // Check profile image
    let hasProfileImage = 0;
    if (this.selectedFile || (this.currentUser?.profileImage && this.currentUser.profileImage !== 'uploads/default.png')) {
      hasProfileImage = 1;
    }

    // Calculate percentage: Required fields (60%) + Optional fields (30%) + Profile Image (10%)
    const requiredPercentage = (completedRequired / requiredFields.length) * 60;
    const optionalPercentage = (completedOptional / optionalFields.length) * 30;
    const imagePercentage = hasProfileImage * 10;

    this.progressPercentage = Math.round(requiredPercentage + optionalPercentage + imagePercentage);
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
      
      // Create preview
      const reader = new FileReader();
      reader.onload = () => {
        this.previewUrl = reader.result;
        this.calculateProgress();
      };
      reader.readAsDataURL(file);
    }
  }

  nextStep(): void {
    if (this.currentStep < this.totalSteps) {
      this.currentStep++;
    }
  }

  previousStep(): void {
    if (this.currentStep > 1) {
      this.currentStep--;
    }
  }

  onSubmit(): void {
    if (this.profileForm.invalid) {
      this.markFormGroupTouched();
      return;
    }

    this.isLoading = true;
    this.error = '';
    this.message = '';

    const formData = new FormData();
    
    // Add form fields
    Object.keys(this.profileForm.value).forEach(key => {
      const value = this.profileForm.value[key];
      if (key === 'skills' && value) {
        // Convert skills string to array
        const skillsArray = value.split(',').map((skill: string) => skill.trim()).filter((skill: string) => skill);
        formData.append(key, JSON.stringify(skillsArray));
      } else if (value) {
        formData.append(key, value);
      }
    });

    // Add profile image if selected
    if (this.selectedFile) {
      formData.append('image', this.selectedFile);
    }

    this.dataService.completeProfile(formData).subscribe({
      next: (response: any) => {
        this.isLoading = false;
        this.message = 'Profile completed successfully!';
        
        // Update current user
        this.authService.setCurrentUser(response.user);
        
        // Redirect to home after a short delay
        setTimeout(() => {
          this.router.navigate(['/']);
        }, 2000);
      },
      error: (err) => {
        this.isLoading = false;
        this.error = err.error?.message || 'An error occurred while completing your profile.';
      }
    });
  }

  skipForNow(): void {
    // Allow user to skip but warn them
    if (confirm('Are you sure you want to skip profile completion? You can complete it later from your profile page.')) {
      this.router.navigate(['/']);
    }
  }

  private markFormGroupTouched(): void {
    Object.keys(this.profileForm.controls).forEach(key => {
      this.profileForm.get(key)?.markAsTouched();
    });
  }

  // Helper methods for template
  getFieldError(fieldName: string): string {
    const field = this.profileForm.get(fieldName);
    if (field?.errors && field.touched) {
      if (field.errors['required']) return `${fieldName} is required`;
      if (field.errors['minlength']) return `${fieldName} is too short`;
      if (field.errors['pattern']) return `${fieldName} format is invalid`;
    }
    return '';
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.profileForm.get(fieldName);
    return !!(field?.invalid && field.touched);
  }

  getMotivationalMessage(): string {
    if (this.progressPercentage < 25) {
      return "Great start! Let's build your amazing profile together! 🚀";
    } else if (this.progressPercentage < 50) {
      return "You're making excellent progress! Keep going! 💪";
    } else if (this.progressPercentage < 75) {
      return "Fantastic! You're more than halfway there! 🌟";
    } else if (this.progressPercentage < 100) {
      return "Almost done! Just a few more details to go! 🎯";
    } else {
      return "Perfect! Your profile is complete and ready to shine! ✨";
    }
  }

  getProgressColor(): string {
    if (this.progressPercentage < 25) return '#ef4444'; // red
    if (this.progressPercentage < 50) return '#f97316'; // orange
    if (this.progressPercentage < 75) return '#eab308'; // yellow
    if (this.progressPercentage < 100) return '#22c55e'; // green
    return '#10b981'; // emerald
  }
}
