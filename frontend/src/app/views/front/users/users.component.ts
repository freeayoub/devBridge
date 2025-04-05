import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { DataService } from 'src/app/services/data.service';

@Component({
  selector: 'app-users',
  templateUrl: './users.component.html',
  styleUrls: ['./users.component.css']
})
export class UsersComponent {
  dataArray:any=[];
  constructor(private ds:DataService,private route:Router) {
    this.ds.getAllUsers().subscribe(data=>this.dataArray=data)
   }

  ngOnInit(): void {
  }

  Godetails(id:any){
    this.route.navigate(['userDetails/'+id])
  }

}
