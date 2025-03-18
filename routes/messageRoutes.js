// routes/messageRoutes.js
const express = require("express");
const messageRouter = express.Router();
const  upload  = require("../middlewares/uploadMessageMiddleware");
const {
  sendMessage,
  uploadSingleFile,
} = require("../controllers/messageController");
const { body, validationResult } = require("express-validator");

// Route pour téléverser un fichier
messageRouter.post("/upload", upload.single("file"), uploadSingleFile);

// Route pour envoyer un message
messageRouter.post(
  "/",
  [
    body("senderId")
      .isString()
      .notEmpty()
      .withMessage(
        "Le senderId est requis et doit être une chaîne de caractères."
      ),
    body("receiverId")
      .isString()
      .notEmpty()
      .withMessage(
        "Le receiverId est requis et doit être une chaîne de caractères."
      ),
    body("content")
      .isString()
      .notEmpty()
      .withMessage("Le contenu du message ne peut pas être vide."),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    sendMessage(req, res);
  }
);

module.exports = messageRouter;
