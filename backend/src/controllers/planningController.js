const Planning = require("../models/planning.model");
const mongoose = require("mongoose");

// Créer un planning
const createPlanning = async (req, res) => {
  try {
    // Vérification de l'authentification
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Authentification requise",
      });
    }

    // Construction des données
    const planningData = {
      ...req.body,
      createur: req.user.id, // Utilisation de req.user.id pour cohérence
    };

    // Validation des champs obligatoires
    const requiredFields = ["titre", "dateDebut", "dateFin"];
    const missingFields = requiredFields.filter(
      (field) => !planningData[field]
    );

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Champs obligatoires manquants",
        missingFields,
      });
    }

    // Validation des participants
    if (!planningData.participants || planningData.participants.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Au moins un participant est requis",
      });
    }

    // Vérification des ObjectId
    const invalidParticipants = planningData.participants.filter(
      (id) => !mongoose.Types.ObjectId.isValid(id)
    );

    if (invalidParticipants.length > 0) {
      return res.status(400).json({
        success: false,
        message: "IDs participants invalides",
        invalidParticipants,
      });
    }

    // Empêcher le créateur d'être participant
    if (planningData.participants.includes(req.user.id.toString())) {
      return res.status(400).json({
        success: false,
        message: "Le créateur ne peut pas être participant",
      });
    }

    // Conversion et validation des dates
    planningData.dateDebut = new Date(planningData.dateDebut);
    planningData.dateFin = new Date(planningData.dateFin);

    if (planningData.dateFin <= planningData.dateDebut) {
      return res.status(400).json({
        success: false,
        message: "La date de fin doit être postérieure à la date de début",
      });
    }

    // Création du planning
    const planning = await Planning.create(planningData);

    // Population des données pour la réponse
    const populatedPlanning = await Planning.findById(planning._id)
      .populate("createur", "username email image")
      .populate("participants", "username email image");

    return res.status(201).json({
      success: true,
      message: "Planning créé avec succès",
      planning: populatedPlanning,
    });
  } catch (error) {
    console.error("Erreur création planning:", error);

    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: "Erreur de validation",
        errors,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Erreur serveur",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Supprimer un planning

const deletePlanning = async (req, res) => {
  try {
    // Vérification de l'authentification
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Authentification requise",
      });
    }

    // Vérification de l'ID
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "ID de planning invalide",
      });
    }

    // Vérification des droits (créateur seulement)
    const planning = await Planning.findOneAndDelete({
      _id: req.params.id,
      createur: req.user.id,
    });

    if (!planning) {
      return res.status(403).json({
        success: false,
        message: "Non autorisé ou planning introuvable",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Planning supprimé avec succès",
      deletedId: req.params.id,
      deletedPlanning: planning.titre,
    });
  } catch (error) {
    console.error("Erreur suppression planning:", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "ID de planning invalide",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Erreur serveur",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Récupérer tous les plannings (nouvelle méthode ajoutée)
const getAllPlannings = async (req, res) => {
  try {
    const plannings = await Planning.find()
      .populate("createur", "username email")
      .populate("participants", "username email")
      .sort({ dateDebut: -1 });

    return res.status(200).json({
      success: true,
      count: plannings.length,
      plannings,
    });
  } catch (error) {
    console.error("Erreur récupération plannings:", error);
    return res.status(500).json({
      success: false,
      message: "Erreur serveur",
    });
  }
};

// Récupérer un planning par ID (nouvelle méthode ajoutée)
const getPlanningById = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "ID de planning invalide",
      });
    }

    const planning = await Planning.findById(req.params.id)
      .populate("createur", "username email image")
      .populate("participants", "username email image")
      .populate("reunions", "titre date heureDebut heureFin");

    if (!planning) {
      return res.status(404).json({
        success: false,
        message: "Planning introuvable",
      });
    }

    return res.status(200).json({
      success: true,
      planning,
    });
  } catch (error) {
    console.error("Erreur récupération planning:", error);
    return res.status(500).json({
      success: false,
      message: "Erreur serveur",
    });
  }
};

const updatePlanning = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Authentification requise",
      });
    }

    const planningId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(planningId)) {
      return res.status(400).json({
        success: false,
        message: "ID de planning invalide",
      });
    }

    const planning = await Planning.findById(planningId);
    if (!planning) {
      return res.status(404).json({
        success: false,
        message: "Planning introuvable",
      });
    }

    if (planning.createur.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Non autorisé à modifier ce planning",
      });
    }

    // ➡️ Met à jour uniquement les champs autorisés
    if (req.body.titre) planning.titre = req.body.titre;
    if (req.body.description) planning.description = req.body.description;
    if (req.body.lieu) planning.lieu = req.body.lieu;

    // ➡️ Gestion des participants
    if (req.body.participants) {
      if (
        !Array.isArray(req.body.participants) ||
        req.body.participants.length === 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Au moins un participant est requis",
        });
      }

      const invalidParticipants = req.body.participants.filter(
        (id) => !mongoose.Types.ObjectId.isValid(id)
      );

      if (invalidParticipants.length > 0) {
        return res.status(400).json({
          success: false,
          message: "IDs participants invalides",
          invalidParticipants,
        });
      }

      if (req.body.participants.includes(req.user.id.toString())) {
        return res.status(400).json({
          success: false,
          message: "Le créateur ne peut pas être participant",
        });
      }

      planning.participants = req.body.participants;
    }

    // ➡️ Gestion des dates
    const newDateDebut = req.body.dateDebut ? new Date(req.body.dateDebut) : planning.dateDebut;
    const newDateFin = req.body.dateFin ? new Date(req.body.dateFin) : planning.dateFin;

    if (newDateDebut && newDateFin && newDateFin <= newDateDebut) {
      return res.status(400).json({
        success: false,
        message: "La date de fin doit être postérieure à la date de début",
      });
    }

    if (req.body.dateDebut) planning.dateDebut = newDateDebut;
    if (req.body.dateFin) planning.dateFin = newDateFin;

    // ➡️ Sauvegarde avec validation mongoose
    await planning.save();

    // ➡️ Repopulate pour envoyer des infos propres
    const populatedPlanning = await Planning.findById(planning._id)
      .populate("createur", "username email image")
      .populate("participants", "username email image");

    return res.status(200).json({
      success: true,
      message: "Planning mis à jour avec succès",
      planning: populatedPlanning,
    });
  } catch (error) {
    console.error("Erreur mise à jour planning:", error);

    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: "Erreur de validation",
        errors,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Erreur serveur",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

const getPlanningsByUser = async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate user ID
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "ID utilisateur invalide"
      });
    }

    // Find plannings where user is creator OR participant
    const plannings = await Planning.find({
      $or: [
        { createur: userId },
        { participants: userId }
      ]
    })
    .populate("createur", "username email image")
    .populate("participants", "username email image")
    .populate({
      path: "reunions",
      select: "titre date heureDebut heureFin statut",
      options: { sort: { date: 1 } } // Sort meetings by date
    })
    .sort({ dateDebut: -1 }); // Sort plannings by most recent first

    return res.status(200).json({
      success: true,
      count: plannings.length,
      plannings
    });

  } catch (error) {
    console.error("Erreur récupération plannings par utilisateur:", error);
    return res.status(500).json({
      success: false,
      message: "Erreur serveur",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
};

module.exports = {
  createPlanning,
  deletePlanning,
  getAllPlannings,
  getPlanningById,
  updatePlanning,
  getPlanningsByUser
};
