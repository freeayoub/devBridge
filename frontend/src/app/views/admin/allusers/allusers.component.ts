import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { switchMap, take } from 'rxjs/operators';
import { User } from 'src/app/models/user.model';
import { DataService } from 'src/app/services/data.service';

@Component({
  selector: 'app-allusers',
  templateUrl: './allusers.component.html',
  styleUrls: ['./allusers.component.css'],
})
export class AllusersComponent implements OnInit {
  users: User[] = []; 
  filteredUsers: User[] = [];
  filterMode: 'all' | 'active' | 'inactive' = 'active';
  modalVisible = false;
  isSelfUpdate = false;
  currentPassword = '';
  newPassword = '';
  dataUser = {
    username: '',
    email: '',
    role: '',
    id: '',
    isActive: true,
  };
  currentIndex = 0;
  messageSuccess = '';
  isLoading = false;

  constructor(
    private ds: DataService, 
    private router: Router,
    private cdRef: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  private loadUsers(): void {
    this.isLoading = true;
    
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

  prepareEditUser(user: User, index: number): void {
    this.isSelfUpdate = this.ds.isCurrentUser(user._id);
    this.messageSuccess = '';
    this.currentPassword = '';
    this.newPassword = '';
    this.dataUser = {
      username: user.username,
      email: user.email,
      role: user.role,
      id: user._id,
      isActive: user.isActive,
    };
    this.currentIndex = index;
    this.openModal();
  }
  
  updateNewUser(f: any): void {
    if (f.invalid) return;
  
    const data: any = {
      username: this.dataUser.username,
      email: this.dataUser.email,
    };

    if (!this.isSelfUpdate) {
      data.role = this.dataUser.role;
    } else if (this.newPassword) {
      data.currentPassword = this.currentPassword;
      data.newPassword = this.newPassword;
    }
  
    this.isLoading = true;
    
    const update$ = this.isSelfUpdate
      ? this.ds.updateSelf(this.dataUser.id, data)
      : this.ds.updateUserByAdmin(this.dataUser.id, data);
  
    update$.subscribe({
      next: () => {
        this.showSuccessMessage(`Utilisateur ${data.username} mis à jour`);
        this.closeModal();
        this.loadUsers();
      },
      error: (err) => {
        this.handleError(err, 'mise à jour');
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
}