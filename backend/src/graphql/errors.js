const { GraphQLError } = require('graphql');

class AuthenticationError extends GraphQLError {
  constructor(message) {
    super(message, {
      extensions: {
        code: 'UNAUTHENTICATED',
        http: { status: 401 }
      }
    });
  }
}

module.exports = {
  AuthenticationError
};