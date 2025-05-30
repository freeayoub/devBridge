const express = require("express");
const router = express.Router();
const reunionController = require("../controllers/reunionController");
const { verifyToken } = require("../middlewares/authUserMiddleware");

// Routes protégées
router.post("/add", verifyToken, reunionController.createReunion);
router.get("/getone/:id", reunionController.getReunionById);
router.get("/getall", reunionController.getAllReunions);
router.get("/user/:userId", verifyToken, reunionController.getReunionsByUserId);
router.put("/update/:id", verifyToken, reunionController.updateReunion);
router.delete("/delete/:id", verifyToken, reunionController.deleteReunion);

module.exports = router;
