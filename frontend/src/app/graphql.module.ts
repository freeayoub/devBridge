import { NgModule } from '@angular/core';
import { APOLLO_OPTIONS, ApolloModule } from 'apollo-angular';
import { ApolloClientOptions, InMemoryCache, split } from '@apollo/client/core';
import { HttpLink } from 'apollo-angular/http';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition } from '@apollo/client/utilities';
import { environment } from '../environments/environment';
import { ApolloLink } from '@apollo/client/core';
import { HttpHeaders } from '@angular/common/http';
import { AuthuserService } from './services/authuser.service';
import { createClient } from 'graphql-ws';

export function createApollo(
  httpLink: HttpLink,
  authService: AuthuserService
): ApolloClientOptions<any> {
  const token = authService.getToken();
  const httpUri = `${environment.urlBackend.replace('/api/', '/graphql')}`;
  const wsUri = httpUri.replace('http', 'ws');

  // HTTP Link
  const http = httpLink.create({
    uri: httpUri,
    headers: new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    }),
  });

  let link: ApolloLink = http;

  // WebSocket Link seulement côté client et si token existe
  if (typeof window !== 'undefined' && token) {
    try {
      const wsClient = createClient({
        url: wsUri,
        connectionParams: () => ({
          authorization: `Bearer ${authService.getToken()}`,
        }),
        shouldRetry: (err) => {
          console.error('WebSocket retry check:', err);
          return true;
        },
        retryAttempts: 10,
        keepAlive: 30000,
        on: {
          connected: () => console.debug('WebSocket connected'),
          error: (err) => console.error('WebSocket error:', err),
          closed: () => console.debug('WebSocket closed'),
          ping: (received) => {
            if (!received) console.debug('Ping sent');
            else console.debug('Pong received');
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
        http
      );
    } catch (error) {
      console.error('WebSocket initialization failed:', error);
    }
  }

  return {
    link,
    cache: new InMemoryCache({
      addTypename: false,
    }),
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
    {
      provide: APOLLO_OPTIONS,
      useFactory: createApollo,
      deps: [HttpLink, AuthuserService],
    },
  ],
})
export class GraphQLModule {}
