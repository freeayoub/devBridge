const express = require('express');
const router = express.Router();
const planningController = require('../controllers/planningController');
const { verifyToken } = require("../middlewares/authUserMiddleware");

// Routes protégées
router.post('/add', verifyToken, planningController.createPlanning);
router.get('/getone/:id',planningController.getPlanningById);
router.get('/getall', planningController.getAllPlannings);
router.get('/user/:userId', verifyToken, planningController.getPlanningsByUser);
router.put('/update/:id', verifyToken, planningController.updatePlanning);
router.delete('/delete/:id', verifyToken, planningController.deletePlanning);
module.exports = router;