import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { MessageService } from '@app/services/message.service';
import { LoggerService } from '@app/services/logger.service';
@Component({
  selector: 'app-message-layout',
  templateUrl: './message-layout.component.html',
  styleUrls: ['./message-layout.component.css'],
  // schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class MessageLayoutComponent implements OnInit, OnDestroy {
  private subscriptions: Subscription[] = [];
  context: string = 'messages';
  conversationId: any;
  constructor(
    private MessageService: MessageService,
    private route: ActivatedRoute,
    private logger: LoggerService
  ) {}

  ngOnInit() {
    // Détermine le contexte (messages ou notifications)
    this.context = this.route.snapshot.data['context'] || 'messages';

    if (this.context === 'messages') {
      // S'abonner aux changements de conversation active
      this.subscriptions.push(
        this.MessageService.activeConversation$.subscribe((conversationId) => {
          // Ne s'abonner aux messages que si une conversation est sélectionnée
          if (conversationId) {
            this.conversationId = conversationId;

            // Désabonner de l'ancienne souscription si elle existe
            this.subscriptions.forEach((sub) => sub.unsubscribe());
            this.subscriptions = [];

            // S'abonner aux nouveaux messages pour cette conversation
            this.subscriptions.push(
              this.MessageService.subscribeToNewMessages(
                conversationId
              ).subscribe({
                next: (message) => {
                  // Gestion des nouveaux messages
                },
                error: (err) =>
                  this.logger.error(
                    'MessageLayout',
                    'Error in message subscription',
                    err
                  ),
              })
            );
          }
        })
      );
    }
    // Ajoutez ici la logique spécifique aux notifications si nécessaire
  }

  ngOnDestroy() {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }
}
