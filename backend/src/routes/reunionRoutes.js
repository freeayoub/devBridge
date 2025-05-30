const express = require('express');
const router = express.Router();
const reunionController = require('../controllers/reunionController');
const { verifyToken, verifyRoles, verifyOwnershipOrAdmin } = require("../middlewares/authUserMiddleware");
const { sendTestEmail, sendReunionUpdateNotification } = require('../utils/sendEmail');
const Reunion = require('../models/reunion.model');

// Fonction helper pour récupérer l'ID du créateur d'une réunion
const getReunionOwnerId = async (req) => {
  const reunion = await Reunion.findById(req.params.id);
  if (!reunion) {
    throw new Error('Réunion introuvable');
  }
  return reunion.createur;
};

// Routes publiques (lecture seule)
router.get('/getall', reunionController.getAllReunions);
router.get('/getone/:id', reunionController.getReunionById);
router.get('/user/:userId', reunionController.getReunionsByUserId);

// Routes protégées - Tous les utilisateurs authentifiés
router.post('/add', verifyToken, reunionController.createReunion);

// Route pour vérifier l'unicité du lien visio
router.post('/check-lien-visio', verifyToken, reunionController.checkLienVisioUniqueness);

// Routes protégées - Propriétaire ou Admin seulement
router.put('/update/:id',
  verifyToken,
  verifyOwnershipOrAdmin(getReunionOwnerId),
  reunionController.updateReunion
);

router.delete('/delete/:id',
  verifyToken,
  verifyOwnershipOrAdmin(getReunionOwnerId),
  reunionController.deleteReunion
);

// Routes admin seulement
router.get('/admin/all', verifyRoles('admin'), reunionController.getAllReunionsAdmin);
router.put('/admin/update/:id', verifyRoles('admin'), reunionController.updateReunionAdmin);
router.delete('/admin/force-delete/:id', verifyRoles('admin'), reunionController.forceDeleteReunion);

// Routes utilitaires
router.post('/admin/send-test-email', verifyRoles('admin'), async (req, res) => {
  try {
    const { email } = req.body;
    const result = await sendTestEmail(email);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route de test pour l'envoi d'emails
router.get('/test-email/:email', async (req, res) => {
  try {
    const result = await sendTestEmail(req.params.email);
    res.status(200).json({
      success: true,
      message: 'Email de test envoyé',
      result
    });
  } catch (error) {
    console.error('Erreur lors de l\'envoi de l\'email de test:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'envoi de l\'email de test',
      error: error.message
    });
  }
});

// Route de test pour l'envoi d'emails de notification de mise à jour
router.get('/test-update-email/:email', async (req, res) => {
  try {
    // Exemple de données de réunion
    const reunion = {
      titre: "Réunion de test",
      description: "Ceci est une réunion de test pour vérifier les notifications de mise à jour",
      date: new Date(),
      heureDebut: "10:00",
      heureFin: "11:00",
      lieu: "Salle de conférence",
      lienVisio: "https://meet.google.com/test-link"
    };

    // Exemple de créateur
    const createur = {
      username: "Administrateur",
      email: "admin@devbridge.com"
    };

    // Exemple de modifications
    const changes = {
      heureDebut: "09:00",
      heureFin: "10:00",
      lienVisio: "https://meet.google.com/old-link"
    };

    // Envoi de l'email de notification de mise à jour
    const result = await sendReunionUpdateNotification(
      req.params.email,
      reunion,
      createur,
      changes
    );

    res.status(200).json({
      success: true,
      message: 'Email de notification de mise à jour envoyé',
      result
    });
  } catch (error) {
    console.error('Erreur lors de l\'envoi de l\'email de notification de mise à jour:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'envoi de l\'email de notification de mise à jour',
      error: error.message
    });
  }
});

module.exports = router;