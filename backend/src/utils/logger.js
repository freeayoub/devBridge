const winston = require("winston");
const path = require("path");
const fs = require("fs");

// Créer le dossier de logs s'il n'existe pas
const logDir = path.join(__dirname, "../../logs");
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Définir les niveaux de log personnalisés
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Définir les couleurs pour chaque niveau
const colors = {
  error: "red",
  warn: "yellow",
  info: "green",
  http: "magenta",
  debug: "blue",
};

// Ajouter les couleurs à Winston
winston.addColors(colors);

// Définir le format pour les logs de console
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

// Définir le format pour les logs de fichier
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.json()
);

// Déterminer le niveau de log en fonction de l'environnement ou de la variable LOG_LEVEL
const level =
  process.env.LOG_LEVEL ||
  (process.env.NODE_ENV === "production" ? "info" : "http");

// Créer les transports pour les logs
const transports = [
  // Console transport
  new winston.transports.Console({
    format: consoleFormat,
    level,
  }),
  // Fichier pour tous les logs
  new winston.transports.File({
    filename: path.join(logDir, "combined.log"),
    format: fileFormat,
    level,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),
  // Fichier pour les erreurs uniquement
  new winston.transports.File({
    filename: path.join(logDir, "error.log"),
    format: fileFormat,
    level: "error",
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),
];

// Créer l'instance de logger
const logger = winston.createLogger({
  level,
  levels,
  transports,
  exitOnError: false,
});

// Middleware pour les requêtes HTTP
const httpLogger = (req, res, next) => {
  // Ignorer les requêtes pour les assets statiques
  if (req.url.startsWith("/static") || req.url.startsWith("/assets")) {
    return next();
  }

  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    const message = `${req.method} ${req.url} ${res.statusCode} - ${duration}ms`;

    // Log avec le niveau approprié en fonction du code de statut
    if (res.statusCode >= 500) {
      logger.error(message);
    } else if (res.statusCode >= 400) {
      logger.warn(message);
    } else {
      logger.http(message);
    }
  });

  next();
};

// Fonction pour formater les erreurs GraphQL
const formatGraphQLError = (error) => {
  const { originalError, path, locations } = error;

  // Extraire les informations utiles de l'erreur
  const formattedError = {
    message: error.message,
    path: path || [],
    locations: locations || [],
    code: error.extensions?.code || "INTERNAL_SERVER_ERROR",
  };

  // Ajouter des détails supplémentaires en développement
  if (process.env.NODE_ENV !== "production" && originalError) {
    formattedError.stack = originalError.stack;
    formattedError.originalError = {
      message: originalError.message,
      name: originalError.name,
    };
  }

  // Journaliser l'erreur
  logger.error(`GraphQL Error: ${error.message}`, {
    path: path,
    code: formattedError.code,
    stack: originalError?.stack,
  });

  return formattedError;
};

// Plugin Apollo pour la journalisation
const apolloLoggingPlugin = {
  async requestDidStart(requestContext) {
    const { request, operationName } = requestContext;

    logger.http(`GraphQL ${operationName || "anonymous"} operation started`, {
      query: request.query,
      variables: request.variables,
      operationName,
    });

    const start = Date.now();

    return {
      async willSendResponse(responseContext) {
        const duration = Date.now() - start;
        const { response, errors } = responseContext;

        if (errors) {
          logger.warn(
            `GraphQL ${
              operationName || "anonymous"
            } completed with errors in ${duration}ms`
          );
        } else {
          logger.http(
            `GraphQL ${operationName || "anonymous"} completed in ${duration}ms`
          );
        }
      },
    };
  },
};

module.exports = {
  logger,
  httpLogger,
  formatGraphQLError,
  apolloLoggingPlugin,
};
