const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const {Team} = require('../models/Team'); // Importer le modèle Team


// Récupérer toutes les équipes
/**
 * @desc Get All Teams
 * @route /
 * @Method GET
 * @access public
 */

router.get('/', async (req, res) => {
    try {
        const teams = await Team.find();
        res.status(200).json(teams);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});



// Créer une nouvelle équipe
/**
 * @desc Get All Teams
 * @route /
 * @Method POST
 * @access public
 */
router.post('/', async (req, res) => {
    try {
        const { name, description, admin, members } = req.body;
        console.log('Backend received:', req.body); // Add this for debugging

        // Vérifier si l'équipe existe déjà
        const existingTeam = await Team.findOne({ name });
        if (existingTeam) {
            return res.status(400).json({ message: "L'équipe existe déjà." });
        }

        // Créer une nouvelle équipe
        const newTeam = new Team({
            name,
            description,
            admin,
            members,
        });

        await newTeam.save();
        res.status(201).json(newTeam);
    } catch (err) {
        console.error('Error creating team:', err); // Add this for debugging
        res.status(500).json({ message: err.message });
    }
});

// Récupérer une équipe par son ID
/**
 * @desc Get Teams by ID
 * @route /
 * @Method GET
 * @access public
 */
router.get('/:id', async (req, res) => {
    try {
        const team = await Team.findById(req.params.id);
        if (!team) {
        return res.status(404).json({ message: "Équipe non trouvée" });
    }
    res.status(200).json(team);
    } catch (err) {
    res.status(500).json({ message: err.message });
    }
});

// Mettre à jour une équipe par son ID
/**
 * @desc Mise a jour dun equipe
 * @route /
 * @Method PUT
 * @access public
 */
router.put('/:id', async (req, res) => {
    try {
        const { name, description, admin, members } = req.body;

    const team = await Team.findById(req.params.id);
    if (!team) {
        return res.status(404).json({ message: "Équipe non trouvée" });
    }

    // Mise à jour de l'équipe
    team.name = name || team.name;
    team.description = description || team.description;
    team.admin = admin || team.admin;
    team.members = members || team.members;

    await team.save();
    res.status(200).json(team);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Ajouter un membre à une équipe
/**
 * @desc Add Member to Team
 * @route /:id/members
 * @Method POST
 * @access public
 */
router.post('/:id/members', async (req, res) => {
    try {
        const { id } = req.params;
        const { userId, role } = req.body;

        console.log(`Adding member to team ${id}:`, req.body);

        // Vérifier si l'équipe existe
        const team = await Team.findById(id);
        if (!team) {
            return res.status(404).json({ message: "Équipe non trouvée" });
        }

        // Vérifier si le membre existe déjà dans l'équipe
        if (team.members && team.members.includes(userId)) {
            return res.status(400).json({ message: "Ce membre fait déjà partie de l'équipe" });
        }

        // Ajouter le membre à l'équipe
        if (!team.members) {
            team.members = [];
        }
        team.members.push(userId);

        // Sauvegarder l'équipe mise à jour
        await team.save();

        res.status(200).json(team);
    } catch (err) {
        console.error('Error adding member to team:', err);
        res.status(500).json({ message: err.message });
    }
});

// Supprimer un membre d'une équipe
/**
 * @desc Remove Member from Team
 * @route /:id/members/:memberId
 * @Method DELETE
 * @access public
 */
router.delete('/:id/members/:memberId', async (req, res) => {
    try {
        const { id, memberId } = req.params;

        console.log(`Removing member ${memberId} from team ${id}`);
        console.log('Request params:', req.params);

        // Vérifier si l'équipe existe
        const team = await Team.findById(id);
        if (!team) {
            console.log('Équipe non trouvée avec ID:', id);
            return res.status(404).json({ message: "Équipe non trouvée" });
        }

        console.log('Équipe trouvée:', team.name);
        console.log('Membres avant suppression:', team.members);

        // Vérifier si le membre existe dans l'équipe
        if (!team.members) {
            return res.status(404).json({ message: "Aucun membre dans l'équipe" });
        }

        // Convertir les ObjectId en chaînes pour la comparaison
        const memberExists = team.members.some(member => member.toString() === memberId);
        if (!memberExists) {
            return res.status(404).json({ message: "Membre non trouvé dans l'équipe" });
        }

        // Supprimer le membre de l'équipe
        team.members = team.members.filter(member => member.toString() !== memberId);
        console.log('Membres après filtrage:', team.members);

        // Sauvegarder l'équipe mise à jour
        await team.save();
        console.log('Équipe sauvegardée avec succès');

        res.status(200).json({ message: "Membre supprimé avec succès", team });
    } catch (err) {
        console.error('Error removing member from team:', err);
        res.status(500).json({ message: err.message });
    }
});

// Supprimer une équipe par son ID
/**
 * @desc Delete Team
 * @route /
 * @Method DELETE
 * @access public
 */
// Supprimer une équipe
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "ID invalide." });
    }
        const deletedTeam = await Team.findByIdAndDelete(id);
    if (!deletedTeam) {
        return res.status(404).json({ message: "Équipe non trouvée." });
    }
        res.status(200).json({ message: "Équipe supprimée avec succès." });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;