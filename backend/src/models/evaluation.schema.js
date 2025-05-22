// models/Evaluation.js

const mongoose = require('mongoose');

const evaluationSchema = new mongoose.Schema({

    rendu: { type: mongoose.Schema.Types.ObjectId, ref: 'Rendu', required: true },
    projet: { type: mongoose.Schema.Types.ObjectId, ref: 'Projet', required: true },
    scores: {
      
      structure: Number,
      pratiques: Number,
      fonctionnalite: Number,
      originalite: Number,
      pertinence: Number,
      qualite: Number

    },

    rapportIA: mongoose.Schema.Types.Mixed,
    dateEvaluation: Date

  });


module.exports = mongoose.model('Evaluation', evaluationSchema);