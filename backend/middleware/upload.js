const multer = require('multer');
const path = require('path');

// Define storage strategy
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // Create this folder if it doesn't exist
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

// File filter based on request path
const fileFilter = (req, file, cb) => {
  // Check if this is a profile image upload
  if (req.originalUrl.includes('/auth/update-profile')) {
    // Accept only image files for profile uploads
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.jpg' || ext === '.jpeg' || ext === '.png') {
      cb(null, true);
    } else {
      cb(new Error('Only images (JPG, JPEG, PNG) are allowed for profile pictures'), false);
    }
  }
  // For project/task submissions, accept more file types
  else if (req.originalUrl.includes('/projects/')) {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExtensions = [
      // Images
      '.jpg', '.jpeg', '.png', '.gif', '.svg',
      // Documents
      '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt',
      // Code files
      '.js', '.ts', '.html', '.css', '.json', '.xml', '.java', '.py', '.c', '.cpp', '.cs',
      // Archives
      '.zip', '.rar'
    ];

    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed. Please upload a supported file type.'), false);
    }
  }
  // Default case
  else {
    cb(null, true);
  }
};

// Set file size limits (10MB for general files, 2MB for images)
const limits = {
  fileSize: 10 * 1024 * 1024 // 10MB
};

const upload = multer({
  storage,
  fileFilter,
  limits
});

module.exports = upload;
