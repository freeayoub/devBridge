import { NgModule, Injectable } from '@angular/core';
import { APOLLO_OPTIONS, ApolloModule } from 'apollo-angular';
import {
  ApolloClientOptions,
  InMemoryCache,
  split,
  ApolloClient,
} from '@apollo/client/core';
import { HttpLink } from 'apollo-angular/http';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition } from '@apollo/client/utilities';
import { environment } from '../environments/environment';
import { ApolloLink, from } from '@apollo/client/core';
import { HttpHeaders } from '@angular/common/http';
import { AuthuserService } from './services/authuser.service';
import { createClient } from 'graphql-ws';
import * as ApolloUploadClient from 'apollo-upload-client';
import { onError } from '@apollo/client/link/error';
import { Observable, BehaviorSubject } from 'rxjs';
import { typeDefs } from './graphql/message.graphql';
const createUploadLink = ApolloUploadClient.createUploadLink;
// Service pour gérer le client Apollo
@Injectable({
  providedIn: 'root',
})
export class GraphQLClientService {
  private client: ApolloClient<any> | null = null;
  private clientSubject = new BehaviorSubject<ApolloClient<any> | null>(null);
  public client$ = this.clientSubject.asObservable();
  constructor() {}
  setClient(client: ApolloClient<any>) {
    this.client = client;
    this.clientSubject.next(client);
  }
  getClient(): ApolloClient<any> | null {
    return this.client;
  }
}
// Fonction pour créer le client Apollo
export function createApollo(
  httpLink: HttpLink,
  authService: AuthuserService
): ApolloClientOptions<any> {
  // Récupérer le token à chaque requête plutôt qu'à l'initialisation
  const getToken = () => authService.getToken();
  const httpUri = `${environment.urlBackend.replace('/api/', '/graphql')}`;
  const wsUri = httpUri.replace('http', 'ws');

  // Lien d'erreur pour gérer les erreurs GraphQL
  const errorLink = onError(
    ({ graphQLErrors, networkError, operation, forward }) => {
      if (graphQLErrors) {
        for (const err of graphQLErrors) {
          // Conserver uniquement les erreurs importantes
          if (
            err.message.includes('Enum "MessageType" cannot represent value')
          ) {
            // Ignorer cette erreur spécifique
          } else {
            console.error(
              `[GraphQL error]: Message: ${err.message}, Location: ${err.locations}, Path: ${err.path}`,
              err
            );
          }

          // Gérer les erreurs d'authentification
          if (err.extensions?.['code'] === 'UNAUTHENTICATED') {
            // Afficher uniquement en développement
            if (environment.production === false) {
              console.warn('Authentication token is invalid or expired');
            }
            // Rediriger vers la page de connexion ou rafraîchir le token
          }
        }
      }

      if (networkError) {
        // Filtrer certaines erreurs réseau
        const errorMessage = networkError.toString();
        if (
          !errorMessage.includes('cors') &&
          !errorMessage.includes('Failed to fetch')
        ) {
          console.error(`[Network error]: ${networkError}`);
        }
      }

      return forward(operation);
    }
  );
  // Lien pour transformer les variables et s'assurer que les énumérations sont correctement envoyées
  const transformVariablesLink = new ApolloLink((operation, forward) => {
    const operationName = operation.operationName;
    const variables = operation.variables as Record<string, any>;

    // Traitement spécial pour les mutations SendMessage
    if (operationName === 'SendMessage' && variables['type']) {
      // S'assurer que le type est bien une valeur d'énumération en majuscules
      if (
        typeof variables['type'] === 'string' &&
        variables['type'].toLowerCase() === 'text'
      ) {
        variables['type'] = 'TEXT';
      }
      // Logs activés
      console.log(
        `[GraphQL] SendMessage operation variables after transform:`,
        variables
      );
    }

    return forward(operation);
  });

  // Lien d'authentification pour ajouter le token à chaque requête
  const authLink = new ApolloLink((operation, forward) => {
    const token = getToken();

    // Log des variables de l'opération pour le débogage
    const operationName = operation.operationName;
    const variables = operation.variables;
    if (operationName === 'SendMessage') {
      console.log(`[GraphQL] SendMessage operation variables:`, variables);
    }

    operation.setContext(({ headers = {} }) => ({
      headers: {
        ...headers,
        authorization: token ? `Bearer ${token}` : '',
      },
    }));

    return forward(operation);
  });
  // Créer le lien pour l'upload de fichiers
  const uploadLink = createUploadLink({
    uri: httpUri,
    headers: {
      'Apollo-Require-Preflight': 'true',
    },
    // Les en-têtes d'authentification seront ajoutés par authLink
  });
  // Créer le lien HTTP standard
  const http = httpLink.create({
    uri: httpUri,
    headers: new HttpHeaders({
      'Content-Type': 'application/json',
    }),
    // Les en-têtes d'authentification seront ajoutés par authLink
  });

  // Combiner les liens pour gérer les uploads
  const httpLinkSplit = split(
    ({ query, variables }) => {
      const definition = getMainDefinition(query);
      return (
        definition.kind === 'OperationDefinition' &&
        definition.operation === 'mutation' &&
        variables?.['file'] !== undefined
      );
    },
    uploadLink,
    http
  );

  // Combiner tous les liens HTTP
  let link: ApolloLink = from([
    transformVariablesLink,
    authLink,
    errorLink,
    httpLinkSplit,
  ]);

  // Ajouter le lien WebSocket pour les souscriptions
  if (typeof window !== 'undefined') {
    try {
      const wsClient = createClient({
        url: wsUri,
        connectionParams: () => {
          const token = getToken();
          const userId = authService.getCurrentUserId();

          if (!token) {
            // console.warn('No token available for WebSocket connection');
            return {};
          }

          // Log désactivé
          // console.debug(
          //   'Setting up WebSocket connection with token and userId:',
          //   userId
          // );
          return {
            authorization: `Bearer ${token}`,
            userId: userId,
          };
        },
        shouldRetry: (err) => {
          // Conserver uniquement les erreurs importantes
          if (err && err.toString().includes('critical')) {
            console.error('WebSocket critical error:', err);
          }
          return true;
        },
        retryAttempts: 10,
        keepAlive: 30000,
        on: {
          connected: () => {
            /* WebSocket connected successfully */
          },
          error: (err) => console.error('WebSocket connection error:', err),
          closed: () => {
            /* WebSocket connection closed */
          },
          connecting: () => {
            /* WebSocket connecting... */
          },
          ping: () => {
            /* Ping/Pong events */
          },
        },
      });

      const wsLink = new GraphQLWsLink(wsClient);

      link = split(
        ({ query }) => {
          const definition = getMainDefinition(query);
          return (
            definition.kind === 'OperationDefinition' &&
            definition.operation === 'subscription'
          );
        },
        wsLink,
        link
      );
    } catch (error) {
      // Afficher uniquement en développement
      if (environment.production === false) {
        console.error('WebSocket initialization failed:', error);
      }
    }
  }

  return {
    link,
    cache: new InMemoryCache({
      addTypename: false,
      typePolicies: {
        // Configuration pour gérer les uploads de fichiers
        Upload: {
          merge: true,
        },
      },
    }),
    typeDefs, // Ajouter les définitions de types GraphQL
    defaultOptions: {
      watchQuery: {
        fetchPolicy: 'cache-and-network',
        errorPolicy: 'ignore',
      },
      query: {
        fetchPolicy: 'network-only',
        errorPolicy: 'all',
      },
      mutate: {
        errorPolicy: 'all',
      },
    },
  };
}
@NgModule({
  exports: [ApolloModule],
  providers: [
    GraphQLClientService,
    {
      provide: APOLLO_OPTIONS,
      useFactory: createApollo,
      deps: [HttpLink, AuthuserService],
    },
  ],
})
export class GraphQLModule {
  constructor(
    private graphQLClientService: GraphQLClientService,
    private authService: AuthuserService,
    private httpLink: HttpLink
  ) {
    // Écouter les changements d'authentification pour recréer le client Apollo si nécessaire
    this.authService.authChange$.subscribe(() => {
      // Log désactivé
      // console.log(
      //   `Auth change detected: ${type}, token: ${token ? 'present' : 'absent'}`
      // );

      // Recréer le client Apollo avec les nouvelles informations d'authentification
      const newClient = new ApolloClient(
        createApollo(this.httpLink, this.authService)
      );
      this.graphQLClientService.setClient(newClient);

      // console.log(`Apollo client recreated after ${type}`);
    });
  }
}
