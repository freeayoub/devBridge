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
const { verifyTokenGraphql } = require("./src/middlewares/authUserMiddleware");
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
connectDB().catch((err) => {
  console.error("Database connection error:", err);
  process.exit(1);
});
// 2. Middlewares de base
const corsOptions = {
  origin: [
    config.FRONTEND_URL || "http://localhost:4200",
    "http://localhost:3000",
    "ws://localhost:3000",
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "role"],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    message: "Too many requests from this IP, please try again later",
  })
);

// 3. REST Routes
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
    maxFileSize: 10000000, // 10MB
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
    onConnect: async (ctx) => {
      const token = ctx.connectionParams?.authorization;
      if (!token) {
        console.log("Connection attempt without token");
        throw new Error("Missing auth token");
      }
      
      try {
        const user = await verifyTokenGraphql(token.split(" ")[1]);
        console.log(`User ${user.id} connected via WebSocket`);
        return { user, pubsub };
      } catch (error) {
        console.error("WebSocket auth failed:", error);
        throw new Error("Authentication failed");
      }
    },
    onDisconnect(ctx, code, reason) {
      console.log(`Client disconnected (${code}): ${reason}`);
    },
    onError: (ctx, msg, errors) => {
      console.error("Subscription error:", { ctx, msg, errors });
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
  ],
  context: async ({ req }) => {
    const token = req.headers.authorization?.split(" ")[1];
    try {
      const user = token ? await verifyTokenGraphql(token) : null;
      return {
        user,
        userId: user?.id || null,
        pubsub,
      };
    } catch (error) {
      console.error("Authentication error:", error);
      return { pubsub };
    }
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
    console.log("Apollo server initialized");
    app.use(
      "/graphql",
      async (req, res, next) => {
        try {
          const token = req.headers.authorization?.split(" ")[1];
          req.user = token ? await verifyTokenGraphql(token) : null;
          req.userId = req.user?.id || null;
          next();
        } catch (error) {
          console.error("Auth middleware error:", error);
          res.status(401).json({ error: "Invalid token" });
        }
      },
      cors(corsOptions),
      expressMiddleware(apolloServer, {
        context: async ({ req }) => ({
          user: req.user,
          userId: req.userId,
          pubsub,
          ip: req.ip,
          userAgent: req.headers["user-agent"],
        }),
      })
    );
    console.log("✅ Apollo Server ready");
  } catch (error) {
    console.error("❌ Failed to start Apollo Server:", error);
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

startServer().catch((error) => {
  console.error("❌ Server startup failed:", error);
  process.exit(1);
});
