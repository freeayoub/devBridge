const Reunion = require('../models/reunion.model');
const Planning = require('../models/planning.model');
const User = require('../models/User');
const mongoose = require('mongoose');
const { sendReunionNotification, sendReunionUpdateNotification } = require('../utils/sendEmail');

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
    console.log('🔍 Planning ID reçu:', planning);
    console.log('🔍 Type de planning ID:', typeof planning);

    if (!mongoose.Types.ObjectId.isValid(planning)) {
      console.log('❌ Planning ID invalide:', planning);
      return res.status(400).json({
        success: false,
        message: 'ID du planning invalide'
      });
    }

    // Vérifier que le planning existe et récupérer ses dates
    console.log('🔍 Recherche du planning avec ID:', planning);
    const planningExists = await Planning.findById(planning);
    console.log('🔍 Planning trouvé:', planningExists ? 'OUI' : 'NON');

    if (!planningExists) {
      console.log('❌ Planning introuvable pour ID:', planning);
      return res.status(404).json({
        success: false,
        message: 'Planning introuvable'
      });
    }

    console.log('✅ Planning trouvé:', {
      id: planningExists._id,
      titre: planningExists.titre,
      dateDebut: planningExists.dateDebut,
      dateFin: planningExists.dateFin
    });

    // Validation que la date de la réunion est dans l'intervalle du planning
    const reunionDate = new Date(date);
    const planningDateDebut = new Date(planningExists.dateDebut);
    const planningDateFin = new Date(planningExists.dateFin);

    // Comparer seulement les dates (sans les heures)
    reunionDate.setHours(0, 0, 0, 0);
    planningDateDebut.setHours(0, 0, 0, 0);
    planningDateFin.setHours(0, 0, 0, 0);

    if (reunionDate < planningDateDebut || reunionDate > planningDateFin) {
      return res.status(400).json({
        success: false,
        message: `La date de la réunion doit être comprise entre le ${planningDateDebut.toLocaleDateString('fr-FR')} et le ${planningDateFin.toLocaleDateString('fr-FR')}`,
        planningPeriod: {
          debut: planningExists.dateDebut,
          fin: planningExists.dateFin,
          titre: planningExists.titre
        }
      });
    }

    // Validation de l'unicité du lien visio
    if (lienVisio && lienVisio.trim() !== '') {
      const existingReunion = await Reunion.findOne({
        lienVisio: lienVisio.trim(),
        _id: { $ne: req.params?.id } // Exclure la réunion actuelle lors de la modification
      });

      if (existingReunion) {
        return res.status(400).json({
          success: false,
          message: 'Ce lien de visioconférence est déjà utilisé par une autre réunion',
          conflictWith: {
            titre: existingReunion.titre,
            date: existingReunion.date,
            id: existingReunion._id
          }
        });
      }
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

    // Récupérer les informations du créateur
    const createur = await User.findById(req.user.id).select('username email image');

    // Envoyer des emails de notification aux participants de manière asynchrone
    console.log('🔍 Vérification des participants pour envoi d\'emails...');
    console.log('Participants reçus:', participants);
    console.log('Nombre de participants:', participants ? participants.length : 0);

    if (participants && participants.length > 0) {
      console.log('📧 Début du processus d\'envoi d\'emails...');

      // Lancer l'envoi d'emails en arrière-plan sans attendre
      (async () => {
        try {
          console.log('🔍 Recherche des données des participants...');

          // Récupérer les emails des participants
          const participantsData = await User.find({
            _id: { $in: participants }
          }).select('email username');

          console.log('👥 Participants trouvés:', participantsData.map(p => ({ username: p.username, email: p.email })));

          if (participantsData.length === 0) {
            console.log('⚠️ Aucun participant trouvé dans la base de données');
            return;
          }

          console.log('📤 Préparation de l\'envoi d\'emails...');

          // Envoyer un email à chaque participant en parallèle
          const emailPromises = participantsData.map(participant => {
            console.log(`📧 Préparation email pour ${participant.email}`);

            return sendReunionNotification(
              participant.email,
              {
                titre,
                description,
                date,
                heureDebut,
                heureFin,
                lieu,
                lienVisio
              },
              {
                username: createur.username,
                email: createur.email
              }
            );
          });

          // Attendre que tous les emails soient envoyés
          console.log('⏳ Envoi des emails en cours...');
          const results = await Promise.all(emailPromises);
          console.log('✅ Résultats des envois d\'emails:', results);
          console.log(`📧 Notification emails sent to ${participantsData.length} participants`);
        } catch (emailError) {
          console.error('❌ Error sending notification emails:', emailError);
          console.error('Stack trace:', emailError.stack);
          // Ne pas bloquer la création de la réunion si l'envoi d'emails échoue
        }
      })();
    } else {
      console.log('⚠️ Aucun participant spécifié, pas d\'email envoyé');
    }

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

    // Le middleware verifyOwnershipOrAdmin a déjà vérifié les droits
    // (admin OU propriétaire), donc on peut directement récupérer la réunion
    const reunion = await Reunion.findById(req.params.id)
      .populate('participants', 'username email');

    if (!reunion) {
      return res.status(404).json({
        success: false,
        message: 'Réunion introuvable'
      });
    }

    console.log('Réunion trouvée:', reunion._id);
    console.log('Participants:', reunion.participants);

    // Validation de la date si elle est modifiée
    if (req.body.date && req.body.planning) {
      const planningExists = await Planning.findById(req.body.planning);
      if (!planningExists) {
        return res.status(404).json({
          success: false,
          message: 'Planning introuvable'
        });
      }

      // Validation que la nouvelle date de la réunion est dans l'intervalle du planning
      const reunionDate = new Date(req.body.date);
      const planningDateDebut = new Date(planningExists.dateDebut);
      const planningDateFin = new Date(planningExists.dateFin);

      // Comparer seulement les dates (sans les heures)
      reunionDate.setHours(0, 0, 0, 0);
      planningDateDebut.setHours(0, 0, 0, 0);
      planningDateFin.setHours(0, 0, 0, 0);

      if (reunionDate < planningDateDebut || reunionDate > planningDateFin) {
        return res.status(400).json({
          success: false,
          message: `La date de la réunion doit être comprise entre le ${planningDateDebut.toLocaleDateString('fr-FR')} et le ${planningDateFin.toLocaleDateString('fr-FR')}`,
          planningPeriod: {
            debut: planningExists.dateDebut,
            fin: planningExists.dateFin,
            titre: planningExists.titre
          }
        });
      }
    }

    // Validation de l'unicité du lien visio lors de la modification
    if (req.body.lienVisio && req.body.lienVisio.trim() !== '') {
      const existingReunion = await Reunion.findOne({
        lienVisio: req.body.lienVisio.trim(),
        _id: { $ne: req.params.id } // Exclure la réunion actuelle
      });

      if (existingReunion) {
        return res.status(400).json({
          success: false,
          message: 'Ce lien de visioconférence est déjà utilisé par une autre réunion',
          conflictWith: {
            titre: existingReunion.titre,
            date: existingReunion.date,
            id: existingReunion._id
          }
        });
      }
    }

    // Détecter les changements pour les notifications
    const changes = {};
    const fieldsToCheck = ['titre', 'description', 'date', 'heureDebut', 'heureFin', 'lieu', 'lienVisio'];

    console.log('Vérification des changements:');
    fieldsToCheck.forEach(field => {
      console.log(`Champ ${field}: ancien="${reunion[field]}", nouveau="${req.body[field]}"`);

      // Gestion spéciale pour les dates (comparaison de chaînes de caractères)
      if (field === 'date' && req.body[field]) {
        const oldDate = new Date(reunion[field]).toISOString().split('T')[0];
        const newDate = new Date(req.body[field]).toISOString().split('T')[0];

        if (oldDate !== newDate) {
          changes[field] = reunion[field];
          console.log(`Changement détecté pour ${field}: ${oldDate} -> ${newDate}`);
        }
      }
      // Pour les autres champs
      else if (req.body[field] !== undefined && String(req.body[field]) !== String(reunion[field])) {
        changes[field] = reunion[field];
        console.log(`Changement détecté pour ${field}: "${reunion[field]}" -> "${req.body[field]}"`);
      }
    });

    // Mise à jour de la réunion
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

    // Récupérer les informations du créateur
    const createur = await User.findById(req.user.id).select('username email image');

    // Récupérer tous les participants directement depuis la base de données
    const participantsData = await User.find({
      _id: { $in: reunion.participants.map(p => p._id) }
    }).select('email username');

    console.log('Participants récupérés directement:', participantsData);

    // Envoyer des notifications aux participants si des changements ont été détectés
    if (Object.keys(changes).length > 0 && participantsData.length > 0) {
      console.log(`Envoi de notifications pour ${participantsData.length} participants suite à des modifications`);
      console.log('Modifications détectées:', changes);

      // Envoyer les emails en arrière-plan pour ne pas bloquer la réponse
      (async () => {
        try {
          // Envoyer un email à chaque participant en parallèle
          const emailPromises = participantsData.map(participant => {
            console.log(`Envoi d'email à ${participant.email}`);

            // Utiliser la fonction sendReunionUpdateNotification spécialement conçue pour les mises à jour
            return sendReunionUpdateNotification(
              participant.email,
              {
                titre: updatedReunion.titre,
                description: updatedReunion.description,
                date: updatedReunion.date,
                heureDebut: updatedReunion.heureDebut,
                heureFin: updatedReunion.heureFin,
                lieu: updatedReunion.lieu,
                lienVisio: updatedReunion.lienVisio
              },
              {
                username: createur.username,
                email: createur.email
              },
              changes
            );
          });

          // Attendre que tous les emails soient envoyés
          const results = await Promise.all(emailPromises);
          console.log(`✅ Notification emails for update sent to ${participantsData.length} participants`);
          console.log('Résultats des envois:', results);
        } catch (emailError) {
          console.error('❌ Error sending update notification emails:', emailError);
          console.error(emailError.stack);
          // Ne pas bloquer la mise à jour de la réunion si l'envoi d'emails échoue
        }
      })();
    } else {
      console.log('⚠️ Aucune notification envoyée car aucun changement détecté ou pas de participants');
      console.log('Changements:', changes);
      console.log('Participants:', participantsData.length);
    }

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

    // Le middleware verifyOwnershipOrAdmin a déjà vérifié les droits
    // (admin OU propriétaire), donc on peut directement supprimer
    const reunion = await Reunion.findByIdAndDelete(req.params.id);

    if (!reunion) {
      return res.status(404).json({
        success: false,
        message: 'Réunion introuvable'
      });
    }

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


// Méthodes spécifiques aux administrateurs

// Récupérer toutes les réunions avec informations détaillées (admin seulement)
const getAllReunionsAdmin = async (req, res) => {
  try {
    const reunions = await Reunion.find()
      .populate('createur', 'username email role')
      .populate('participants', 'username email role')
      .populate('planning', 'titre dateDebut dateFin')
      .sort({ date: -1 });

    return res.status(200).json({
      success: true,
      data: reunions,
      total: reunions.length,
      message: 'Réunions récupérées avec succès (admin)'
    });
  } catch (error) {
    console.error("Erreur récupération réunions admin:", error);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

// Mettre à jour n'importe quelle réunion (admin seulement)
const updateReunionAdmin = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'ID de réunion invalide'
      });
    }

    const reunion = await Reunion.findById(req.params.id)
      .populate('participants', 'username email');

    if (!reunion) {
      return res.status(404).json({
        success: false,
        message: 'Réunion introuvable'
      });
    }

    // Validation de l'unicité du lien visio pour les admins aussi
    if (req.body.lienVisio && req.body.lienVisio.trim() !== '') {
      const existingReunion = await Reunion.findOne({
        lienVisio: req.body.lienVisio.trim(),
        _id: { $ne: req.params.id } // Exclure la réunion actuelle
      });

      if (existingReunion) {
        return res.status(400).json({
          success: false,
          message: 'Ce lien de visioconférence est déjà utilisé par une autre réunion',
          conflictWith: {
            titre: existingReunion.titre,
            date: existingReunion.date,
            id: existingReunion._id
          }
        });
      }
    }

    // L'admin peut modifier tous les champs
    const allowedFields = ['titre', 'description', 'date', 'heureDebut', 'heureFin', 'lieu', 'lienVisio', 'participants', 'createur', 'planning'];
    const updateData = {};

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    const updatedReunion = await Reunion.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('createur', 'username email')
     .populate('participants', 'username email')
     .populate('planning', 'titre');

    return res.status(200).json({
      success: true,
      data: updatedReunion,
      message: 'Réunion mise à jour avec succès (admin)'
    });
  } catch (error) {
    console.error("Erreur mise à jour réunion admin:", error);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

// Supprimer n'importe quelle réunion (admin seulement)
const forceDeleteReunion = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'ID de réunion invalide'
      });
    }

    const reunion = await Reunion.findByIdAndDelete(req.params.id);

    if (!reunion) {
      return res.status(404).json({
        success: false,
        message: 'Réunion introuvable'
      });
    }

    // Mettre à jour le planning associé
    await Planning.findByIdAndUpdate(reunion.planning, {
      $pull: { reunions: reunion._id }
    });

    return res.status(200).json({
      success: true,
      message: 'Réunion supprimée avec succès (admin)',
      deletedId: req.params.id
    });
  } catch (error) {
    console.error("Erreur suppression réunion admin:", error);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

/**
 * Vérifie l'unicité d'un lien de visioconférence
 */
const checkLienVisioUniqueness = async (req, res) => {
  try {
    const { lienVisio, excludeReunionId } = req.body;

    if (!lienVisio || lienVisio.trim() === '') {
      return res.status(200).json({
        success: true,
        isUnique: true,
        message: 'Lien vide, pas de vérification nécessaire'
      });
    }

    // Construire la requête de recherche
    const searchQuery = { lienVisio: lienVisio.trim() };

    // Exclure une réunion spécifique si fournie (utile pour la modification)
    if (excludeReunionId) {
      searchQuery._id = { $ne: excludeReunionId };
    }

    const existingReunion = await Reunion.findOne(searchQuery);

    if (existingReunion) {
      return res.status(200).json({
        success: true,
        isUnique: false,
        message: 'Ce lien de visioconférence est déjà utilisé',
        conflictWith: {
          titre: existingReunion.titre,
          date: existingReunion.date,
          id: existingReunion._id
        }
      });
    }

    return res.status(200).json({
      success: true,
      isUnique: true,
      message: 'Lien de visioconférence disponible'
    });

  } catch (error) {
    console.error('Erreur lors de la vérification de l\'unicité du lien visio:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la vérification'
    });
  }
};

module.exports = {
  createReunion,
  getAllReunions,
  getReunionById,
  updateReunion,
  deleteReunion,
  getReunionsByUserId,
  // Méthodes admin
  getAllReunionsAdmin,
  updateReunionAdmin,
  forceDeleteReunion,
  checkLienVisioUniqueness
};