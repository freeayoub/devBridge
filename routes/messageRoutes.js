const express = require('express');
const messageRouter = express.Router();
const upload = require('../middleware/uploadMiddleware');
const uploadSingleFile  = require('../controllers/messageController');
// Route pour téléverser un fichier
messageRouter.post('/upload', upload.single('file'), uploadSingleFile);
module.exports = messageRouter;