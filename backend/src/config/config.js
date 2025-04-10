// config.js
require('dotenv').config();

module.exports = {
  // Configuration de base
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // URLs
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:4200',
  BACKEND_URL: process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3000}`,
  
  // Base de données
  MONGO_URI: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/project_management',
  
  // Sécurité
  JWT_SECRET: process.env.JWT_SECRET || 'votre_secret_par_defaut',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  SECRET_KEY: process.env.SECRET_KEY || '2cinfo1',
  CLIENT_KEY: process.env.CLIENT_KEY || 'esprit',
  
  // GraphQL
  USE_GRAPHQL: process.env.USE_GRAPHQL === 'true',
  
  // Cloudinary
  CLOUDINARY: {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  },
  
  // CORS
  CORS_OPTIONS: {
    origin: process.env.FRONTEND_URL || 'http://localhost:4200',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }
};