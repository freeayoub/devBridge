const { ApolloError, AuthenticationError, UserInputError, ForbiddenError } = require('apollo-server-express');
const { logger } = require('../utils/logger');
const mongoose = require('mongoose');

/**
 * Classe d'erreur personnalisée pour les erreurs de validation
 */
class ValidationError extends UserInputError {
  constructor(message, errors = {}) {
    super(message, { errors });
    this.name = 'ValidationError';
  }
}

/**
 * Classe d'erreur personnalisée pour les erreurs de ressource non trouvée
 */
class NotFoundError extends ApolloError {
  constructor(message, resource = 'Resource') {
    super(message, 'NOT_FOUND', { resource });
    this.name = 'NotFoundError';
  }
}

/**
 * Classe d'erreur personnalisée pour les erreurs de base de données
 */
class DatabaseError extends ApolloError {
  constructor(message, originalError) {
    super(message, 'DATABASE_ERROR', { originalError: originalError.message });
    this.name = 'DatabaseError';
  }
}

/**
 * Fonction pour gérer les erreurs dans les resolvers GraphQL
 * @param {Function} resolver - La fonction resolver à envelopper
 * @returns {Function} - Le resolver enveloppé avec gestion d'erreurs
 */
const withErrorHandling = (resolver) => {
  return async (parent, args, context, info) => {
    try {
      return await resolver(parent, args, context, info);
    } catch (error) {
      // Log l'erreur avec des détails
      logger.error(`[GraphQL Error] ${error.message}`, {
        resolver: info.fieldName,
        args: JSON.stringify(args),
        userId: context.userId || 'anonymous',
        stack: error.stack,
        originalError: error.originalError ? error.originalError.message : null,
      });

      // Transformer les erreurs Mongoose en erreurs GraphQL
      if (error instanceof mongoose.Error.ValidationError) {
        return new ValidationError('Validation failed', error.errors);
      }

      if (error instanceof mongoose.Error.CastError) {
        return new UserInputError(`Invalid ${error.path}: ${error.value}`);
      }

      if (error.name === 'MongoError' || error.name === 'MongoServerError') {
        if (error.code === 11000) {
          return new UserInputError('Duplicate key error', {
            field: Object.keys(error.keyPattern)[0],
          });
        }
        return new DatabaseError('Database error', error);
      }

      // Gérer les erreurs d'authentification
      if (error.message.includes('Unauthorized') || error.message.includes('jwt')) {
        return new AuthenticationError('Authentication required');
      }

      // Gérer les erreurs "not found"
      if (error.message.includes('not found') || error.message.includes('Not found')) {
        const resource = error.message.split(' ')[0];
        return new NotFoundError(error.message, resource);
      }

      // Renvoyer l'erreur Apollo originale si c'en est une
      if (
        error instanceof ApolloError ||
        error instanceof AuthenticationError ||
        error instanceof UserInputError ||
        error instanceof ForbiddenError
      ) {
        return error;
      }

      // Erreur par défaut
      return new ApolloError(
        'An unexpected error occurred',
        'INTERNAL_SERVER_ERROR',
        { originalError: error.message }
      );
    }
  };
};

/**
 * Fonction pour envelopper tous les resolvers d'un objet avec la gestion d'erreurs
 * @param {Object} resolvers - L'objet contenant les resolvers
 * @returns {Object} - L'objet avec les resolvers enveloppés
 */
const wrapResolvers = (resolvers) => {
  const wrappedResolvers = {};

  Object.keys(resolvers).forEach((type) => {
    wrappedResolvers[type] = {};
    
    Object.keys(resolvers[type]).forEach((field) => {
      // Ne pas envelopper les champs __resolveType ou les subscriptions
      if (field === '__resolveType' || type === 'Subscription') {
        wrappedResolvers[type][field] = resolvers[type][field];
      } else {
        wrappedResolvers[type][field] = withErrorHandling(resolvers[type][field]);
      }
    });
  });

  return wrappedResolvers;
};

module.exports = {
  ValidationError,
  NotFoundError,
  DatabaseError,
  withErrorHandling,
  wrapResolvers,
};
