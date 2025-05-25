const express = require("express");
const router = express.Router();
const projetController = require("../controllers/projetController");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Configuration de multer pour le stockage des fichiers
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, "../uploads/uploads/");

    // Vérifier si le dossier existe, sinon le créer
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage: storage });

// Routes
router.post("/create", upload.array("fichiers"), projetController.createProjet);
router.get("/:id", projetController.getProjet);
router.get("/", projetController.getAllProjets);
router.put(
  "/update/:id",
  upload.array("fichiers"),
  projetController.updateProjet
);
router.delete("/delete/:id", projetController.deleteProjet);

// Route pour télécharger un fichier
router.get("/telecharger/:filename", (req, res) => {
  const filename = req.params.filename;

  // Utiliser le chemin correct où se trouvent les fichiers
  const filePath = path.join(__dirname, "../uploads/uploads", filename);

  console.log(`Tentative de téléchargement du fichier: ${filePath}`);
  console.log(`Le fichier existe: ${fs.existsSync(filePath)}`);

  if (fs.existsSync(filePath)) {
    return res.download(filePath, filename);
  } else {
    return res.status(404).send(`Fichier non trouvé: ${filename}`);
  }
});

module.exports = router;
