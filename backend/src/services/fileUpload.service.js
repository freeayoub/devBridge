const cloudinary = require("../config/cloudinaryConfig");
const mime = require("mime-types");
const { v4: uuidv4 } = require('uuid');

// Helper to generate a secure public_id with either timestamp or UUID
const generatePublicId = (filename, folder, useUuid = true) => {
  const baseFolder = folder || 'uploads';
  if (useUuid) {
    return `${baseFolder}/${uuidv4()}`;
  }
  const sanitized = filename.replace(/[^\w.-]/g, '_');
  return `${baseFolder}/${Date.now()}-${sanitized}`;
};

const uploadFile = async (stream, filename, options = {}) => {
  try {
    // Input validation
    if (!stream || !filename) {
      throw new Error("Stream and filename are required");
    }

    // Upload configuration
    const uploadOptions = {
      resource_type: "auto",
      public_id: generatePublicId(filename, options.folder, true),
      allowed_formats: ['jpg', 'png', 'webp', 'pdf', 'mp4', 'mp3'],
      format: options.format || 'auto',
      quality: 'auto:good',
      timeout: 30000, // 30s timeout
      mime_type: options.mime_type || mime.lookup(filename) || "application/octet-stream",
      ...options
    };

    return await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) {
            console.error('Cloudinary upload error:', error);
            reject(new Error(`Upload failed: ${error.message}`));
          } else {
            resolve(result.secure_url);
          }
        }
      );
      
      // Handle stream errors
      stream.on('error', (error) => {
        uploadStream.end();
        reject(new Error(`Stream error: ${error.message}`));
      });
      
      stream.pipe(uploadStream);
    });
  } catch (error) {
    console.error(`Upload Error [${filename}]:`, error);
    throw new Error(`Upload service failed: ${error.message}`);
  }
};

module.exports = uploadFile;