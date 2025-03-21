require("dotenv").config();
const express = require("express");
const { createServer } = require("http");
const cors = require("cors");

const { ApolloServer } = require("@apollo/server");
const { expressMiddleware } = require("@apollo/server/express4");
const { WebSocketServer } = require("ws");
const { useServer } = require("graphql-ws/lib/use/ws");
const graphqlUploadExpress = require("graphql-upload/graphqlUploadExpress.js");
const { makeExecutableSchema } = require("@graphql-tools/schema");
const {
  ApolloServerPluginDrainHttpServer,
} = require("@apollo/server/plugin/drainHttpServer");
const authUserMiddleware = require("./src/middlewares/authUserMiddleware.js");
const messageRoutes = require("./src/routes/messageRoutes.js");
const userRoutes = require("./src/routes/userRoutes.js");
const typeDefs = require("./src/schemas/messageSchema.js");
const resolvers = require("./src/resolvers/messageResolvers.js");
const connectDB = require("./src/config/connection.js");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const config = require("./src/config/config.js");
const pubsub = require("./src/config/pubsub.js");
const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
connectDB();

// CORS configuration
const corsOptions = {
  origin: [
    process.env.FRONTEND_URL || "http://localhost:4200",
    "https://studio.apollographql.com",
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(helmet());

// Rate Limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limite chaque IP à 100 requêtes par fenêtre
});
app.use(limiter);
// RESTful Routes
app.use("/message", authUserMiddleware, messageRoutes);
app.use("/user", userRoutes);
// Endpoint to activate GraphQL
app.get("/", (req, res) => {
  res.json({ message: "welcome to devBridge project" });
});

// Initialize GraphQL if activated
if (config.USE_GRAPHQL) {
  app.use(
    "/graphql",
    graphqlUploadExpress({ maxFileSize: 10000000, maxFiles: 10 })
  );
  const schema = makeExecutableSchema({ typeDefs, resolvers });
  const wsServer = new WebSocketServer({
    server: httpServer,
    path: "/graphql",
  });
  // Use WebSocket server for GraphQL subscriptions
  useServer(
    {
      schema,
      context: (ctx) => {
        return {
          userId: ctx.connectionParams?.userId,
          pubsub,
        };
      },
    },
    wsServer
  );

  const apolloServer = new ApolloServer({
    schema,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await wsServer.close();
            },
          };
        },
      },
    ],
    context: async ({ req }) => ({
      userId: req.userId,
      pubsub,
    }),
    formatError: (error) => ({
      message: error.message,
      code: error.extensions?.code || "INTERNAL_SERVER_ERROR",
    }),
  });
  apolloServer
    .start()
    .then(() => {
      app.use(
        "/graphql",
        authUserMiddleware,
        cors(corsOptions),
        expressMiddleware(apolloServer, {
          context: async ({ req }) => ({
            userId: req.userId,
            pubsub,
          }),
        })
      );
    })
    .catch((err) => {
      console.error("Error starting Apollo Server:", err);
      process.exit(1);
    });
}

// Start HTTP Server
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  if (config.USE_GRAPHQL) {
    console.log(
      `🚀 GraphQL endpoint available at http://localhost:${PORT}/graphql`
    );
    console.log(
      `🚀 SUbscription endpoint available at ws://localhost:${PORT}/graphql`
    );
  }
});