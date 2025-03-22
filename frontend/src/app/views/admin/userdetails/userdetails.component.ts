import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DataService } from 'src/app/services/data.service';

@Component({
  selector: 'app-userdetails',
  templateUrl: './userdetails.component.html',
  styleUrls: ['./userdetails.component.css']
})
export class UserdetailsComponent implements OnInit {

  id=''
  dataObject:any
  messageErr=''
  constructor(private route:ActivatedRoute,private ds:DataService) {
    this.route.params.subscribe(params=>this.id=params['id'])
    this.ds.getOnestUser(this.id).subscribe(response=>{
      this.dataObject=response;
      console.log("respon",response)
    }
      ,
      (err:HttpErrorResponse)=>{
        console.log(err)
      this.messageErr="We dont't found this student in our database"
    })
   }

  ngOnInit(): void {
  }
}
