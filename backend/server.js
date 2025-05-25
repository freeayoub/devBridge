const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { createServer } = require("http");
require("dotenv").config();

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
const { verifyTokenGraphql } = require("./src/middlewares/authUserMiddleware");
const {
  createUserLoader,
  createMessageLoader,
  createConversationLoader,
  createGroupLoader,
} = require("./src/utils/loaders");
const userRoutes = require("./src/routes/userRoutes");
const reunionRoutes = require("./src/routes/reunionRoutes");
const planningRoutes = require("./src/routes/plannigRoutes");
const typeDefs = require("./src/graphql/messageSchema");
const resolvers = require("./src/graphql/messageResolvers");
const connectDB = require("./src/config/connection");
const config = require("./src/config/config");
const pubsub = require("./src/config/pubsub");
const {
  logger,
  httpLogger,
  apolloLoggingPlugin,
} = require("./src/utils/logger");
const adminRoutes = require("./src/routes/adminRoutes");
const authRoutes = require("./src/routes/authRoutes");
const groupRoutes = require("./src/routes/groupRoutes");
const teamRoutes = require('./src/routes/teamRoute');
const teamMemberRoutes = require("./src/routes/teamMemberRoute");
const projectsRoutes = require('./src/routes/projectRoutes'); // Import des routes des projets
const taskRoutes = require('./src/routes/taskRoutes'); // Import des routes des tâches

const projetRoute = require("./src/routes/projetRoute");
const renduRoutes = require("./src/routes/renduRoute");
const evaluationRoute = require("./src/routes/evaluationRoute");

// Initialisation
const app = express();
const httpServer = createServer(app);
const PORT = config.PORT || 3000;
// 1. Connexion DB
connectDB().catch((err) => {
  logger.error("Database connection error:", err);
  process.exit(1);
});
// 2. Middlewares de base
const corsOptions = {
  origin: [
    config.FRONTEND_URL || "http://localhost:4200",
    "ws://localhost:4200",
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Apollo-Require-Preflight","role"],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(httpLogger); // Ajouter le middleware de journalisation HTTP
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    message: "Too many requests from this IP, please try again later",
  })
);

// 3. REST Routes

app.use('/api/teams', teamRoutes);
app.use('/api/teammembers', teamMemberRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/tasks', taskRoutes);
app.use("/api/projets", projetRoute);
app.use("/api/rendus", renduRoutes);
app.use("/api/evaluations", evaluationRoute);

app.use("/api/admin", adminRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/groups", groupRoutes);

app.use("/api/plannings", planningRoutes);
app.use("/api/reunions", reunionRoutes);
app.use("/api/users", userRoutes);
// 4. Health Check Endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    services: {
      users: "/api/users",
      graphql: "/graphql",
      subscriptions: `ws://localhost:${PORT}/graphql`,
    },
  });
});
// 5. Configuration GraphQL (avec upload de fichiers)
app.use(
  "/graphql",
  graphqlUploadExpress({
    maxFileSize: 10000000,
    maxFiles: 10,
  })
);

const schema = makeExecutableSchema({ typeDefs, resolvers });

