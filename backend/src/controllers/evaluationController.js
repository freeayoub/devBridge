const Evaluation = require("../models/evaluation.schema");
const Rendu = require("../models/rendu.schema");
const Projet = require("../models/project.schema");
const { evaluateRendu } = require("./aiController");

// CREATE a new evaluation after evaluating a rendu
exports.createEvaluation = async (req, res) => {
  const { renduId } = req.params;
  const { scores, commentaires, utiliserIA = false } = req.body;

  try {
    console.log(`Création d'évaluation pour le rendu ${renduId}, mode IA: ${utiliserIA}`);
    
    const rendu = await Rendu.findById(renduId).populate('projet');
    if (!rendu) {
      return res.status(404).json({ message: "Rendu non trouvé" });
    }

    // Vérifier si une évaluation existe déjà
    const existingEvaluation = await Evaluation.findOne({ rendu: renduId });
    if (existingEvaluation) {
      return res.status(400).json({ 
        message: "Ce rendu a déjà été évalué. Utilisez la méthode PUT pour mettre à jour l'évaluation." 
      });
    }

    let evaluationData;

    if (utiliserIA) {
      console.log("Lancement de l'évaluation par IA...");
      // Récupérer le contenu des fichiers pour l'analyse
      let contenu = rendu.description || '';
      
      // Évaluation par IA
      const aiResponse = await evaluateRendu({
        contenu: contenu
      });

      console.log("Réponse de l'IA:", aiResponse);

      if (!aiResponse || !aiResponse.success) {
        return res.status(500).json({
          message: "Erreur d'évaluation IA",
          error: aiResponse?.error || "Erreur inconnue"
        });
      }
      
      evaluationData = aiResponse.data || aiResponse;
    } else {
      // Mode manuel
      if (!scores || !commentaires) {
        return res.status(400).json({
          message: "Scores et commentaires sont requis pour une évaluation manuelle."
        });
      }
      evaluationData = {
        scores,
        commentaires
      };
    }

    // Créer l'évaluation
    const evaluation = new Evaluation({
      rendu: renduId,
      projet: rendu.projet._id,
      scores: evaluationData.scores,
      commentaires: evaluationData.commentaires,
      dateEvaluation: new Date()
    });

    await evaluation.save();
    
    // Mettre à jour le statut du rendu ET ajouter une référence à l'évaluation
    rendu.statut = 'évalué';
    rendu.evaluation = evaluation._id; // Ajout de cette ligne
    await rendu.save();

    return res.status(201).json({ 
      message: "Évaluation créée avec succès", 
      evaluation 
    });

  } catch (error) {
    console.error("Erreur lors de la création de l'évaluation", error);
    return res.status(500).json({
      message: "Erreur serveur",
      error: error.message
    });
  }
};


// GET all evaluations with details
exports.getAllEvaluations = async (req, res) => {
  try {
    // Récupérer toutes les évaluations
    const evaluations = await Evaluation.find()
      .populate('rendu')
      .populate('projet');
    
    // Récupérer les détails supplémentaires pour chaque évaluation
    const evaluationsWithDetails = await Promise.all(evaluations.map(async (evaluation) => {
      // Récupérer les détails du rendu avec l'étudiant
      const rendu = await Rendu.findById(evaluation.rendu)
        .populate('etudiant')
        .populate('projet');
      
      // Récupérer les détails du projet
      const projet = await Projet.findById(evaluation.projet);
      
      // Construire l'objet d'évaluation avec tous les détails
      return {
        _id: evaluation._id,
        scores: evaluation.scores,
        commentaires: evaluation.commentaires,
        dateEvaluation: evaluation.dateEvaluation,
        rendu: evaluation.rendu._id,
        renduDetails: rendu,
        etudiant: rendu ? rendu.etudiant : null,
        projetDetails: projet || rendu.projet,
        utiliserIA: evaluation.utiliserIA
      };
    }));
    
    res.status(200).json(evaluationsWithDetails);
  } catch (error) {
    console.error("Erreur lors de la récupération des évaluations", error);
    res.status(500).json({
      message: "Erreur serveur",
      error: error.message
    });
  }
};

// GET a specific evaluation by ID
exports.getEvaluationById = async (req, res) => {
  const { id } = req.params;
  try {
    const evaluation = await Evaluation.findById(id).populate('rendu');
    if (!evaluation) {
      return res.status(404).json({ message: "Évaluation non trouvée" });
    }
    res.status(200).json(evaluation);
  } catch (error) {
    res.status(500).json({ message: "Erreur lors de la récupération de l'évaluation", error: error.message });
  }
};

// UPDATE an existing evaluation
exports.updateEvaluation = async (req, res) => {
  const { renduId } = req.params;
  const { scores, commentaires } = req.body;

  try {
    // Trouver l'évaluation existante
    const evaluation = await Evaluation.findOne({ rendu: renduId });
    if (!evaluation) {
      return res.status(404).json({ message: "Évaluation non trouvée" });
    }

    // Mettre à jour l'évaluation
    evaluation.scores = scores;
    evaluation.commentaires = commentaires;
    evaluation.dateEvaluation = new Date();

    await evaluation.save();

    return res.status(200).json({
      message: "Évaluation mise à jour avec succès",
      evaluation
    });
  } catch (error) {
    console.error("Erreur lors de la mise à jour de l'évaluation", error);
    return res.status(500).json({
      message: "Erreur serveur",
      error: error.message
    });
  }
};

