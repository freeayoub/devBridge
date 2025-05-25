import { Component, OnInit } from '@angular/core';
import {
  CdkDragDrop,
  moveItemInArray,
  transferArrayItem,
} from '@angular/cdk/drag-drop';
import { ActivatedRoute, Router } from '@angular/router';
import { TaskService } from 'src/app/services/task.service';
import { EquipeService } from 'src/app/services/equipe.service';
import { AuthuserService } from 'src/app/services/authuser.service';
import { NotificationService } from 'src/app/services/notification.service';
import { Task } from 'src/app/models/task.model';
import { Equipe } from 'src/app//models/equipe.model';
import { User } from 'src/app/models/user.model';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-task-list',
  templateUrl: './task-list.component.html',
  styleUrls: ['./task-list.component.css'],
})
export class TaskListComponent implements OnInit {
  tasks: Task[] = [];
  teamId: string | null = null;
  team: Equipe | null = null;
  loading = false;
  error: string | null = null;
  users: User[] = [];
  newTask!: Task;
  editingTask: Task | null = null;
  showTaskForm = false;

  // Filtres
  statusFilter: string = 'all';
  priorityFilter: string = 'all';
  searchTerm: string = '';

  constructor(
    private taskService: TaskService,
    private equipeService: EquipeService,
    private userService: AuthuserService,
    private route: ActivatedRoute,
    private router: Router,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    // Initialiser la nouvelle tâche
    this.newTask = this.initializeNewTask();

    this.route.paramMap.subscribe((params) => {
      this.teamId = params.get('id');
      if (this.teamId) {
        this.loadTeamDetails(this.teamId);
        this.loadTasks(this.teamId);
        this.loadUsers();
      } else {
        this.error = "ID d'équipe manquant";
        this.notificationService.showError("ID d'équipe manquant");
      }
    });
  }

  loadTeamDetails(teamId: string): void {
    this.loading = true;

    // Utiliser les données de test si l'API n'est pas disponible
    const useMockData = false; // Mettre à true pour utiliser les données de test

    if (useMockData) {
      // Données de test pour simuler les détails de l'équipe
      const mockTeam: Equipe = {
        _id: teamId,
        name: 'Équipe ' + teamId,
        description: "Description de l'équipe " + teamId,
        admin: 'admin123',
        members: [],
      };

      setTimeout(() => {
        this.team = mockTeam;
        this.loading = false;
        console.log("Détails de l'équipe chargés (mock):", this.team);
      }, 300);
    } else {
      // Utiliser l'API réelle
      this.equipeService
        .getEquipe(teamId)
        .pipe(finalize(() => (this.loading = false)))
        .subscribe({
          next: (data) => {
            this.team = data;
            console.log("Détails de l'équipe chargés depuis l'API:", this.team);
          },
          error: (error) => {
            console.error(
              "Erreur lors du chargement des détails de l'équipe:",
              error
            );
            this.error = "Impossible de charger les détails de l'équipe";
            this.notificationService.showError(
              "Erreur lors du chargement des détails de l'équipe"
            );

            // Fallback aux données de test en cas d'erreur
            const mockTeam: Equipe = {
              _id: teamId,
              name: 'Équipe ' + teamId + ' (fallback)',
              description: "Description de l'équipe " + teamId,
              admin: 'admin123',
              members: [],
            };

            this.team = mockTeam;
          },
        });
    }
  }

  loadTasks(teamId: string): void {
    this.loading = true;

    // Utiliser les données de test si l'API n'est pas disponible
    const useMockData = false; // Mettre à true pour utiliser les données de test

    if (useMockData) {
      // Données de test pour simuler les tâches
      const mockTasks: Task[] = [
        {
          _id: '1',
          title: 'Tâche 1',
          description: 'Description de la tâche 1',
          status: 'todo',
          priority: 'high',
          teamId: teamId,
        },
        {
          _id: '2',
          title: 'Tâche 2',
          description: 'Description de la tâche 2',
          status: 'todo',
          priority: 'medium',
          teamId: teamId,
        },
        {
          _id: '3',
          title: 'Tâche 3',
          description: 'Description de la tâche 3',
          status: 'in-progress',
          priority: 'high',
          teamId: teamId,
        },
        {
          _id: '4',
          title: 'Tâche 4',
          description: 'Description de la tâche 4',
          status: 'done',
          priority: 'low',
          teamId: teamId,
        },
      ];

      setTimeout(() => {
        this.tasks = mockTasks;
        this.sortTasks();
        this.loading = false;
        console.log('Tâches chargées (mock):', this.tasks);
      }, 500);
    } else {
      // Utiliser l'API réelle
      this.taskService
        .getTasksByTeam(teamId)
        .pipe(finalize(() => (this.loading = false)))
        .subscribe({
          next: (data: Task[]) => {
            this.tasks = data;
            this.sortTasks();
            console.log("Tâches chargées depuis l'API:", this.tasks);
          },
          error: (error: any) => {
            console.error('Erreur lors du chargement des tâches:', error);
            this.error = 'Impossible de charger les tâches';
            this.notificationService.showError(
              'Erreur lors du chargement des tâches'
            );

            // Fallback aux données de test en cas d'erreur
            const mockTasks: Task[] = [
              {
                _id: '1',
                title: 'Tâche 1 (fallback)',
                description: 'Description de la tâche 1',
                status: 'todo',
                priority: 'high',
                teamId: teamId,
              },
              {
                _id: '2',
                title: 'Tâche 2 (fallback)',
                description: 'Description de la tâche 2',
                status: 'todo',
                priority: 'medium',
                teamId: teamId,
              },
            ];

            this.tasks = mockTasks;
            this.sortTasks();
            console.log('Tâches chargées (fallback):', this.tasks);
          },
        });
    }
  }

