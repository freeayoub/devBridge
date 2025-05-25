const mongoose = require('mongoose');

// Définition du schéma pour l'équipe
const teamSchema = new mongoose.Schema({
name: { 
    type: String,
    required: true, 
    unique: true }, // Nom de l'équipe
    
description: { 
    type: String 
}, // Description de l'équipe


admin: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
    }, // Admin de l'équipe (un étudiant)


  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Membres de l'équipe (étudiants)
  createdAt: { type: Date, default: Date.now }, // Date de création de l'équipe
},{timestamps:true});

// Création du modèle basé sur le schéma
const Team = mongoose.model('Team', teamSchema);

module.exports = {
    Team
}
