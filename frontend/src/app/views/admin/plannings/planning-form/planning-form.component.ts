import { Component, OnInit } from '@angular/core';
import {FormBuilder, FormGroup, Validators} from "@angular/forms";
import {Observable} from "rxjs";
import {User} from "@app/models/user.model";
import {DataService} from "@app/services/data.service";
import {Planning} from "@app/models/planning.model";
import {PlanningService} from "@app/services/planning.service";
import {Router} from "@angular/router";

@Component({
  selector: 'app-planning-form',
  templateUrl: './planning-form.component.html',
  styleUrls: ['./planning-form.component.css']
})
export class PlanningFormComponent implements OnInit {
  planningForm!: FormGroup;
  isLoading = false;
  users$: Observable<User[]> = this.userService.getAllUsers();

  constructor(
    private fb: FormBuilder,
    private userService: DataService,
    private planningService: PlanningService,
    private router:Router
  ) {}

  ngOnInit(): void {
    this.planningForm = this.fb.group({
      titre: ['', [Validators.required, Validators.minLength(3)]],
      description: [''],
      lieu: [''],
      dateDebut: ['', Validators.required],
      dateFin: ['', Validators.required],
      participants: [[], Validators.required]
    });
  }

  submit(): void {
    if (this.planningForm.valid) {
      this.isLoading = true;
      const planning: Planning = this.planningForm.value;

      // Call the createPlanning method to add the new planning
      this.planningService.createPlanning(planning).subscribe(
        (newPlanning:any) => {
          console.log('Planning created:', newPlanning);
          this.isLoading = false;
          // Optionally, reset the form or navigate to another page after successful creation
          this.planningForm.reset();
          this.router.navigate(['plannings'])
        },
        (error:any) => {
          console.error('Error creating planning:', error);
          this.isLoading = false;
        }
      );
    }
  }
}