const { GraphQLError } = require("graphql");

class AuthenticationError extends GraphQLError {
  constructor(message) {
    super(message, {
      extensions: {
        code: "UNAUTHENTICATED",
        http: { status: 401 },
      },
    });
  }
}

class ApolloError extends GraphQLError {
  constructor(message, code = "INTERNAL_SERVER_ERROR", properties = {}) {
    super(message, {
      extensions: {
        code,
        ...properties,
      },
    });
  }
}

module.exports = {
  AuthenticationError,
  ApolloError,
};
