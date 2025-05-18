const express = require("express");
const router = express.Router();
const reunionController = require("../controllers/reunionController");
const { verifyToken } = require("../middlewares/authUserMiddleware");

router.post("/add", verifyToken, reunionController.createReunion);
router.get("/getall", reunionController.getAllReunions);
router.get("/getone/:id", reunionController.getReunionById);
router.get(
  "/planning/:planningId",
  verifyToken,
  reunionController.getReunionsByPlanning
);
router.get(
  "/upcoming/:userId",
  verifyToken,
  reunionController.getProchainesReunions
);
router.put("/update/:id", verifyToken, reunionController.updateReunion);
router.delete("/delete/:id", verifyToken, reunionController.deleteReunion);

module.exports = router;
