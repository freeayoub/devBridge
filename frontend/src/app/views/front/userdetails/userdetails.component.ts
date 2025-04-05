import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { User } from 'src/app/models/user.model';
import { DataService } from 'src/app/services/data.service';

@Component({
  selector: 'app-userdetails',
  templateUrl: './userdetails.component.html',
  styleUrls: ['./userdetails.component.css']
})
export class UserdetailsComponent implements OnInit,OnDestroy{
userObject?:User;
  messageErr:string='';
  messageSuccess: string = '';
  isLoading: boolean = true;
  private subscription?: Subscription;
  constructor(private route:ActivatedRoute,private ds:DataService, private router: Router,) {}

  ngOnInit(): void {
  const userId = this.route.snapshot.paramMap.get('id');
    if ( userId ) {
      this.loadUser(userId);
    } else {
      this.messageErr = "ID utilisateur non valide";
      this.isLoading = false;
    }
  }
  loadUser(id: string): void {
    this.isLoading = true;
    this.messageErr = '';
    this.subscription = this.ds.getOnestUser(id).subscribe({
      next: (response:User) => {
        this.userObject = response;
        this.isLoading = false;
      },
      error: (err: HttpErrorResponse) => {
        this.messageErr = err.status === 404 
        ? "Utilisateur non trouvé" 
        : "Erreur lors du chargement des données";
      this.isLoading = false;
    }
    });
  }
  goBack(): void {
    this.router.navigate(['/users']);
  }
  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
}
}