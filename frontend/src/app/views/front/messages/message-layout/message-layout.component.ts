import { Component, OnInit, OnDestroy } from '@angular/core';
import { BehaviorSubject,Subscription } from 'rxjs';
import { GraphqlDataService } from '@app/services/graphql-data.service';
@Component({
  selector: 'app-message-layout',
  templateUrl: './message-layout.component.html',
  styleUrls: ['./message-layout.component.css']
})
export class MessageLayoutComponent implements OnInit, OnDestroy {

  private _sidebarVisible = new BehaviorSubject<boolean>(true);
  isMobileView$:any
  sidebarVisible$ = this._sidebarVisible.asObservable();
    private subscriptions: Subscription[] = [];

    constructor(private graphqlService: GraphqlDataService) {}

    ngOnInit() {
      // this.subscriptions.push(
      //   this.graphqlService.subscribeToNewMessages().subscribe({
      //     next: (message) => {
      //       // Gérer les nouveaux messages
      //     },
      //     error: (err) => console.error(err)
      //   })
      // );
    }
  
    ngOnDestroy() {
      this.subscriptions.forEach(sub => sub.unsubscribe());
    }
  toggleSidebar() {
    this._sidebarVisible.next(!this._sidebarVisible.value);
  }
  hideSidebar() {
    this._sidebarVisible.next(false);
  }
  showSidebar() {
    this._sidebarVisible.next(true);
  }
}
