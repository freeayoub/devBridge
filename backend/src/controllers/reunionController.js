const Reunion = require('../models/reunion.model');
const Planning = require('../models/planning.model');
const mongoose = require('mongoose');

// Créer une réunion
const createReunion = async (req, res) => {
  try {
    // Vérification de l'authentification
    if (!req.user || !req.user.id) {
      return res.status(401).json({ 
        success: false,
        message: "Authentification requise" 
      });
    }

    const { titre, description, date, heureDebut, heureFin, participants, planning, lieu, lienVisio } = req.body;

    // Validation des champs obligatoires
    const requiredFields = ['titre', 'date', 'heureDebut', 'heureFin', 'planning'];
    const missingFields = requiredFields.filter(field => !req.body[field]);

    if (missingFields.length > 0) {
      return res.status(400).json({ 
        success: false,
        message: 'Champs obligatoires manquants',
        missingFields 
      });
    }

    // Validation des participants
    if (participants && participants.length > 0) {
      const invalidParticipants = participants.filter(
        id => !mongoose.Types.ObjectId.isValid(id)
      );

      if (invalidParticipants.length > 0) {
        return res.status(400).json({ 
          success: false,
          message: 'IDs participants invalides',
          invalidParticipants 
        });
      }
    }

    // Validation du planning
    if (!mongoose.Types.ObjectId.isValid(planning)) {
      return res.status(400).json({ 
        success: false,
        message: 'ID du planning invalide' 
      });
    }

    // Création de la réunion
    const newReunion = await Reunion.create({
      titre,
      description,
      date: new Date(date),
      heureDebut,
      heureFin,
      planning,
      lieu,
      lienVisio,
      participants: participants || [],
      createur: req.user.id // Utilisation de req.user.id du middleware
    });

    // Mise à jour du planning associé
    await Planning.findByIdAndUpdate(planning, {
      $addToSet: { reunions: newReunion._id }
    });

    // Population des données pour la réponse
    const populatedReunion = await Reunion.findById(newReunion._id)
      .populate('participants', 'username email image')
      .populate('planning', 'titre dateDebut dateFin')
      .populate('createur', 'username email image');

    return res.status(201).json({
      success: true,
      message: 'Réunion créée avec succès',
      reunion: populatedReunion
    });

  } catch (error) {
    console.error("Erreur création réunion:", error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(el => el.message);
      return res.status(400).json({ 
        success: false,
        message: 'Erreur de validation',
        errors 
      });
    }
    
    return res.status(500).json({ 
      success: false,
      message: 'Erreur serveur',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Récupérer toutes les réunions
const getAllReunions = async (req, res) => {
  try {
    const reunions = await Reunion.find()
      .populate('participants', 'username email image')
      .populate('planning', 'titre dateDebut dateFin')
      .populate('createur', 'username email image')
      .sort({ date: -1, heureDebut: 1 });

    return res.status(200).json({
      success: true,
      count: reunions.length,
      reunions
    });

  } catch (error) {
    console.error("Erreur récupération réunions:", error);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

// Récupérer une réunion par ID
const getReunionById = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'ID de réunion invalide'
      });
    }

    const reunion = await Reunion.findById(req.params.id)
      .populate('participants', 'username email image')
      .populate('planning', 'titre dateDebut dateFin')
      .populate('createur', 'username email image');

    if (!reunion) {
      return res.status(404).json({ 
        success: false,
        message: 'Réunion introuvable' 
      });
    }

    return res.status(200).json({
      success: true,
      reunion
    });

  } catch (error) {
    console.error("Erreur récupération réunion:", error);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

// Mettre à jour une réunion
const updateReunion = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'ID de réunion invalide'
      });
    }

    // Vérification des droits (créateur seulement)
    const reunion = await Reunion.findOne({
      _id: req.params.id,
      createur: req.user.id
    });

    if (!reunion) {
      return res.status(403).json({
        success: false,
        message: 'Non autorisé - Vous devez être le créateur'
      });
    }

    const updatedReunion = await Reunion.findByIdAndUpdate(
      req.params.id,
      req.body,
      { 
        new: true,
        runValidators: true 
      }
    )
    .populate('participants', 'username email image')
    .populate('planning', 'titre dateDebut dateFin')
    .populate('createur', 'username email image');

    return res.status(200).json({
      success: true,
      message: 'Réunion mise à jour',
      reunion: updatedReunion
    });

  } catch (error) {
    console.error("Erreur mise à jour réunion:", error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(el => el.message);
      return res.status(400).json({ 
        success: false,
        message: 'Erreur de validation',
        errors 
      });
    }
    
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

// Supprimer une réunion
const deleteReunion = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'ID de réunion invalide'
      });
    }

    // Vérification des droits (créateur seulement)
    const reunion = await Reunion.findOne({
      _id: req.params.id,
      createur: req.user.id
    });

    if (!reunion) {
      return res.status(403).json({
        success: false,
        message: 'Non autorisé - Vous devez être le créateur'
      });
    }

    await Reunion.findByIdAndDelete(req.params.id);
    
    // Mise à jour du planning associé
    await Planning.findByIdAndUpdate(reunion.planning, {
      $pull: { reunions: reunion._id }
    });

    return res.status(200).json({
      success: true,
      message: 'Réunion supprimée avec succès',
      deletedId: req.params.id
    });

  } catch (error) {
    console.error("Erreur suppression réunion:", error);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

// Récupérer les réunions par ID utilisateur (créateur ou participant)
const getReunionsByUserId = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'ID utilisateur invalide'
      });
    }

    const reunions = await Reunion.find({
      $or: [
        { createur: userId },
        { participants: userId }
      ]
    })
    .populate('participants', 'username email image')
    .populate('planning', 'titre dateDebut dateFin')
    .populate('createur', 'username email image')
    .sort({ date: -1, heureDebut: 1 });

    return res.status(200).json({
      success: true,
      count: reunions.length,
      reunions
    });

  } catch (error) {
    console.error("Erreur récupération réunions par utilisateur:", error);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};


module.exports = {
  createReunion,
  getAllReunions,
  getReunionById,
  updateReunion,
  deleteReunion,
  getReunionsByUserId
};