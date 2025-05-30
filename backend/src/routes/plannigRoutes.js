const express = require('express');
const router = express.Router();
const planningController = require('../controllers/planningController');
const { verifyToken, verifyRoles, verifyOwnershipOrAdmin } = require("../middlewares/authUserMiddleware");
const Planning = require('../models/planning.model');

// Fonction helper pour récupérer l'ID du créateur d'un planning
const getPlanningOwnerId = async (req) => {
  const planning = await Planning.findById(req.params.id);
  if (!planning) {
    throw new Error('Planning introuvable');
  }
  return planning.createur;
};

// Routes publiques (lecture seule)
router.get('/getone/:id', planningController.getPlanningById);
router.get('/getall', planningController.getAllPlannings);

// Routes protégées - Tous les utilisateurs authentifiés
router.post('/add', verifyToken, planningController.createPlanning);
router.get('/user/:userId', verifyToken, planningController.getPlanningsByUser);

// Routes protégées - Propriétaire ou Admin seulement
router.put('/update/:id',
  verifyToken,
  verifyOwnershipOrAdmin(getPlanningOwnerId),
  planningController.updatePlanning
);

router.delete('/delete/:id',
  verifyToken,
  verifyOwnershipOrAdmin(getPlanningOwnerId),
  planningController.deletePlanning
);

// Routes admin seulement
router.get('/admin/all', verifyRoles('admin'), planningController.getAllPlanningsAdmin);
router.put('/admin/update/:id', verifyRoles('admin'), planningController.updatePlanningAdmin);
router.delete('/admin/force-delete/:id', verifyRoles('admin'), planningController.forceDeletePlanning);

module.exports = router;