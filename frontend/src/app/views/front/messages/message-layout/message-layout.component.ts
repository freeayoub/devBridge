import { Component, OnInit, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subscription } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { MessageService } from '@app/services/message.service';
@Component({
  selector: 'app-message-layout',
  templateUrl: './message-layout.component.html',
  styleUrls: ['./message-layout.component.css'],
  // schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class MessageLayoutComponent implements OnInit, OnDestroy {
  private _sidebarVisible = new BehaviorSubject<boolean>(true);
  isMobileView$: any;
  sidebarVisible$ = this._sidebarVisible.asObservable();
  private subscriptions: Subscription[] = [];
  context: string = 'messages';
  conversationId:any;
  constructor(
    private MessageService: MessageService,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    // Détermine le contexte (messages ou notifications)
    this.context = this.route.snapshot.data['context'] || 'messages';
    if (this.context === 'messages') {
    this.subscriptions.push(
      this.MessageService.subscribeToNewMessages(this.conversationId).subscribe({
        next: (message) => {
          // Gestion des nouveaux messages
        },
        error: (err) => console.error(err)
      })
    );
  }
  // Ajoutez ici la logique spécifique aux notifications si nécessaire
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
  ngOnDestroy() {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }
}