  // Gestion du glisser-déposer
  drop(event: CdkDragDrop<Task[]>) {
    if (event.previousContainer === event.container) {
      // Déplacement dans la même liste
      moveItemInArray(
        event.container.data,
        event.previousIndex,
        event.currentIndex
      );
    } else {
      // Déplacement entre listes
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex
      );

      // Mettre à jour le statut de la tâche
      const task = event.container.data[event.currentIndex];
      let newStatus: 'todo' | 'in-progress' | 'done';

      if (event.container.id === 'todo-list') {
        newStatus = 'todo';
      } else if (event.container.id === 'in-progress-list') {
        newStatus = 'in-progress';
      } else {
        newStatus = 'done';
      }

      if (task._id && task.status !== newStatus) {
        task.status = newStatus;
        this.updateTaskStatus(task, newStatus);
      }
    }
  }

  loadUsers(): void {
    // Utiliser les données de test si l'API n'est pas disponible
    const useMockData = false; // Mettre à true pour utiliser les données de test

    if (useMockData) {
      // Données de test pour simuler les utilisateurs
      const mockUsers: User[] = [
        {
          _id: 'user1',
          username: 'john_doe',
          email: 'john@example.com',
          role: 'admin',
          isActive: true,
        },
        {
          _id: 'user2',
          username: 'jane_smith',
          email: 'jane@example.com',
          role: 'student',
          isActive: true,
        },
      ];

      setTimeout(() => {
        this.users = mockUsers;
        console.log('Utilisateurs chargés (mock):', this.users);
      }, 400);
    } else {
      // TODO: Implémenter l'API réelle pour récupérer les utilisateurs
      // Pour l'instant, utiliser les données mockées
      const mockUsers: User[] = [
        {
          _id: 'user1',
          username: 'john_doe',
          email: 'john@example.com',
          role: 'admin',
          isActive: true,
        },
        {
          _id: 'user2',
          username: 'jane_smith',
          email: 'jane@example.com',
          role: 'student',
          isActive: true,
        },
      ];

      this.users = mockUsers;
      console.log('Utilisateurs chargés (mock API):', this.users);
    }
  }

  getUserName(userId: string): string {
    const user = this.users.find((u) => u._id === userId || u.id === userId);
    if (user) {
      if (user.firstName && user.lastName) {
        return `${user.firstName} ${user.lastName}`;
      } else if (user.name) {
        return user.name;
      }
    }
    return 'Utilisateur inconnu';
  }

  createTask(): void {
    if (!this.teamId) {
      this.notificationService.showError("ID d'équipe manquant");
      return;
    }

    this.newTask.teamId = this.teamId;

    this.loading = true;
    this.taskService
      .createTask(this.newTask)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (data: Task) => {
          this.tasks.push(data);
          this.sortTasks();
          this.newTask = this.initializeNewTask();
          this.showTaskForm = false;
          this.notificationService.showSuccess('Tâche créée avec succès');
        },
        error: (error: any) => {
          console.error('Erreur lors de la création de la tâche:', error);
          this.notificationService.showError(
            'Erreur lors de la création de la tâche'
          );
        },
      });
  }

  updateTask(): void {
    if (!this.editingTask || !this.editingTask._id) {
      this.notificationService.showError('Tâche invalide');
      return;
    }

    this.loading = true;
    this.taskService
      .updateTask(this.editingTask._id, this.editingTask)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (data: Task) => {
          const index = this.tasks.findIndex((t) => t._id === data._id);
          if (index !== -1) {
            this.tasks[index] = data;
          }
          this.editingTask = null;
          this.notificationService.showSuccess('Tâche mise à jour avec succès');
        },
        error: (error: any) => {
          console.error('Erreur lors de la mise à jour de la tâche:', error);
          this.notificationService.showError(
            'Erreur lors de la mise à jour de la tâche'
          );
        },
      });
  }

  deleteTask(id: string): void {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette tâche ?')) {
      this.loading = true;
      this.taskService
        .deleteTask(id)
        .pipe(finalize(() => (this.loading = false)))
        .subscribe({
          next: () => {
            this.tasks = this.tasks.filter((t) => t._id !== id);
            this.notificationService.showSuccess('Tâche supprimée avec succès');
          },
          error: (error: any) => {
            console.error('Erreur lors de la suppression de la tâche:', error);
            this.notificationService.showError(
              'Erreur lors de la suppression de la tâche'
            );
          },
        });
    }
  }

  updateTaskStatus(task: Task, status: 'todo' | 'in-progress' | 'done'): void {
    if (!task._id) return;

    this.loading = true;
    this.taskService
      .updateTaskStatus(task._id, status)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (data: Task) => {
          const index = this.tasks.findIndex((t) => t._id === data._id);
          if (index !== -1) {
            this.tasks[index] = data;
          }
          this.notificationService.showSuccess('Statut de la tâche mis à jour');
        },
        error: (error: any) => {
          console.error('Erreur lors de la mise à jour du statut:', error);
          this.notificationService.showError(
            'Erreur lors de la mise à jour du statut'
          );
        },
      });
  }

  editTask(task: Task): void {
    this.editingTask = { ...task };
  }

  cancelEdit(): void {
    this.editingTask = null;
  }

  toggleTaskForm(): void {
    this.showTaskForm = !this.showTaskForm;
    if (this.showTaskForm) {
      this.newTask = this.initializeNewTask();
    }
  }

  initializeNewTask(): Task {
    return {
      title: '',
      description: '',
      status: 'todo',
      priority: 'medium',
      teamId: this.teamId || '',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Par défaut, une semaine à partir d'aujourd'hui
    };
  }

  sortTasks(): void {
    // Trier par priorité (high > medium > low) puis par statut (todo > in-progress > done)
    this.tasks.sort((a, b) => {
      const priorityOrder: { [key: string]: number } = {
        high: 0,
        medium: 1,
        low: 2,
      };
      const statusOrder: { [key: string]: number } = {
        todo: 0,
        'in-progress': 1,
        done: 2,
      };

      // D'abord par priorité
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }

      // Ensuite par statut
      return statusOrder[a.status] - statusOrder[b.status];
    });
  }

  // Méthodes de filtrage
  filterTasks(): Task[] {
    return this.tasks.filter((task) => {
      // Filtre par statut
      if (this.statusFilter !== 'all' && task.status !== this.statusFilter) {
        return false;
      }

      // Filtre par priorité
      if (
        this.priorityFilter !== 'all' &&
        task.priority !== this.priorityFilter
      ) {
        return false;
      }

      // Filtre par terme de recherche
      if (
        this.searchTerm &&
        !task.title.toLowerCase().includes(this.searchTerm.toLowerCase())
      ) {
        return false;
      }

      return true;
    });
  }

  // Méthodes pour obtenir les tâches par statut
  getTodoTasks(): Task[] {
    return this.tasks.filter(
      (task) =>
        task.status === 'todo' &&
        (this.priorityFilter === 'all' ||
          task.priority === this.priorityFilter) &&
        (!this.searchTerm ||
          task.title.toLowerCase().includes(this.searchTerm.toLowerCase()))
    );
  }

  getInProgressTasks(): Task[] {
    return this.tasks.filter(
      (task) =>
        task.status === 'in-progress' &&
        (this.priorityFilter === 'all' ||
          task.priority === this.priorityFilter) &&
        (!this.searchTerm ||
          task.title.toLowerCase().includes(this.searchTerm.toLowerCase()))
    );
  }

  getDoneTasks(): Task[] {
    return this.tasks.filter(
      (task) =>
        task.status === 'done' &&
        (this.priorityFilter === 'all' ||
          task.priority === this.priorityFilter) &&
        (!this.searchTerm ||
          task.title.toLowerCase().includes(this.searchTerm.toLowerCase()))
    );
  }

  // Méthodes pour compter les tâches par statut
  getTodoTasksCount(): number {
    return this.tasks.filter((task) => task.status === 'todo').length;
  }

  getInProgressTasksCount(): number {
    return this.tasks.filter((task) => task.status === 'in-progress').length;
  }

  getDoneTasksCount(): number {
    return this.tasks.filter((task) => task.status === 'done').length;
  }

  navigateBack(): void {
    this.router.navigate(['/liste']);
  }
}
