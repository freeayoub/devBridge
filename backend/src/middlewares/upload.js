const multer = require('multer');
const path = require('path');

// Memory storage for Cloudinary uploads
const storage = multer.memoryStorage();

// File filter for images only
const imageFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (JPEG, PNG, WebP) are allowed'), false);
  }
};

// File filter for project files (more permissive)
const projectFileFilter = (req, file, cb) => {
  const allowedTypes = [
    // Images
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    // Text files
    'text/plain',
    'text/csv',
    // Archives
    'application/zip',
    'application/x-rar-compressed',
    'application/x-7z-compressed',
    // Code files
    'text/javascript',
    'text/html',
    'text/css',
    'application/json',
    'application/xml'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} is not allowed. Please upload documents, images, or code files.`), false);
  }
};

// Upload configurations
const uploadImage = multer({
  storage,
  fileFilter: imageFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit for images
  }
});

const uploadProjectFiles = multer({
  storage,
  fileFilter: projectFileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit for project files
  }
});

// Default export for backward compatibility (images only)
module.exports = uploadImage;

// Named exports for specific use cases
module.exports.uploadImage = uploadImage;
module.exports.uploadProjectFiles = uploadProjectFiles;
