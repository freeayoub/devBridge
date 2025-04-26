const mongoose = require('mongoose');

const reunionSchema = new mongoose.Schema({
  titre: { type: String, required: true },
  description: String,
  date: { type: Date, required: true },
  heureDebut: { type: String, required: true },
  heureFin: { type: String, required: true },
  createur: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  planning: { type: mongoose.Schema.Types.ObjectId, ref: 'Planning', required: true },
  lieu: String,
  lienVisio: String,
}, { timestamps: true });

module.exports = mongoose.model('Reunion', reunionSchema);






