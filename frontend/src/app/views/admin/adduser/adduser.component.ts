import { Component } from '@angular/core';
import { NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { DataService } from 'src/app/services/data.service';

@Component({
  selector: 'app-adduser',
  templateUrl: './adduser.component.html',
  styleUrls: ['./adduser.component.css']
})
export class AdduserComponent {
  messageErr: string | null = null;

  constructor(private ds: DataService, private route: Router) {}

  add(userForm: NgForm) {
    if (userForm.valid) {
      const newuser = userForm.value;

      this.ds.addUser(newuser).subscribe({
        next: (data) => {
          // Navigate to the 'allusers' route on success
          this.route.navigate(['/admin/allusers']);

          // Reset the error message
          this.messageErr = null;

          // Reset the form
          userForm.resetForm();

          // Reset the error message after 3 seconds
          setTimeout(() => {
            this.messageErr = null;
          }, 3000);  // 3000 ms = 3 seconds
        },
        error: (error) => {
          console.error('Error adding user:', error);
          this.messageErr = 'Erreur lors de l\'ajout de l\'utilisateur. Veuillez réessayer.';

          // Reset the error message after 3 seconds
          setTimeout(() => {
            this.messageErr = null;
          }, 3000);  // 3000 ms = 3 seconds
        },
      });
    } else {
      this.messageErr = 'Veuillez corriger les erreurs dans le formulaire.';

      // Reset the error message after 3 seconds
      setTimeout(() => {
        this.messageErr = null;
      }, 3000);  // 3000 ms = 3 seconds
    }
  }
}
