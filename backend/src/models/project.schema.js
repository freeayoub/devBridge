const mongoose = require('mongoose');

const projetSchema = new mongoose.Schema({
  titre: { type: String, required: true },
  description: String,
  professeur: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  dateLimite: Date,
  fichiers: [String],
  // groupe: {  // <-- group ID reference
  //   type: mongoose.Schema.Types.ObjectId,
  //   ref: 'Groupe',
  //   required: true
  // },
  groupe:{ type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Projet', projetSchema);
