import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { DataService } from 'src/app/services/data.service';

@Component({
  selector: 'app-adduser',
  templateUrl: './adduser.component.html',
  styleUrls: ['./adduser.component.css']
})
export class AdduserComponent implements OnInit {
  messageErr:any= "";

  constructor(private ds: DataService, private route: Router) {}

  ngOnInit(): void {
  }

  add(userForm: NgForm) {
      const newuser = userForm.value;
      this.ds.addUser(newuser).subscribe({
        next: (data) => {
          this.route.navigate(['/admin/allusers']);
          this.messageErr = null;
          userForm.resetForm();
        },
        error: (err:HttpErrorResponse ) => {
          console.log(err.error)
          this.messageErr = err.error[0];
          setTimeout(() => {
            this.messageErr = null;
          }, 3000); 
        },
      });
}
}