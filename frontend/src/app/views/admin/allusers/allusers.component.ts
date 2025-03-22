import { Component } from '@angular/core';
import { DataService } from 'src/app/services/data.service';

@Component({
  selector: 'app-allusers',
  templateUrl: './allusers.component.html',
  styleUrls: ['./allusers.component.css']
})
export class AllusersComponent {
  users :any=[]
  constructor(private ds:DataService) {
    this.ds
      .getAllUser()
      .subscribe((data) => this.users=data);
  }
  viewDetails(user:any){

  }
  deleteuser(id:any){

  }

}
