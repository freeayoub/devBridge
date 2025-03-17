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

const authUserMiddleware = require("./middleware/authUserMiddleware");
const messageRoutes = require("./routes/messageRoutes.js");
const userRouter = require("./routes/userRoutes");
const typeDefs = require("./schemas/messageSchema");
const resolvers = require("./resolvers/messageResolvers");
const connectDB = require("./config/connection");
const config = require("./config/config.js");

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
connectDB();

// CORS configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL || "http://localhost:4200",
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

// Middleware
app.use(cors(corsOptions));
app.use(graphqlUploadExpress({ maxFileSize: 10000000, maxFiles: 10 }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// RESTful Routes
app.use("/message", messageRoutes);
app.use("/user", userRouter);
// Endpoint to activate GraphQL
app.get("/", (req, res) => {
  res.json({ message: "welcome to devBridge project" });
});
app.get("/enable-graphql", (req, res) => {
  process.env.USE_GRAPHQL = "true";
  res.json({ message: "GraphQL activated" });
});
// Initialize GraphQL if activated
if (config.USE_GRAPHQL) {
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
        return { userId: ctx.connectionParams?.userId };
      },
    },
    wsServer,
    10000
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
        expressMiddleware(apolloServer, {
          context: async ({ req }) => ({ userId: req.userId }),
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
  }
});
