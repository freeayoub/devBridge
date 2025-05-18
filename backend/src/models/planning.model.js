const mongoose = require('mongoose');

const planningSchema = new mongoose.Schema({
  titre: { 
    type: String, 
    required: [true, 'Le titre est obligatoire'],
    trim: true,
    maxlength: [100, 'Le titre ne peut dépasser 100 caractères']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'La description ne peut dépasser 500 caractères']
  },
  dateDebut: { 
    type: Date, 
    required: [true, 'La date de début est obligatoire'] 
  },
  dateFin: { 
    type: Date, 
    required: [true, 'La date de fin est obligatoire'],
    validate: {
      validator: function(value) {
        return value > this.dateDebut;
      },
      message: 'La date de fin doit être postérieure à la date de début'
    }
  },
  createur: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: [true, 'Le créateur est obligatoire'] 
  },
  participants: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: [true, 'Au moins un participant est obligatoire']
  }],
  reunions: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Reunion' 
  }]
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index pour améliorer les performances de recherche
planningSchema.index({ createur: 1 });
planningSchema.index({ dateDebut: 1 });
planningSchema.index({ dateFin: 1 });

module.exports = mongoose.model('Planning', planningSchema);