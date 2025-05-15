const mongoose = require('mongoose');
const { logger } = require('../utils/logger');

// Options de connexion MongoDB
const options = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000, // Timeout après 5 secondes
  socketTimeoutMS: 45000, // Timeout après 45 secondes
  family: 4, // Utiliser IPv4, éviter les problèmes avec IPv6
  maxPoolSize: 10, // Limiter le nombre de connexions simultanées
  connectTimeoutMS: 10000, // Timeout de connexion après 10 secondes
};

// Fonction pour se connecter à MongoDB
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/project_management';
    
    // Tentative de connexion
    logger.info(`[Database] Connecting to MongoDB: ${mongoURI.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@')}`);
    
    const conn = await mongoose.connect(mongoURI, options);
    
    logger.info(`[Database] MongoDB Connected: ${conn.connection.host}`);
    
    // Gérer les événements de connexion
    mongoose.connection.on('error', (err) => {
      logger.error(`[Database] MongoDB connection error: ${err.message}`, { stack: err.stack });
    });
    
    mongoose.connection.on('disconnected', () => {
      logger.warn('[Database] MongoDB disconnected, attempting to reconnect...');
      setTimeout(connectDB, 5000); // Tenter de se reconnecter après 5 secondes
    });
    
    mongoose.connection.on('reconnected', () => {
      logger.info('[Database] MongoDB reconnected successfully');
    });
    
    // Intercepter les erreurs non gérées
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      logger.info('[Database] MongoDB connection closed due to app termination');
      process.exit(0);
    });
    
    return conn;
  } catch (error) {
    logger.error(`[Database] MongoDB connection error: ${error.message}`, { 
      stack: error.stack,
      mongoURI: process.env.MONGO_URI ? process.env.MONGO_URI.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@') : 'undefined'
    });
    
    // Réessayer après un délai
    logger.info('[Database] Retrying connection in 5 seconds...');
    setTimeout(connectDB, 5000);
    
    // Si nous sommes en production, ne pas planter le serveur
    if (process.env.NODE_ENV === 'production') {
      return null;
    } else {
      // En développement, laisser l'erreur se propager pour un feedback immédiat
      throw error;
    }
  }
};

// Fonction pour vérifier l'état de la connexion
const checkConnection = () => {
  return {
    isConnected: mongoose.connection.readyState === 1,
    state: getConnectionState(mongoose.connection.readyState),
    db: mongoose.connection.db?.databaseName || null,
  };
};

// Fonction pour obtenir l'état de la connexion sous forme de texte
const getConnectionState = (state) => {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
    99: 'uninitialized',
  };
  return states[state] || 'unknown';
};

module.exports = {
  connectDB,
  checkConnection,
  mongoose,
};
