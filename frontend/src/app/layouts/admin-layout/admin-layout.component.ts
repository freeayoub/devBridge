import { Location } from '@angular/common';
import { Component } from '@angular/core';
import { AuthadminService } from 'src/app/services/authadmin.service';

@Component({
  selector: 'app-admin-layout',
  templateUrl: './admin-layout.component.html',
  styleUrls: ['./admin-layout.component.css']
})
export class AdminLayoutComponent {
username :any;
  constructor(private location: Location,private authService: AuthadminService,){
this.username=this.authService.getUserName()
  }
  scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  goBack(): void {
    this.location.back();
  }
  logout(){
    console.log("logout")
  }
}
