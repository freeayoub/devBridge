require('dotenv').config(); 
module.exports = {
  USE_GRAPHQL: process.env.USE_GRAPHQL === 'true',  
  FRONTEND_URL: process.env.FRONTEND_URL,
};
