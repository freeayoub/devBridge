const mongoose = require('mongoose');

const teamMemberSchema = new mongoose.Schema({
    user: {
        type: String, // Changé de ObjectId à String pour accepter les IDs sous forme de chaîne
        ref: 'User',
        required: true
    },
    role: {
        type: String,
        enum: ["admin", "membre"],
        required: true
    },
    userType: {
        type: String,
        enum: ["etudiant", "enseignant"],
        required: true
    },
    team: {
        type: String, // Changé de ObjectId à String pour accepter les IDs sous forme de chaîne
        ref: 'Team',
        required: true
    }
},
{ timestamps: true });

const TeamMember = mongoose.model('TeamMember', teamMemberSchema);
module.exports = TeamMember;