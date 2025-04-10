import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthuserService } from 'src/app/services/authuser.service';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css']
})
export class ProfileComponent implements OnInit {
  profileForm: FormGroup;
  passwordForm: FormGroup;
  message = '';
  error = '';
  isLoading = false;
  currentUser: any;

  constructor(
    private fb: FormBuilder,
    private authService: AuthuserService,
    private router: Router
  ) {
    // Initialisation du formulaire de profil
    this.profileForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]]
    });

    // Initialisation du formulaire de mot de passe
    this.passwordForm = this.fb.group({
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required]
    }, { validator: this.passwordMatchValidator });
  }

  ngOnInit(): void {
    // Vérification de l'authentification
    if (!this.authService.userLoggedIn()) {
      this.router.navigate(['/loginuser']);
      return;
    }

    // Chargement des données utilisateur
    this.currentUser = this.authService.getCurrentUser();
    if (this.currentUser) {
      this.profileForm.patchValue({
        username: this.currentUser.username,
        email: this.currentUser.email
      });
    }
  }

  // Validateur pour vérifier que les mots de passe correspondent
  passwordMatchValidator(g: FormGroup) {
    const newPassword = g.get('newPassword')?.value;
    const confirmPassword = g.get('confirmPassword')?.value;
    return newPassword === confirmPassword ? null : { mismatch: true };
  }

  // Mise à jour du profil
  updateProfile(): void {
    if (this.profileForm.invalid) {
      this.error = 'Veuillez corriger les erreurs dans le formulaire';
      return;
    }

    this.isLoading = true;
    this.error = '';
    this.message = '';

    this.authService.updateSelf(this.profileForm.value).subscribe({
      next: (updatedUser) => {
        this.message = 'Profil mis à jour avec succès';
        this.currentUser = updatedUser;
        this.isLoading = false;
      },
      error: (err) => {
        this.error = err.error?.error || 'Erreur lors de la mise à jour du profil';
        this.isLoading = false;
      }
    });
  }

  // Changement de mot de passe
  changePassword(): void {
    if (this.passwordForm.invalid) {
      this.error = 'Veuillez corriger les erreurs dans le formulaire';
      return;
    }

    this.isLoading = true;
    this.error = '';
    this.message = '';

    const { currentPassword, newPassword } = this.passwordForm.value;
    this.authService.changePassword(currentPassword, newPassword).subscribe({
      next: () => {
        this.message = 'Mot de passe changé avec succès';
        this.passwordForm.reset();
        this.isLoading = false;
      },
      error: (err) => {
        this.error = err.error?.error || 'Erreur lors du changement de mot de passe';
        this.isLoading = false;
      }
    });
  }

  // Désactivation du compte
  deactivateAccount(): void {
    if (!confirm('Êtes-vous sûr de vouloir désactiver votre compte ? Cette action est irréversible.')) {
      return;
    }

    this.isLoading = true;
    this.error = '';
    this.message = '';

    this.authService.deactivateSelf().subscribe({
      next: () => {
        this.message = 'Compte désactivé avec succès';
        this.authService.saveToken(null); // Effacer le token
        this.router.navigate(['/loginuser']); // Redirection vers la page de login
      },
      error: (err) => {
        this.error = err.error?.error || 'Erreur lors de la désactivation du compte';
        this.isLoading = false;
      }
    });
  }
}
