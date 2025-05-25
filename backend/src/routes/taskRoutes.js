const express = require('express');
const router = express.Router();
const Task = require('../models/Task');
const mongoose = require('mongoose');

// Récupérer toutes les tâches
router.get('/', async (req, res) => {
  try {
    const tasks = await Task.find()
      .populate('assignedTo', 'name firstName lastName email')
      .populate('createdBy', 'name firstName lastName email')
      .populate('teamId', 'name');
    
    res.status(200).json(tasks);
  } catch (error) {
    console.error('Erreur lors de la récupération des tâches:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des tâches', error: error.message });
  }
});

// Récupérer les tâches d'une équipe spécifique
router.get('/team/:teamId', async (req, res) => {
  try {
    const { teamId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(teamId)) {
      return res.status(400).json({ message: 'ID d\'équipe invalide' });
    }
    
    const tasks = await Task.find({ teamId })
      .populate('assignedTo', 'name firstName lastName email')
      .populate('createdBy', 'name firstName lastName email');
    
    res.status(200).json(tasks);
  } catch (error) {
    console.error('Erreur lors de la récupération des tâches de l\'équipe:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des tâches de l\'équipe', error: error.message });
  }
});

// Récupérer une tâche par son ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID de tâche invalide' });
    }
    
    const task = await Task.findById(id)
      .populate('assignedTo', 'name firstName lastName email')
      .populate('createdBy', 'name firstName lastName email')
      .populate('teamId', 'name');
    
    if (!task) {
      return res.status(404).json({ message: 'Tâche non trouvée' });
    }
    
    res.status(200).json(task);
  } catch (error) {
    console.error('Erreur lors de la récupération de la tâche:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération de la tâche', error: error.message });
  }
});

// Créer une nouvelle tâche
router.post('/', async (req, res) => {
  try {
    const { title, description, status, priority, dueDate, assignedTo, teamId, createdBy } = req.body;
    
    if (!title) {
      return res.status(400).json({ message: 'Le titre est requis' });
    }
    
    if (!teamId || !mongoose.Types.ObjectId.isValid(teamId)) {
      return res.status(400).json({ message: 'ID d\'équipe invalide ou manquant' });
    }
    
    const newTask = new Task({
      title,
      description,
      status: status || 'todo',
      priority: priority || 'medium',
      dueDate,
      assignedTo,
      teamId,
      createdBy
    });
    
    const savedTask = await newTask.save();
    
    // Populate the saved task with user and team details
    const populatedTask = await Task.findById(savedTask._id)
      .populate('assignedTo', 'name firstName lastName email')
      .populate('createdBy', 'name firstName lastName email')
      .populate('teamId', 'name');
    
    res.status(201).json(populatedTask);
  } catch (error) {
    console.error('Erreur lors de la création de la tâche:', error);
    res.status(500).json({ message: 'Erreur lors de la création de la tâche', error: error.message });
  }
});

// Mettre à jour une tâche existante
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, status, priority, dueDate, assignedTo } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID de tâche invalide' });
    }
    
    const updatedTask = await Task.findByIdAndUpdate(
      id,
      { title, description, status, priority, dueDate, assignedTo },
      { new: true, runValidators: true }
    )
      .populate('assignedTo', 'name firstName lastName email')
      .populate('createdBy', 'name firstName lastName email')
      .populate('teamId', 'name');
    
    if (!updatedTask) {
      return res.status(404).json({ message: 'Tâche non trouvée' });
    }
    
    res.status(200).json(updatedTask);
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la tâche:', error);
    res.status(500).json({ message: 'Erreur lors de la mise à jour de la tâche', error: error.message });
  }
});

// Mettre à jour uniquement le statut d'une tâche
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID de tâche invalide' });
    }
    
    if (!status || !['todo', 'in-progress', 'done'].includes(status)) {
      return res.status(400).json({ message: 'Statut invalide' });
    }
    
    const updatedTask = await Task.findByIdAndUpdate(
      id,
      { status },
      { new: true, runValidators: true }
    )
      .populate('assignedTo', 'name firstName lastName email')
      .populate('createdBy', 'name firstName lastName email')
      .populate('teamId', 'name');
    
    if (!updatedTask) {
      return res.status(404).json({ message: 'Tâche non trouvée' });
    }
    
    res.status(200).json(updatedTask);
  } catch (error) {
    console.error('Erreur lors de la mise à jour du statut de la tâche:', error);
    res.status(500).json({ message: 'Erreur lors de la mise à jour du statut de la tâche', error: error.message });
  }
});

// Supprimer une tâche
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID de tâche invalide' });
    }
    
    const deletedTask = await Task.findByIdAndDelete(id);
    
    if (!deletedTask) {
      return res.status(404).json({ message: 'Tâche non trouvée' });
    }
    
    res.status(200).json({ message: 'Tâche supprimée avec succès', id });
  } catch (error) {
    console.error('Erreur lors de la suppression de la tâche:', error);
    res.status(500).json({ message: 'Erreur lors de la suppression de la tâche', error: error.message });
  }
});

module.exports = router;
