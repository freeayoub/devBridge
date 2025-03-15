
const express = require('express');
const router = express.Router();
const validationUserMiddleware = require('../middlewares/validationUserMiddleware');
const userController =require('../controllers/userController');
// Route pour créer un utilisateur
router.post('/register', validationUserMiddleware,userController.register );
router.post('/login', userController.login);
router.post('/online', userController.setUserOnline);
router.post('/offline', userController.setUserOffline);
module.exports = router;
