import { HttpErrorResponse } from '@angular/common/http';
import {Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { switchMap, take } from 'rxjs/operators';
import { User } from 'src/app/models/user.model';
import { DataService } from 'src/app/services/data.service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
@Component({
  selector: 'app-allusers',
  templateUrl: './allusers.component.html',
  styleUrls: ['./allusers.component.css'],
})
export class AllusersComponent implements OnInit , OnDestroy {
  profileForm: FormGroup;
  users: User[] = []; 
  filteredUsers: User[] = [];
  filterMode: 'all' | 'active' | 'inactive' = 'active';
  modalVisible = false;
  isAdmin = false;
  isSelfUpdate = false;
  currentPassword = '';
  newPassword = '';
  dataUserRole = {
    id: '',
    role:''}
  activeTab: 'role' | 'profile' = 'role';
  messageSuccess = '';
  isLoading = false;
  private usersSubscription!: Subscription;
  constructor(
    private ds: DataService, 
    private router: Router,
    private fb: FormBuilder
  ) {
     // Initialize the form
 this.profileForm = this.fb.group({
  username: ['', [Validators.required, Validators.minLength(3)]],
  email: ['', [Validators.required, Validators.email]],
  currentPassword: [''],
  newPassword: ['', [Validators.minLength(6)]],
  confirmPassword: ['']
}, { validator: this.passwordMatchValidator });
  }

  ngOnInit(): void {
    this.isAdmin = this.ds.isAdmin();
    this.loadUsers();
}
passwordMatchValidator(g: FormGroup) {
  const newPassword = g.get('newPassword')?.value;
  const confirmPassword = g.get('confirmPassword')?.value;
  return newPassword === confirmPassword ? null : { mismatch: true };
}
 
  private loadUsers(): void {
    this.isLoading = true;
    this.usersSubscription =
    this.ds.getAllUsers().pipe(take(1)).subscribe({
      next: (users) => {
        this.users = users;
        this.filterUsers();
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Erreur de chargement:', err);
        this.isLoading = false;
        this.showErrorMessage('Erreur lors du chargement des utilisateurs');
      }
    });
  }

  private filterUsers(): void {
    switch (this.filterMode) {
      case 'all':
        this.filteredUsers = [...this.users];
        break;
      case 'active':
        this.filteredUsers = this.users.filter(u => u.isActive);
        break;
      case 'inactive':
        this.filteredUsers = this.users.filter(u => !u.isActive);
        break;
    }
  }

  toggleFilter(): void {
    switch (this.filterMode) {
      case 'active':
        this.filterMode = 'inactive';
        break;
      case 'inactive':
        this.filterMode = 'all';
        break;
      case 'all':
        this.filterMode = 'active';
        break;
    }
    this.filterUsers();
  }

  toggleUserStatus(userId: string, index: number, currentStatus: boolean): void {
    const action = currentStatus ? 'deactivate' : 'reactivate';
    const actionText = currentStatus ? 'désactiver' : 'réactiver';
    
    if (!confirm(`Voulez-vous vraiment ${actionText} cet utilisateur ?`)) return;

    this.isLoading = true;

    const operation$ = currentStatus 
      ? this.ds.deactivateUser(userId) 
      : this.ds.reactivateUser(userId);

    operation$.pipe(
      switchMap(() => this.ds.getAllUsers(true)),
      take(1)
    ).subscribe({
      next: (users) => {
        this.users = users;
        this.filterUsers();
        this.showSuccessMessage(`Utilisateur ${actionText} avec succès`);
      },
      error: (err) => {
        this.handleError(err, action);
      }
    });
  }

  deleteUser(id: string, index: number): void {
    if (!confirm('Êtes-vous sûr de vouloir supprimer définitivement cet utilisateur ?')) return;

    this.isLoading = true;
    this.ds.deleteUser(id).subscribe({
      next: () => {
        this.users.splice(index, 1);
        this.filterUsers();
        this.showSuccessMessage('Utilisateur supprimé avec succès');
      },
      error: (err) => this.handleError(err, 'suppression'),
    });
  }
  prepareEditUser(user: User): void {
  this.isSelfUpdate = this.ds.isCurrentUser(user._id);
  const validRoles = ['admin', 'tutor', 'student', 'alumni'];
  
  this.dataUserRole = {
    id: user._id,
    role: validRoles.includes(user.role) ? user.role : 'student'
  };

  if (this.isSelfUpdate) {
    this.profileForm.patchValue({
      id: user._id,
      username: user.username,
      email: user.email,
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
    this.activeTab = 'profile';
  } else {
    this.activeTab = 'role';
  }
  
  this.openModal();
}
  updateUserRole(): void {
    if (!this.dataUserRole.id || !this.dataUserRole.role) return;
    this.isLoading = true;
    const oldRole = this.users.find(u => u._id === this.dataUserRole.id)?.role;
    const updatedUsers = this.users.map(user => 
      user._id === this.dataUserRole.id 
        ? { ...user, role: this.dataUserRole.role } 
        : user
    );
    this.users = updatedUsers;
    this.filterUsers();
  
    this.ds.updateUserByAdmin(this.dataUserRole.id, { role: this.dataUserRole.role })
      .pipe(
        switchMap(() => this.ds.getAllUsers(true)) 
      )
      .subscribe({
        next: (users) => {
          this.users = users;
          this.filterUsers();
          this.showSuccessMessage('Rôle utilisateur mis à jour avec succès');
          this.closeModal();
        },
        error: (err) => {
          // Rollback en cas d'erreur
          if (oldRole) {
            const rolledBackUsers = this.users.map(user => 
              user._id === this.dataUserRole.id 
                ? { ...user, role: oldRole } 
                : user
            );
            this.users = rolledBackUsers;
            this.filterUsers();
          }
          this.handleError(err, 'mise à jour du rôle');
          this.closeModal();
        }
      });
  }
  updateUserProfile(): void {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }
  
    // Vérification de la correspondance des mots de passe si nouveau mot de passe est fourni
    if (this.profileForm.get('newPassword')?.value !== this.profileForm.get('confirmPassword')?.value) {
      this.showErrorMessage('Les mots de passe ne correspondent pas');
      return;
    }
  
    this.isLoading = true;
    console.log(this.profileForm.value)
    const formData = this.profileForm.value;
    const userId = this.dataUserRole.id; 
  
    if (!userId) {
      this.showErrorMessage('ID utilisateur manquant');
      this.isLoading = false;
      return;
    }
  
  // Préparation des données pour le backend
  const data: any = {
    username: formData.username,
    email: formData.email,
    currentPassword: formData.currentPassword || ''
  };
    // Si nouveau mot de passe est fourni
    if (formData.newPassword) {
      data.newPassword = formData.newPassword;
    }
    
    // Mise à jour optimiste locale
    const updatedUsers = this.users.map(u => 
      u._id === userId ? { ...u, ...data } : u
    );
    this.users = updatedUsers;
    this.filterUsers();
  console.log(userId)
  // Choisir la bonne méthode de service
  const isAdminSelfUpdate = this.isAdmin && this.ds.isCurrentUser(userId);
  const updateMethod = isAdminSelfUpdate 
    ? this.ds.updateUserByAdmin(userId, data)
    : this.ds.updateSelf(userId, data);

  updateMethod.pipe(
    switchMap(() => this.ds.getAllUsers(true))
  ).subscribe({
    next: (users) => {
      this.users = users;
      this.filterUsers();
      this.showSuccessMessage('Profil mis à jour avec succès');
      this.closeModal();
    },
    error: (err) => {
      console.error('Update error:', err);
      this.loadUsers();
      this.handleError(err, 'mise à jour du profil');
      this.closeModal();
    }
  });
}
  private handleError(error: HttpErrorResponse, action: string): void {
    console.error(`Erreur ${action}:`, error);
    this.isLoading = false;
    this.showErrorMessage(`Erreur lors de la ${action}`);
  }

  private showSuccessMessage(message: string): void {
    this.isLoading = false;
    this.messageSuccess = message;
    setTimeout(() => this.messageSuccess = '', 3000);
  }

  private showErrorMessage(message: string): void {
    this.isLoading = false;
    this.messageSuccess = `Erreur: ${message}`;
    setTimeout(() => this.messageSuccess = '', 3000);
  }

  openModal(): void {
    this.modalVisible = true;
  }

  closeModal(): void {
    this.modalVisible = false;
  }

  viewDetails(id: string): void {
    this.router.navigate(['/admin/userdetails', id]);
  }
  ngOnDestroy(): void {
    this.usersSubscription?.unsubscribe();
  }
}