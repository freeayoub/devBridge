const Evaluation = require("../models/evaluation.schema");
const Rendu = require("../models/rendu.schema");
const Projet = require("../models/project.schema");
const User = require("../models/User");
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
    console.log("Début de la mise à jour des groupes manquants...");

    // D'abord, corriger les utilisateurs avec des groupes génériques incorrects
    const usersWithGenericGroups = await User.find({
      group: { $in: ['Groupe Étudiants', 'Groupe Professeurs', 'Groupe Administrateurs'] }
    });

    console.log(`Trouvé ${usersWithGenericGroups.length} utilisateurs avec des groupes génériques à corriger`);

    // Corriger ces utilisateurs d'abord
    for (const user of usersWithGenericGroups) {
      let correctGroup = null;

      // Chercher le bon groupe via les rendus
      const userRendus = await Rendu.find({ etudiant: user._id }).populate('projet');
      if (userRendus.length > 0) {
        for (const rendu of userRendus) {
          if (rendu.projet && rendu.projet.groupe) {
            correctGroup = rendu.projet.groupe;
            break;
          }
        }
      }

      // Si pas trouvé via rendus, utiliser un groupe réaliste
      if (!correctGroup) {
        if (user.role === 'student' || user.profession === 'etudiant') {
          correctGroup = '1cinfo'; // Groupe par défaut pour les étudiants
        } else if (user.role === 'teacher' || user.profession === 'professeur') {
          correctGroup = 'professeurs';
        } else {
          correctGroup = 'admin';
        }
      }

      // Mettre à jour avec le bon groupe
      await User.findByIdAndUpdate(user._id, { group: correctGroup });
      console.log(`Groupe corrigé pour ${user.email}: ${user.group} → ${correctGroup}`);
    }

    // Maintenant, récupérer tous les groupes réels existants dans la base de données
    const usersWithGroups = await User.find({
      $and: [
        { group: { $exists: true } },
        { group: { $ne: null } },
        { group: { $ne: "" } },
        { group: { $nin: ['Groupe Étudiants', 'Groupe Professeurs', 'Groupe Administrateurs'] } }
      ]
    }).distinct('group');

    console.log("Groupes réels existants trouvés:", usersWithGroups);

    // Récupérer tous les utilisateurs qui n'ont pas de groupe défini
    const usersWithoutGroup = await User.find({
      $or: [
        { group: { $exists: false } },
        { group: null },
        { group: "" },
        { groupe: { $exists: false } },
        { groupe: null },
        { groupe: "" }
      ]
    });

    console.log(`Trouvé ${usersWithoutGroup.length} utilisateurs sans groupe`);

    let updatedCount = 0;
    const updates = [];

    // Pour chaque utilisateur sans groupe
    for (const user of usersWithoutGroup) {
      let assignedGroup = null;

      // Stratégie 1: Chercher dans les rendus de l'utilisateur
      const userRendus = await Rendu.find({ etudiant: user._id }).populate('projet');
      if (userRendus.length > 0) {
        for (const rendu of userRendus) {
          if (rendu.projet && rendu.projet.groupe) {
            assignedGroup = rendu.projet.groupe;
            console.log(`Groupe trouvé via projet pour ${user.email}: ${assignedGroup}`);
            break;
          }
        }
      }

      // Stratégie 2: Si pas de groupe trouvé via projets, utiliser un groupe existant par défaut
      if (!assignedGroup && usersWithGroups.length > 0) {
        // Assigner le premier groupe existant comme défaut
        assignedGroup = usersWithGroups[0];
        console.log(`Groupe par défaut assigné pour ${user.email}: ${assignedGroup}`);
      }

      // Stratégie 3: Si aucun groupe existant, créer un groupe basé sur le rôle
      if (!assignedGroup) {
        if (user.role === 'student' || user.profession === 'etudiant') {
          assignedGroup = '1cinfo'; // Groupe par défaut pour les étudiants
        } else if (user.role === 'teacher' || user.profession === 'professeur') {
          assignedGroup = 'professeurs';
        } else if (user.role === 'admin') {
          assignedGroup = 'admin';
        } else {
          assignedGroup = 'non-assigne';
        }
        console.log(`Nouveau groupe créé pour ${user.email}: ${assignedGroup}`);
      }

      // Mettre à jour l'utilisateur avec le groupe trouvé/assigné
      if (assignedGroup) {
        await User.findByIdAndUpdate(user._id, {
          group: assignedGroup
        });

        updatedCount++;
        updates.push({
          etudiantId: user._id,
          nom: user.lastName || user.nom || '',
          prenom: user.firstName || user.prenom || '',
          email: user.email,
          role: user.role,
          profession: user.profession,
          nouveauGroupe: assignedGroup,
          methode: userRendus.length > 0 ? 'via-projet' : 'par-defaut'
        });

        console.log(`Utilisateur ${user.email} assigné au groupe: ${assignedGroup}`);
      }
    }

    console.log(`Mise à jour terminée. ${updatedCount} utilisateurs mis à jour.`);

    res.status(200).json({
      message: `${updatedCount} étudiants mis à jour avec leur groupe`,
      updatedCount,
      updates,
      groupesExistants: usersWithGroups
    });
  } catch (error) {
    console.error("Erreur lors de la mise à jour des groupes", error);
    res.status(500).json({
      message: "Erreur serveur",
      error: error.message
    });
  }
};

// Fonction temporaire pour corriger les groupes génériques
exports.fixGenericGroups = async (req, res) => {
  try {
    console.log("Correction des groupes génériques...");

    // Corriger "Groupe Étudiants" → "1cinfo"
    const result1 = await User.updateMany(
      { group: "Groupe Étudiants" },
      { $set: { group: "1cinfo" } }
    );

    // Corriger "Groupe Professeurs" → "professeurs"
    const result2 = await User.updateMany(
      { group: "Groupe Professeurs" },
      { $set: { group: "professeurs" } }
    );

    // Corriger "Groupe Administrateurs" → "admin"
    const result3 = await User.updateMany(
      { group: "Groupe Administrateurs" },
      { $set: { group: "admin" } }
    );

    const totalUpdated = result1.modifiedCount + result2.modifiedCount + result3.modifiedCount;

    console.log(`Correction terminée: ${totalUpdated} utilisateurs corrigés`);
    console.log(`- Groupe Étudiants → 1cinfo: ${result1.modifiedCount}`);
    console.log(`- Groupe Professeurs → professeurs: ${result2.modifiedCount}`);
    console.log(`- Groupe Administrateurs → admin: ${result3.modifiedCount}`);

    res.status(200).json({
      message: `${totalUpdated} groupes corrigés`,
      corrections: {
        etudiants: result1.modifiedCount,
        professeurs: result2.modifiedCount,
        administrateurs: result3.modifiedCount
      },
      totalUpdated
    });
  } catch (error) {
    console.error("Erreur lors de la correction des groupes", error);
    res.status(500).json({
      message: "Erreur serveur",
      error: error.message
    });
  }
};
