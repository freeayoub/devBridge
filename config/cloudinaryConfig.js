
require("dotenv").config();
const cloudinary = require("cloudinary").v2;

// Configure Cloudinary avec tes clés d'API
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

module.exports = cloudinary;
