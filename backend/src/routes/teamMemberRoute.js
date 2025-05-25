const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const TeamMember = require("../models/TeamMember")


//Récupérer tous les membres d'équipe
router.get('/', async (req, res) => {
    try {
        const members = await TeamMember.find()
        res.status(200).json(members);
        } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


// Récupérer tous les membres d'une équipe spécifique
router.get('/team/:teamId', async (req, res) => {
    try {
        const { teamId } = req.params;

        // Vérifier si l'ID est présent
        if (!teamId) {
            return res.status(400).json({ message: "ID d'équipe manquant." });
        }

        // Chercher tous les membres de cette équipe
        const members = await TeamMember.find({ team: teamId }).populate('user');

        // Renvoyer la liste des membres
        res.status(200).json(members);
    } catch (err) {
        // Gérer les erreurs
        res.status(500).json({ message: err.message });
    }
});

// Récupérer un membre spécifique par ID avec les informations de l'équipe
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        // Vérifier si l'ID est présent
        if (!id) {
            return res.status(400).json({ message: "ID manquant." });
        }
        // Chercher le membre dans la base de données et inclure les informations de l'équipe
        const member = await TeamMember.findById(id).populate('team');
        // Vérifier si le membre existe
        if (!member) {
            return res.status(404).json({ message: "Membre non trouvé." });
        }
        // Renvoyer les informations du membre avec les informations de l'équipe
        res.status(200).json(member);
    } catch (err) {
        // Gérer les erreurs
        res.status(500).json({ message: err.message });
    }
});

// Vérifier si le membre existe déjà dans l'équipe avant de l'ajouter
router.post('/', async (req, res) => {
    try {
        console.log('Received request body:', req.body);
        const { team, user, role, userType } = req.body;
        console.log('Extracted data:', { team, user, role, userType });
        console.log('Team ID type:', typeof team, 'value:', team);
        console.log('User ID type:', typeof user, 'value:', user);

        // Vérifier si les IDs sont présents
        if (!team || !user) {
            return res.status(400).json({ message: "ID de l'équipe ou de l'utilisateur manquant." });
        }

        // Vérifier si le rôle est valide (admin ou membre)
        const validRoles = ["admin", "membre"];
        if (!validRoles.includes(role)) {
            return res.status(400).json({ message: "Rôle invalide." });
        }

        // Vérifier si le type d'utilisateur est valide (étudiant ou enseignant)
        const validUserTypes = ["etudiant", "enseignant"];
        if (!validUserTypes.includes(userType)) {
            return res.status(400).json({ message: "Type d'utilisateur invalide." });
        }

        // 🔍 Vérifier si ce membre est déjà dans cette équipe
        const existingMember = await TeamMember.findOne({ team, user });
        if (existingMember) {
            return res.status(400).json({ message: "Ce membre est déjà dans l'équipe." });
        }

        // Vérifier s'il y a déjà un admin dans l'équipe si le rôle est admin
        if (role === "admin") {
            const isAlreadyAdmin = await TeamMember.findOne({ team, role: "admin" });
            if (isAlreadyAdmin) {
                return res.status(400).json({ message: "Il y a déjà un admin pour cette équipe." });
            }
        }

        // Ajouter le nouveau membre avec les données correctes
        const newMember = new TeamMember({
            team: team,
            user: user,
            role,
            userType
        });

        // Sauvegarder le membre dans la base de données
        const savedMember = await newMember.save();

        // Répondre avec le membre ajouté
        res.status(201).json(savedMember);
    } catch (err) {
        // Gestion d'erreurs serveur
        res.status(500).json({ message: err.message });
    }
});


// Supprimer un membre d'équipe
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Vérification si l'ID est présent
        if (!id) {
            return res.status(400).json({ message: "ID manquant." });
        }

        // Chercher le membre à supprimer
        const deletedMember = await TeamMember.findByIdAndDelete(id);

        // Si le membre n'est pas trouvé, renvoyer une erreur
        if (!deletedMember) {
            return res.status(404).json({ message: "Membre non trouvé." });
        }

        // Retourner une réponse de succès
        res.status(200).json({ message: "Membre supprimé avec succès." });
    } catch (err) {
        // Gestion des erreurs serveur
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;