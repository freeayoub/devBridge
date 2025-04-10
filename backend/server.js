require("dotenv").config();
const express = require("express");
const { createServer } = require("http");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const { ApolloServer } = require("@apollo/server");
const { expressMiddleware } = require("@apollo/server/express4");
const { WebSocketServer } = require("ws");
const { useServer } = require("graphql-ws/lib/use/ws");
const graphqlUploadExpress = require("graphql-upload/graphqlUploadExpress.js");
const { makeExecutableSchema } = require("@graphql-tools/schema");
const {
  ApolloServerPluginDrainHttpServer,
} = require("@apollo/server/plugin/drainHttpServer");

// Configurations
const { verifyToken } = require("./src/middlewares/authUserMiddleware");
const userRoutes = require("./src/routes/userRoutes");
const typeDefs = require("./src/schemas/messageSchema");
const resolvers = require("./src/resolvers/messageResolvers");
const connectDB = require("./src/config/connection");
const config = require("./src/config/config");
const pubsub = require("./src/config/pubsub");

// Initialisation
const app = express();
const httpServer = createServer(app);
const PORT = config.PORT || 3000;

// 1. Connexion DB
connectDB().catch(err => {
  console.error("Database connection error:", err);
  process.exit(1);
});
// 2. Middlewares de base
const corsOptions = {
  origin: [
    config.FRONTEND_URL || "http://localhost:4200",
    "https://studio.apollographql.com"
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "role"],
  credentials: true
};

app.use(cors(corsOptions));
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

// 3. Routes REST 
app.use("/api/user", userRoutes);

// 4. Endpoint de santé
app.get("/", (req, res) => {
  res.json({ 
    status: "OK",
    services: {
      users: "/api/user",
      graphql: "/graphql",
      subscriptions: "ws://localhost:3000/graphql"
    }
  });
});

// 5. Configuration GraphQL (avec upload de fichiers)
app.use(
  "/graphql",
  graphqlUploadExpress({ 
    maxFileSize: 10000000,  // 10MB
    maxFiles: 10
  })
);

const schema = makeExecutableSchema({ typeDefs, resolvers });

// 6. WebSocket Server pour les subscriptions
const wsServer = new WebSocketServer({
  server: httpServer,
  path: "/graphql",
});

const serverCleanup = useServer({
  schema,
  context: async (ctx) => {
    // Compatible avec les deux méthodes d'authentification
    const token = ctx.connectionParams?.token;
    const userId = ctx.connectionParams?.userId;
    
    return {
      user: userId || (token ? await verifyToken(token) : null),
      pubsub
    };
  }
}, wsServer);
// 7. Configuration Apollo Server
const apolloServer = new ApolloServer({
  schema,
  plugins: [
    ApolloServerPluginDrainHttpServer({ httpServer }),
    {
      async serverWillStart() {
        return {
          async drainServer() {
            await serverCleanup.dispose(); 
          },
        };
      },
    },
  ],
  context: async ({ req }) => {
    // Authentification unifiée pour REST et GraphQL
    const token = req.headers.authorization?.split(' ')[1];
    return {
      user: token ? await verifyToken(token) : null, 
      pubsub, 
      userId: token ? (await verifyToken(token)).id : null
    };
  },
  formatError: (error) => ({
    message: process.env.NODE_ENV === 'production' 
      ? 'An error occurred' 
      : error.message, 
    code: error.extensions?.code || "INTERNAL_SERVER_ERROR",
    ...(process.env.NODE_ENV !== 'production' && {
      path: error.path,
      locations: error.locations,
      stack: error.stack
    })
  }),
});
async function initializeApolloServer() {
  try {
    await apolloServer.start();
    app.use(
      "/graphql",
      (req, res, next) => {
        try {
          const token = req.headers.authorization?.split(' ')[1];
          req.user = token ? verifyToken(token) : null;
          req.userId = req.user?.id || null;
          next();
        } catch (error) {
          res.status(401).json({ error: 'Invalid token' });
        }
      },
      cors(corsOptions),
      expressMiddleware(apolloServer, {
        context: async ({ req }) => ({
          user: req.user,      
          userId: req.userId,  
          pubsub,             
          ip: req.ip,
          userAgent: req.headers['user-agent']
        })
      })
    );
    console.log('✅ Apollo Server ready');
  } catch (error) {
    console.error('❌ Failed to start Apollo Server:', error);
    process.exit(1);
  }
}

// 8.Démarrer le serveur
async function startServer() {
  await initializeApolloServer();
  
  httpServer.listen(PORT, () => {
    console.log(`
      🚀 Server running at http://localhost:${PORT}
      🔐 REST API: http://localhost:${PORT}/api/user
      🔮 GraphQL: http://localhost:${PORT}/graphql
      🔌 Subscriptions endpoint: ws://localhost:${PORT}/graphql
    `);
  });
}

startServer().catch(error => {
  console.error('❌ Server startup failed:', error);
  process.exit(1);
});