const { validationResult } = require('express-validator');
const Projet = require('../models/project.schema');
const User = require('../models/User'); 
const mongoose = require('mongoose');


/// Controller to create a new Projet

exports.createProjet = async (req, res) => {
  try {
    const { titre, description, dateLimite, professeur, groupe } = req.body;
    const fichiers = req.files.map(file => file.path);

    // Vérifier si le professeur existe
    const user = await User.findById(professeur);
    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    // Vérifier que le rôle est bien 'tutor' ou 'admin'
    if (!['tutor', 'admin'].includes(user.role)) {
      return res.status(403).json({ message: "L'utilisateur n'est pas autorisé à créer un projet" });
    }

    // // Vérifier si l'ID du groupe est valide
    // if (!mongoose.Types.ObjectId.isValid(groupe)) {
    //   return res.status(400).json({ message: "ID de groupe invalide" });
    // }

    // Créer et enregistrer le nouveau projet
    const newProjet = new Projet({
      titre,
      description,
      dateLimite,
      professeur: new mongoose.Types.ObjectId(professeur),
      fichiers,
      groupe,
    });

    await newProjet.save();
    res.status(201).json({ message: "Projet créé avec succès !" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur lors de la création du projet", error: err.message });
  }
};
// Get all projets
exports.getAllProjets = async (req, res) => {
  try {
    const projets = await Projet.find().sort({ createdAt: -1 });
    res.status(200).json(projets);
  } catch (error) {
    console.error('Erreur lors de la récupération des projets:', error);
    res.status(500).json({ message: 'Erreur serveur lors de la récupération des projets' });
  }
};

// READ ONE
exports.getProjet = async (req, res) => {
  try {
    const projet = await Projet.findById(req.params.id);
    if (!projet) {
      return res.status(404).json({ message: 'Projet non trouvé' });
    }
    res.status(200).json(projet);
  } catch (error) {
    console.error('Erreur lors de la récupération du projet:', error);
    res.status(500).json({ message: 'Erreur serveur lors de la récupération du projet' });
  }
};

// UPDATE
exports.updateProjet = async (req, res) => {
  try {
    // Mise à jour du projet
    const updatedProjet = await Projet.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    
    if (!updatedProjet) {
      return res.status(404).json({ message: 'Projet non trouvé' });
    }
    
    res.status(200).json(updatedProjet);
  } catch (error) {
    console.error('Erreur lors de la mise à jour du projet:', error);
    res.status(500).json({ message: 'Erreur serveur lors de la mise à jour du projet' });
  }
};

// DELETE
exports.deleteProjet = async (req, res) => {
  try {
    const deletedProjet = await Projet.findByIdAndDelete(req.params.id);
    
    if (!deletedProjet) {
      return res.status(404).json({ message: 'Projet non trouvé' });
    }
    
    res.status(200).json({ message: 'Projet supprimé avec succès' });
  } catch (error) {
    console.error('Erreur lors de la suppression du projet:', error);
    res.status(500).json({ message: 'Erreur serveur lors de la suppression du projet' });
  }
};