// DELETE an evaluation
exports.deleteEvaluation = async (req, res) => {
  const { id } = req.params;

  try {
    const deleted = await Evaluation.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ message: "Évaluation non trouvée" });
    }
    res.status(200).json({ message: "Évaluation supprimée avec succès" });
  } catch (error) {
    res.status(500).json({ message: "Erreur lors de la suppression", error: error.message });
  }
};

// Fonction de diagnostic pour vérifier l'état des évaluations
exports.diagnosticEvaluations = async (req, res) => {
  try {
    // Récupérer toutes les évaluations
    const evaluations = await Evaluation.find();
    
    // Récupérer tous les rendus
    const rendus = await Rendu.find();
    
    // Créer un mapping des évaluations par rendu
    const evaluationsByRendu = {};
    evaluations.forEach(eval => {
      evaluationsByRendu[eval.rendu.toString()] = eval;
    });
    
    // Vérifier chaque rendu
    const results = [];
    for (const rendu of rendus) {
      const renduId = rendu._id.toString();
      const hasEvaluation = !!evaluationsByRendu[renduId];
      const statusMatch = rendu.statut === 'évalué' && hasEvaluation;
      
      results.push({
        renduId,
        titre: rendu.projet ? 'Projet lié' : 'Pas de projet lié',
        statut: rendu.statut,
        hasEvaluation,
        statusMatch,
        evaluationId: hasEvaluation ? evaluationsByRendu[renduId]._id : null
      });
    }
    
    // Compter les problèmes
    const problems = results.filter(r => !r.statusMatch || (r.statut === 'évalué' && !r.hasEvaluation));
    
    res.status(200).json({
      totalRendus: rendus.length,
      totalEvaluations: evaluations.length,
      problemCount: problems.length,
      problems,
      allResults: results
    });
  } catch (error) {
    console.error("Erreur lors du diagnostic des évaluations", error);
    res.status(500).json({
      message: "Erreur serveur",
      error: error.message
    });
  }
};

// Fonction pour corriger les problèmes d'évaluations
exports.fixEvaluationIssues = async (req, res) => {
  try {
    // Récupérer toutes les évaluations
    const evaluations = await Evaluation.find();
    
    // Créer un mapping des évaluations par rendu
    const evaluationsByRendu = {};
    evaluations.forEach(eval => {
      evaluationsByRendu[eval.rendu.toString()] = eval;
    });
    
    // Récupérer tous les rendus
    const rendus = await Rendu.find();
    
    // Corrections effectuées
    const corrections = [];
    
    // Corriger chaque rendu
    for (const rendu of rendus) {
      const renduId = rendu._id.toString();
      const hasEvaluation = !!evaluationsByRendu[renduId];
      
      // Si le rendu a une évaluation mais son statut n'est pas 'évalué'
      if (hasEvaluation && rendu.statut !== 'évalué') {
        rendu.statut = 'évalué';
        rendu.evaluation = evaluationsByRendu[renduId]._id;
        await rendu.save();
        corrections.push({
          type: 'status_updated',
          renduId,
          newStatus: 'évalué'
        });
      }
      
      // Si le rendu n'a pas de champ evaluation mais a une évaluation
      if (hasEvaluation && !rendu.evaluation) {
        rendu.evaluation = evaluationsByRendu[renduId]._id;
        await rendu.save();
        corrections.push({
          type: 'evaluation_field_added',
          renduId,
          evaluationId: evaluationsByRendu[renduId]._id
        });
      }
    }
    
    res.status(200).json({
      message: "Corrections effectuées avec succès",
      correctionsCount: corrections.length,
      corrections
    });
  } catch (error) {
    console.error("Erreur lors de la correction des problèmes d'évaluations", error);
    res.status(500).json({
      message: "Erreur serveur",
      error: error.message
    });
  }
};

// Fonction pour mettre à jour les groupes manquants
exports.updateMissingGroups = async (req, res) => {
  try {
    // Récupérer tous les rendus avec leurs étudiants
    const rendus = await Rendu.find().populate('etudiant');
    
    let updatedCount = 0;
    const updates = [];
    
    // Parcourir les rendus et vérifier les groupes manquants
    for (const rendu of rendus) {
      if (rendu.etudiant && !rendu.etudiant.groupe) {
        // Récupérer le projet associé au rendu
        const projet = await Projet.findById(rendu.projet);
        
        if (projet && projet.groupe) {
          // Mettre à jour l'étudiant avec le groupe du projet
          await User.findByIdAndUpdate(rendu.etudiant._id, {
            groupe: projet.groupe
          });
          
          updatedCount++;
          updates.push({
            etudiantId: rendu.etudiant._id,
            nom: rendu.etudiant.nom,
            prenom: rendu.etudiant.prenom,
            nouveauGroupe: projet.groupe
          });
        }
      }
    }
    
    res.status(200).json({
      message: `${updatedCount} étudiants mis à jour avec leur groupe`,
      updates
    });
  } catch (error) {
    console.error("Erreur lors de la mise à jour des groupes", error);
    res.status(500).json({
      message: "Erreur serveur",
      error: error.message
    });
  }
};
