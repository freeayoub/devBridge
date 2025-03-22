import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { Form } from '@angular/forms';
import { Router } from '@angular/router';
import { DataService } from 'src/app/services/data.service';

@Component({
  selector: 'app-allusers',
  templateUrl: './allusers.component.html',
  styleUrls: ['./allusers.component.css']
})
export class AllusersComponent  implements OnInit{
  dataArray:any=[]
  dataUser={
    username:'',
    email:'',
    role:'',
    id:'',
  }
  messageSuccess=''
  constructor(private ds:DataService,private route:Router) {
    this.ds
      .getAllUser()
      .subscribe(
        (data) => {
          this.dataArray=data
        }
      );
  }
  ngOnInit(): void {
  }
  deleteUsr(id:any,i:number){
    this.ds.deleteUser(id).subscribe(response=>{
      console.log(response)
      this.dataArray.splice(i,1)
    })
  }
  getData(username:string,role:string,email:string,id:any){
    this.messageSuccess=''
    this.dataUser.username=username
    this.dataUser.role=role
    this.dataUser.email=email
    this.dataUser.id=id
    console.log(this.dataUser)

  }
  updateNewUser(f:any){
    let data=f.value
    this.ds.updateUser(this.dataUser.id,data).subscribe(response=>
      {
      console.log(response)
        let indexId=this.dataArray.findIndex((obj:any)=>obj._id==this.dataUser.id)
        this.dataArray[indexId].username=data.username
        this.dataArray[indexId].role=data.role
        this.dataArray[indexId].email=data.email
        this.messageSuccess=`this user ${this.dataArray[indexId].username} is updated`
      },(err:HttpErrorResponse)=>{
        console.log(err.message)
      })
  }
  viewDetails(id:any){
    this.route.navigate(['/admin/userdetails/'+id])
  }
}
