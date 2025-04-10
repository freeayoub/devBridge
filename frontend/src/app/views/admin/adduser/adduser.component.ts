import { HttpErrorResponse } from '@angular/common/http';
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
  messageErr: string = "";

  constructor(private ds: DataService, private route: Router) {}

  add(userForm: NgForm) {
    if (userForm.invalid) return;

    const newuser = userForm.value;
    this.ds.addUser(newuser).subscribe({
      next: (data) => {
        this.route.navigate(['/admin/allusers']);
        this.messageErr = "";
        userForm.resetForm();
      },
      error: (err: HttpErrorResponse) => {
        console.error(err);
        this.messageErr = err.error[0] || "An error occurred while adding the user";
        setTimeout(() => {
          this.messageErr = "";
        }, 3000); 
      },
    });
  }
}