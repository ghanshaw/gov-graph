import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client/core';

const client = new ApolloClient({
  link: new HttpLink({ uri: '/graphql' }),
  cache: new InMemoryCache(),
});

export default client;
