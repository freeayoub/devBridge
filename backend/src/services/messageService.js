const cloudinary = require("../config/cloudinaryConfig");
const mime = require("mime-types");

// Helper pour générer un public_id sécurisé
const generatePublicId = (filename, folder) => {
  const sanitized = filename.replace(/[^\w.-]/g, '_');
  return folder 
    ? `${folder}/${Date.now()}-${sanitized}`
    : `uploads/${Date.now()}-${sanitized}`;
};

const uploadFile = async (stream, filename, options = {}) => {
  const uploadOptions = {
    resource_type: "auto",
    public_id: generatePublicId(filename, options.folder),
    mime_type: options.mime_type || mime.lookup(filename) || "application/octet-stream",
    allowed_formats: ['jpg', 'png', 'webp', 'pdf'],
    format: 'webp',
    quality: 'auto:good',
    ...options
  };

  try {
    const { secure_url } = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => error ? reject(error) : resolve(result)
      );
      stream.pipe(uploadStream);
    });
    
    return secure_url;
  } catch (error) {
    console.error(`Upload Error [${filename}]:`, error.message);
    throw new Error(`Échec de l'upload: ${error.message}`);
  }
};

// Export pour compatibilité
module.exports = uploadFile;