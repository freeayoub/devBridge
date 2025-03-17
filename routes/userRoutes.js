const express = require('express');
const router = express.Router();
const validationUserMiddleware = require('../middlewares/validationUserMiddleware');
const userController =require('../controllers/userController');
// Route pour créer un utilisateur
router.post('/register', validationUserMiddleware,userController.register );
router.post('/login', userController.login);

module.exports = router;