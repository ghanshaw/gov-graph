import https from 'https';
import express from 'express';
import cors from 'cors';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { typeDefs } from './schema.js';
import { resolvers } from './resolvers.js';

https.globalAgent.setMaxListeners(50);

const app = express();
const PORT = 4000;

const server = new ApolloServer({ typeDefs, resolvers });

await server.start();

app.use(cors());
app.use(express.json());
app.use('/graphql', expressMiddleware(server));

app.get('/health', (_, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`🚀 Server ready at http://localhost:${PORT}/graphql`);
  console.log(`CourtListener token: ${process.env.COURTLISTENER_TOKEN ? '✓ loaded' : '✗ missing'}`);
});