// 6. WebSocket Server pour les subscriptions
const wsServer = new WebSocketServer({
  server: httpServer,
  path: "/graphql",
});
//  WebSocket server configuration
const serverCleanup = useServer(
  {
    schema,
    context: async (ctx, msg, args) => {
      // Récupérer les paramètres de connexion
      const connectionParams = ctx.connectionParams || {};
      const token = connectionParams.authorization;

      if (!token) {
        logger.warn("Unauthorized connection attempt - No token provided");
        throw new Error("Authentication token required");
      }

      // Extract Bearer token
      const authToken = token?.startsWith("Bearer ")
        ? token.split(" ")[1]
        : token;

      if (!authToken) {
        logger.warn("Malformed authorization header");
        throw new Error("Invalid token format");
      }

      try {
        // Vérifier et décoder le token
        const user = await verifyTokenGraphql(authToken);
        const userId = user?.id || null;

        if (!userId) {
          logger.warn("User ID not found in token");
          throw new Error("Invalid user ID");
        }

        logger.info(
          `WebSocket operation for user ${userId}, operation: ${msg.type}`
        );

        // Créer les loaders pour ce contexte
        const loaders = {
          userLoader: createUserLoader(),
          groupLoader: createGroupLoader(),
          messageLoader: createMessageLoader(),
          conversationLoader: createConversationLoader(),
        };

        // Retourner le contexte complet
        return {
          user,
          userId,
          pubsub,
          loaders,
        };
      } catch (error) {
        logger.error("WebSocket context error:", error.message);
        throw error;
      }
    },
    onConnect: async (ctx) => {
      try {
        const token = (ctx.connectionParams || {}).authorization;
        if (!token) {
          logger.warn("Unauthorized connection attempt - No token provided");
          return false;
        }

        // Extract Bearer token
        const authToken = token?.startsWith("Bearer ")
          ? token.split(" ")[1]
          : token;

        if (!authToken) {
          logger.warn("Malformed authorization header");
          return false;
        }

        const user = await verifyTokenGraphql(authToken);
        const userId = user?.id || null;

        if (!userId) {
          logger.warn("User ID not found in token");
          return false;
        }

        logger.info(`WebSocket connection authenticated for user ${userId}`);
        return true;
      } catch (error) {
        logger.error("WebSocket authentication failed:", error.message);
        return false;
      }
    },
    onDisconnect(ctx, code, reason) {
      logger.info(
        `Client disconnected (${code}): ${reason || "No reason provided"}`
      );
    },
    onError: (ctx, msg, errors) => {
      logger.error("Subscription error:", {
        ctx: {
          connectionParams: ctx?.connectionParams,
          subscriptions: ctx?.subscriptions
            ? Object.keys(ctx.subscriptions)
            : [],
          hasUser: !!ctx?.extra?.user,
          hasUserId: !!ctx?.extra?.userId,
          hasPubsub: !!ctx?.extra?.pubsub,
        },
        msgType: msg?.type,
        msgId: msg?.id,
        errors: errors?.map((e) => e.message),
      });
    },
  },
  wsServer
);
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
    apolloLoggingPlugin, // Ajouter le plugin de journalisation Apollo
  ],
  context: async (contextValue) => {
    // Pour les requêtes HTTP
    if (contextValue.req) {
      return {
        user: contextValue.req.user,
        userId: contextValue.req.userId,
        loaders: {
          userLoader: createUserLoader(),
          groupLoader: createGroupLoader(),
          messageLoader: createMessageLoader(),
          conversationLoader: createConversationLoader(),
        },
        pubsub,
      };
    }

    // Pour les abonnements WebSocket
    return contextValue;
  },
  formatError: (error) => ({
    message:
      process.env.NODE_ENV === "production"
        ? "An error occurred"
        : error.message,
    code: error.extensions?.code || "INTERNAL_SERVER_ERROR",
    ...(process.env.NODE_ENV !== "production" && {
      path: error.path,
      locations: error.locations,
      stack: error.stack,
    }),
  }),
});
async function initializeApolloServer() {
  try {
    await apolloServer.start();
    app.use(
      "/graphql",
      async (req, res, next) => {
        try {
          const token = req.headers.authorization?.split(" ")[1];
          req.user = token ? await verifyTokenGraphql(token) : null;
          req.userId = req.user?.id || null;
          req.loaders = {
            userLoader: createUserLoader(),
            groupLoader: createGroupLoader(),
            messageLoader: createMessageLoader(),
            conversationLoader: createConversationLoader(),
          };
          next();
        } catch (error) {
          logger.error("Auth middleware error:", error);
          res.status(401).json({ error: "Invalid token" });
        }
      },
      cors(corsOptions),
      expressMiddleware(apolloServer, {
        context: async ({ req }) => ({
          user: req.user,
          userId: req.userId,
          loaders: req.loaders,
          pubsub,
        }),
      })
    );
    logger.info("✅ Apollo Server ready");
  } catch (error) {
    logger.error("❌ Failed to start Apollo Server:", error);
    process.exit(1);
  }
}

// 8.Démarrer le serveur
async function startServer() {
  await initializeApolloServer();

  httpServer.listen(PORT, () => {
    logger.info(`
      🚀 Server running at http://localhost:${PORT}
      🔐 REST API: http://localhost:${PORT}/api/user
      🔮 GraphQL: http://localhost:${PORT}/graphql
      🔌 Subscriptions endpoint: ws://localhost:${PORT}/graphql
    `);
  });
}

startServer().catch((error) => {
  logger.error("❌ Server startup failed:", error);
  process.exit(1);
});
