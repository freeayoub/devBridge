import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { DataService } from 'src/app/services/data.service';

@Component({
  selector: 'app-allusers',
  templateUrl: './allusers.component.html',
  styleUrls: ['./allusers.component.css']
})
export class AllusersComponent  implements OnInit{
  dataArray:any=[]
  modalVisible = false;
  dataUser={
    username:'',
    email:'',
    role:'',
    id:'',
  }
  index:number=0;
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
      this.dataArray.splice(i,1)
    })
  }
  getData(username:string,role:string,email:string,id:any,index:number){
    this.messageSuccess=''
    this.dataUser.username=username
    this.dataUser.role=role
    this.dataUser.email=email
    this.dataUser.id=id
    this.index=index
    console.log(index)
  }
  openModal() {
  this.modalVisible = true;
}
  closeModal() {
  this.modalVisible = false;
}
  updateNewUser(f:any){
    let data=f.value
    this.ds.updateUser(this.dataUser.id,data).subscribe(response=>
      {
        this.dataArray[this.index].username=data.username
        this.dataArray[this.index].role=data.role
        this.dataArray[this.index].email=data.email
        this.messageSuccess=`this user ${this.dataArray[this.index].username} is updated`
      },(err:HttpErrorResponse)=>{
        console.log(err.message)
      })
  }
  viewDetails(id:any){
    this.route.navigate(['/admin/userdetails/'+id])
  }
}
