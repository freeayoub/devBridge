const express = require('express');
const messageRouter = express.Router();
const upload = require('../middlewares/uploadMessageMiddleware');
const { sendMessage } = require('../controllers/messageController');
const { body, validationResult } = require('express-validator');
// Route pour téléverser un fichier
messageRouter.post('/upload', upload.single('file'), (req, res) => {
    res.json({ fileUrl: req.file.path });
});

// Route pour envoyer un message
messageRouter.post('/message', [
    body('senderId').isString().notEmpty(),
    body('receiverId').isString().notEmpty(),
    body('content').isString().notEmpty(),
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    sendMessage(req, res);
});

module.exports = messageRouter;