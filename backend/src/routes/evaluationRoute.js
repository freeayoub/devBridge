const express = require("express");
const router = express.Router();
const evaluationController = require("../controllers/evaluationController");

router.post("/:id", evaluationController.createEvaluation);
router.get("/getev", evaluationController.getAllEvaluations);
router.get("/:id", evaluationController.getEvaluationById);
router.put("/:id", evaluationController.updateEvaluation);
router.delete("/:id", evaluationController.deleteEvaluation);

// Routes de diagnostic
router.get('/diagnostic', evaluationController.diagnosticEvaluations);
router.post('/fix-issues', evaluationController.fixEvaluationIssues);

// Ajouter cette route pour la mise à jour des groupes
router.post('/update-missing-groups', evaluationController.updateMissingGroups);

module.exports = router;
