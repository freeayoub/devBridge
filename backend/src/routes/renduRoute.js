// routes/renduRoute.js
const express = require("express");
const router = express.Router();
const renduController = require("../controllers/renduController");
const evaluationController = require("../controllers/evaluationController");
const upload = require('../../uploads/upload');
const { body, validationResult } = require("express-validator");
const Projet = require("../models/project.schema");
const User = require("../models/User");

// Validation middleware
const renduValidationRules = [
  body("projet")
    .isMongoId().withMessage("ID projet invalide")
    .custom(async (value) => {
      const projetExists = await Projet.exists({ _id: value });
      if (!projetExists) throw new Error("Le projet spécifié n'existe pas.");
      return true;
    }),
  body("etudiant")
    .isMongoId().withMessage("ID étudiant invalide")
    .custom(async (value) => {
      const userExists = await User.exists({ _id: value });
      if (!userExists) throw new Error("L'utilisateur spécifié n'existe pas.");
      return true;
    }),
  body("description").optional().isString().withMessage("La description doit être une chaîne de caractères.")
];

// CREATE rendu (with file upload)
router.post("/submit", upload.array('fichiers'), renduValidationRules, renduController.createRendu);

// Vérifier si un étudiant a déjà soumis un rendu pour un projet
router.get("/check/:projetId/:etudiantId", renduController.checkRenduExists);

// READ all rendus
router.get("/", renduController.getAllRendus);

// READ single rendu by ID
router.get("/:id", renduController.getRenduById);

// READ rendus by projet ID
router.get("/projet/:projetId", renduController.getRendusByProjet);

// READ rendus by étudiant ID
router.get("/etudiant/:etudiantId", renduController.getRendusByEtudiant);

// UPDATE rendu
router.put("/:id", upload.array('fichiers'), renduValidationRules, renduController.updateRendu);

// DELETE rendu
router.delete("/:id", renduController.deleteRendu);

// AJOUTER: Routes pour les évaluations
// Créer une évaluation pour un rendu
router.post("/evaluations/:renduId", evaluationController.createEvaluation);

// Mettre à jour une évaluation existante
router.put("/evaluations/:renduId", evaluationController.updateEvaluation);

module.exports = router;
