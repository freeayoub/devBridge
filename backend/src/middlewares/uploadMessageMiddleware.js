// middlewares/uploadMessageMiddleware.js
const multer = require('multer');
const path = require('path');
// Configuration du stockage des fichiers
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Dossier où les fichiers seront stockés
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + extension); // Nom du fichier
  },
});
// Filtrage des fichiers (accepte uniquement les images)
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true); // Accepter le fichier
  } else {
    cb(new Error('Seules les images sont autorisées !'), false); // Rejeter le fichier
  }
};
// Configuration de Multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 1024 * 1024 * 5, // Limite de 5 Mo
  },
});
module.exports = upload;
