const express = require('express');
const router = express.Router();
const reunionController = require('../controllers/reunionController');
const { verifyToken } = require("../middlewares/authUserMiddleware");

router.post('/add', verifyToken, reunionController.createReunion);
router.get('/getall', reunionController.getAllReunions);
router.get('/getone/:id', reunionController.getReunionById);
router.put('/update/:id', verifyToken, reunionController.updateReunion);
router.delete('/delete/:id', verifyToken, reunionController.deleteReunion);
router.get('/user/:userId', reunionController.getReunionsByUserId);

module.exports = router;