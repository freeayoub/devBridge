import { Component, OnInit, OnDestroy } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { Subscription, timer } from 'rxjs';
import { switchMap, catchError, map } from 'rxjs/operators';
import { LoggerService } from '../../services/logger.service';
import gql from 'graphql-tag';

// Requête simple pour vérifier la connexion GraphQL
const PING_QUERY = gql`
  query Ping {
    __typename
  }
`;

@Component({
  selector: 'app-graphql-status',
  templateUrl: './graphql-status.component.html',
  styleUrls: ['./graphql-status.component.css']
})
export class GraphqlStatusComponent implements OnInit, OnDestroy {
  isConnected: boolean = true;
  showStatus: boolean = false;
  private subscriptions: Subscription[] = [];
  private checkInterval: number = 30000; // 30 secondes

  constructor(
    private apollo: Apollo,
    private logger: LoggerService
  ) { }

  ngOnInit(): void {
    // Vérifier la connexion GraphQL périodiquement
    const pingSubscription = timer(0, this.checkInterval).pipe(
      switchMap(() => this.checkGraphQLConnection()),
      catchError(error => {
        this.logger.error('Error checking GraphQL connection', error);
        this.updateConnectionStatus(false);
        return [];
      })
    ).subscribe();
    
    this.subscriptions.push(pingSubscription);
  }

  // Vérifier la connexion GraphQL
  private checkGraphQLConnection() {
    return this.apollo.query({
      query: PING_QUERY,
      fetchPolicy: 'network-only'
    }).pipe(
      map(result => {
        this.updateConnectionStatus(true);
        return result;
      }),
      catchError(error => {
        this.updateConnectionStatus(false);
        throw error;
      })
    );
  }

  // Mettre à jour l'état de la connexion
  private updateConnectionStatus(isConnected: boolean) {
    if (this.isConnected !== isConnected) {
      this.isConnected = isConnected;
      this.showStatus = true;
      
      this.logger.debug(`GraphQL connection status changed: ${isConnected ? 'connected' : 'disconnected'}`);
      
      // Masquer le statut après 3 secondes
      setTimeout(() => {
        this.showStatus = false;
      }, 3000);
    }
  }

  ngOnDestroy(): void {
    // Nettoyer les abonnements
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
}

