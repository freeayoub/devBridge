export interface Task {
  _id?: string;
  title: string;
  description?: string;
  status: 'todo' | 'in-progress' | 'done';
  priority: 'low' | 'medium' | 'high';
  dueDate?: Date;
  assignedTo?: string; // ID de l'utilisateur assigné
  teamId: string; // ID de l'équipe à laquelle la tâche appartient
  createdBy?: string; // ID de l'utilisateur qui a créé la tâche
  createdAt?: Date;
  updatedAt?: Date;
}