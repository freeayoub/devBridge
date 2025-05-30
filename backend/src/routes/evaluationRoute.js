const express = require("express");
const router = express.Router();
const evaluationController = require("../controllers/evaluationController");

// Routes spécifiques AVANT les routes avec paramètres
router.get("/getev", evaluationController.getAllEvaluations);
router.get('/diagnostic', evaluationController.diagnosticEvaluations);
router.post('/fix-issues', evaluationController.fixEvaluationIssues);
router.post('/update-missing-groups', evaluationController.updateMissingGroups);
router.post('/fix-generic-groups', evaluationController.fixGenericGroups);

// Routes avec paramètres APRÈS les routes spécifiques
router.post("/:id", evaluationController.createEvaluation);
router.get("/:id", evaluationController.getEvaluationById);
router.put("/:id", evaluationController.updateEvaluation);
router.delete("/:id", evaluationController.deleteEvaluation);

module.exports = router;
