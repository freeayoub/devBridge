const express = require("express");
const router = express.Router();
const projetController = require("../controllers/projetController");
const { uploadProjectFiles } = require("../middlewares/upload");

// Routes
router.post("/create", uploadProjectFiles.array("fichiers"), projetController.createProjet);
router.get("/:id", projetController.getProjet);
router.get("/", projetController.getAllProjets);
router.put(
  "/update/:id",
  uploadProjectFiles.array("fichiers"),
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
