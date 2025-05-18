import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription, fromEvent, merge, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { LoggerService } from '../../services/logger.service';

@Component({
  selector: 'app-connection-status',
  templateUrl: './connection-status.component.html',
  styleUrls: ['./connection-status.component.css']
})
export class ConnectionStatusComponent implements OnInit, OnDestroy {
  isOnline: boolean = navigator.onLine;
  showStatus: boolean = false;
  private subscriptions: Subscription[] = [];

  constructor(private logger: LoggerService) { }

  ngOnInit(): void {
    // Créer un observable qui combine les événements online et offline
    const online$ = fromEvent(window, 'online').pipe(map(() => true));
    const offline$ = fromEvent(window, 'offline').pipe(map(() => false));
    const initialStatus$ = of(navigator.onLine);
    
    // S'abonner aux changements d'état de connexion
    const connectionSub = merge(initialStatus$, online$, offline$).subscribe(isOnline => {
      this.isOnline = isOnline;
      this.showStatus = true;
      
      this.logger.debug(`Connection status changed: ${isOnline ? 'online' : 'offline'}`);
      
      // Masquer le statut après 3 secondes
      setTimeout(() => {
        this.showStatus = false;
      }, 3000);
    });
    
    this.subscriptions.push(connectionSub);
  }

  ngOnDestroy(): void {
    // Nettoyer les abonnements
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
}

