const mongoose = require('mongoose');

const renduSchema = new mongoose.Schema({
  projet: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Projet', 
    required: true 
  },
  etudiant: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true 
  },
  fichiers: [String],
  dateSoumission: { type: Date, default: Date.now },
  statut: { 
    type: String, 
    enum: ['soumis', 'en évaluation', 'évalué'], 
    default: 'soumis' 
  },
  description: String,
  // Ajout du champ evaluation
  evaluation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Evaluation',
    default: null
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Rendu', renduSchema);
