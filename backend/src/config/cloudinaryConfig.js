require("dotenv").config();
const cloudinary = require("cloudinary").v2;

// Validation des variables d'environnement
const requiredConfig = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
requiredConfig.forEach(key => {
  if (!process.env[key]) {
    throw new Error(`Missing required Cloudinary config: ${key}`);
  }
});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true 
});

module.exports = cloudinary;