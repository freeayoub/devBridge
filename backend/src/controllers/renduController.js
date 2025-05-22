// controllers/renduController.js
const Rendu = require("../models/rendu.schema");
const User = require("../models/User");
const Projet = require("../models/project.schema");
const { validationResult } = require("express-validator");
const fs = require('fs');

// CREATE rendu
exports.createRendu = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    let fichiers = [];

    // Gestion des fichiers
    if (req.files && req.files.length > 0) {
      fichiers = req.files.map(f => f.path);
      console.log("Fichiers reçus:", fichiers);
    } else if (typeof req.body.fichiers === 'string') {
      fichiers = [req.body.fichiers];
    } else if (Array.isArray(req.body.fichiers)) {
      fichiers = req.body.fichiers;
    }

    // On prépare le rendu
    const rendu = new Rendu({
      projet: req.body.projet,
      etudiant: req.body.etudiant,
      fichiers,
      description: req.body.description || '',
      statut: 'soumis'
    });

    // Enregistrer le rendu
    await rendu.save();

    // Retourner uniquement un message de succès
    return res.status(201).json({
      success: true,
      message: "Votre projet a été soumis avec succès",
      rendu: {
        id: rendu._id,
        dateSoumission: rendu.dateSoumission,
        statut: rendu.statut
      }
    });

  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: err.message });
  }
};

// Vérifier si un étudiant a déjà soumis un rendu pour un projet
exports.checkRenduExists = async (req, res) => {
  try {
    const { projetId, etudiantId } = req.params;
    
    const rendu = await Rendu.findOne({ 
      projet: projetId,
      etudiant: etudiantId
    });
    
    res.status(200).json({ exists: !!rendu });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// GET all rendus
exports.getAllRendus = async (req, res) => {
  try {
    const rendus = await Rendu.find()
      .populate('projet')
      .populate('etudiant')
      .populate('evaluation');
    res.status(200).json(rendus);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET a specific rendu by ID
exports.getRenduById = async (req, res) => {
  try {
    const rendu = await Rendu.findById(req.params.id)
      .populate('projet')
      .populate('etudiant')
      .populate('evaluation');
    
    if (!rendu) return res.status(404).json({ message: "Rendu non trouvé" });
    res.status(200).json(rendu);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET rendus by projet ID
exports.getRendusByProjet = async (req, res) => {
  try {
    const rendus = await Rendu.find({ projet: req.params.projetId })
      .populate('etudiant');
    res.status(200).json(rendus);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET rendus by étudiant ID
exports.getRendusByEtudiant = async (req, res) => {
  try {
    const rendus = await Rendu.find({ etudiant: req.params.etudiantId })
      .populate('projet');
    res.status(200).json(rendus);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// UPDATE a rendu
exports.updateRendu = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    let updateData = { ...req.body };
    
    // Gestion des fichiers si présents
    if (req.files && req.files.length > 0) {
      updateData.fichiers = req.files.map(f => f.path);
    }

    const rendu = await Rendu.findByIdAndUpdate(
      req.params.id, 
      updateData, 
      { new: true }
    );
    
    if (!rendu) return res.status(404).json({ message: "Rendu non trouvé" });
    res.status(200).json(rendu);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// DELETE a rendu
exports.deleteRendu = async (req, res) => {
  try {
    const rendu = await Rendu.findById(req.params.id);
    if (!rendu) return res.status(404).json({ message: "Rendu non trouvé" });

    // Remove associated files from disk
    if (rendu.fichiers && rendu.fichiers.length > 0) {
      rendu.fichiers.forEach(f => {
        if (fs.existsSync(f)) {
          fs.unlinkSync(f);
        }
      });
    }

    await rendu.deleteOne();
    res.status(200).json({ message: "Rendu supprimé avec succès" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
