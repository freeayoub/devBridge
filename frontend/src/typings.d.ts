declare module 'apollo-upload-client' {
  import { ApolloLink } from '@apollo/client/core';
  export function createUploadLink(options: {
    uri?: string;
    headers?: Record<string, string>;
    credentials?: string;
    fetch?: typeof fetch;
    fetchOptions?: RequestInit;
  }): ApolloLink;
}