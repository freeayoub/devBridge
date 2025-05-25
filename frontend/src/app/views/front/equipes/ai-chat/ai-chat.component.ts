import { Component, Input, OnInit } from '@angular/core';
import { AiService } from 'src/app/services/ai.service';
import { TaskService } from 'src/app/services/task.service';
import { NotificationService } from 'src/app/services/notification.service';
import { Equipe } from 'src/app/models/equipe.model';
import { Task } from 'src/app/models/task.model';
import { finalize } from 'rxjs/operators';
@Component({
  selector: 'app-ai-chat',
  templateUrl: './ai-chat.component.html',
  styleUrls: ['./ai-chat.component.css'],
})
export class AiChatComponent implements OnInit {
  @Input() team!: Equipe;

  projectTitle: string = '';
  isGenerating: boolean = false;
  generatedContent: any = null;
  error: string | null = null;

  // Pour le chat
  messages: { role: 'user' | 'assistant'; content: string }[] = [];
  userQuestion: string = '';
  isAskingQuestion: boolean = false;

  constructor(
    private aiService: AiService,
    private taskService: TaskService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    // Ajouter un message de bienvenue
    this.messages.push({
      role: 'assistant',
      content:
        'Bonjour ! Je suis votre assistant IA pour la gestion de projet. Entrez le titre de votre projet pour que je puisse vous aider à le diviser en tâches, ou posez-moi une question sur la gestion de projet.',
    });
  }

  generateTasks(): void {
    if (!this.projectTitle.trim()) {
      this.notificationService.showError('Veuillez entrer un titre de projet');
      return;
    }

    // Vérifier si l'équipe a des membres, sinon utiliser un nombre par défaut
    let memberCount =
      this.team && this.team.members ? this.team.members.length : 3;

    // S'assurer que nous avons au moins 3 entités pour un projet significatif
    const effectiveMemberCount = Math.max(memberCount, 3);

    if (memberCount === 0) {
      this.notificationService.showWarning(
        "L'équipe n'a pas de membres. Des tâches génériques seront créées."
      );
    }

    this.isGenerating = true;
    this.error = null;

    console.log(
      `Génération de tâches pour ${effectiveMemberCount} entités (équipe de ${memberCount} membres)`
    );

    // Ajouter la demande aux messages
    this.messages.push({
      role: 'user',
      content: `Génère des tâches pour le projet "${this.projectTitle}" avec exactement ${effectiveMemberCount} entités, une pour chaque membre de l'équipe. Chaque entité doit représenter un module distinct du projet.`,
    });

    // Ajouter un message de chargement
    const loadingMessageIndex = this.messages.length;
    this.messages.push({
      role: 'assistant',
      content: 'Je génère des tâches pour votre projet...',
    });

    // Récupérer les informations sur les membres de l'équipe
    let teamMembers: any[] = [];
    if (this.team && this.team.members) {
      // Utiliser les IDs des membres
      teamMembers = this.team.members.map((memberId: string, index: number) => {
        return { id: memberId, name: `Membre ${index + 1}`, role: 'membre' };
      });

      console.log("Informations sur les membres passées à l'IA:", teamMembers);
    }

    this.aiService
      .generateProjectTasks(this.projectTitle, memberCount, teamMembers)
      .pipe(finalize(() => (this.isGenerating = false)))
      .subscribe({
        next: (result: any) => {
          if (!result || !result.entities || result.entities.length === 0) {
            console.error("Résultat invalide reçu de l'API:", result);
            this.handleGenerationError(
              loadingMessageIndex,
              'Format de réponse invalide'
            );
            return;
          }

          this.generatedContent = result;

          // Remplacer le message de chargement par la réponse
          this.messages[loadingMessageIndex] = {
            role: 'assistant',
            content: `J'ai généré ${
              result.entities.length
            } entités pour votre projet "${
              result.projectTitle
            }" avec un total de ${this.countTasks(result)} tâches.`,
          };

          this.notificationService.showSuccess('Tâches générées avec succès');
        },
        error: (error: any) => {
          console.error('Erreur lors de la génération des tâches:', error);
          this.handleGenerationError(
            loadingMessageIndex,
            error.message || 'Erreur inconnue'
          );
        },
      });
  }

  // Méthode pour gérer les erreurs de génération
  private handleGenerationError(
    messageIndex: number,
    errorDetails: string
  ): void {
    this.error = 'Impossible de générer les tâches. Veuillez réessayer.';

    // Remplacer le message de chargement par le message d'erreur
    this.messages[messageIndex] = {
      role: 'assistant',
      content:
        "Désolé, je n'ai pas pu générer les tâches. Veuillez réessayer avec un titre de projet différent.",
    };

    this.notificationService.showError(
      'Erreur lors de la génération des tâches: ' + errorDetails
    );
  }

  askQuestion(): void {
    if (!this.userQuestion.trim()) {
      return;
    }

    const question = this.userQuestion.trim();
    this.userQuestion = '';
    this.isAskingQuestion = true;

    // Ajouter la question aux messages
    this.messages.push({
      role: 'user',
      content: question,
    });

    const projectContext = {
      title:
        this.projectTitle ||
        (this.generatedContent ? this.generatedContent.projectTitle : ''),
      description:
        "Projet géré par l'équipe " + (this.team ? this.team.name : ''),
    };

    this.aiService
      .askProjectQuestion(question, projectContext)
      .pipe(finalize(() => (this.isAskingQuestion = false)))
      .subscribe({
        next: (response: string) => {
          // Ajouter la réponse aux messages
          this.messages.push({
            role: 'assistant',
            content: response,
          });
        },
        error: (error: any) => {
          console.error("Erreur lors de la demande à l'IA:", error);

          // Ajouter l'erreur aux messages
          this.messages.push({
            role: 'assistant',
            content:
              "Désolé, je n'ai pas pu répondre à votre question. Veuillez réessayer.",
          });

          this.notificationService.showError(
            "Erreur lors de la communication avec l'IA"
          );
        },
      });
  }

  createTasks(): void {
    if (!this.generatedContent || !this.team || !this.team._id) {
      this.notificationService.showError(
        'Aucune tâche générée ou équipe invalide'
      );
      return;
    }

    let createdCount = 0;
    const totalTasks = this.countTasks(this.generatedContent);

    // Vérifier si l'équipe a des membres
    if (!this.team.members || this.team.members.length === 0) {
      this.notificationService.showError(
        "L'équipe n'a pas de membres pour assigner les tâches"
      );
      return;
    }

    // Préparer la liste des membres de l'équipe
    const teamMembers = this.team.members.map((member) => {
      return typeof member === 'string' ? member : (member as any).userId;
    });

    // Créer un mapping des noms de membres vers leurs IDs
    const memberNameToIdMap: { [key: string]: string } = {};
    teamMembers.forEach((memberId, index) => {
      memberNameToIdMap[`Membre ${index + 1}`] = memberId;
    });

    console.log(
      "Membres de l'équipe disponibles pour l'assignation:",
      teamMembers
    );
    console.log(
      'Mapping des noms de membres vers leurs IDs:',
      memberNameToIdMap
    );

    // Pour chaque entité
    this.generatedContent.entities.forEach((entity: any) => {
      // Déterminer le membre assigné à cette entité
      let assignedMemberId: string | undefined;

      // Si l'IA a suggéré une assignation
      if (entity.assignedTo) {
        // Essayer de trouver l'ID du membre à partir du nom suggéré
        const memberName = entity.assignedTo;
        if (memberNameToIdMap[memberName]) {
          assignedMemberId = memberNameToIdMap[memberName];
          console.log(
            `Assignation suggérée par l'IA: Entité "${entity.name}" assignée à "${memberName}" (ID: ${assignedMemberId})`
          );
        } else {
          // Si le nom n'est pas trouvé, assigner aléatoirement
          const randomMemberIndex = Math.floor(
            Math.random() * teamMembers.length
          );
          assignedMemberId = teamMembers[randomMemberIndex];
          console.log(
            `Nom de membre "${memberName}" non trouvé, assignation aléatoire à l'index ${randomMemberIndex}`
          );
        }
      } else {
        // Si pas d'assignation suggérée, assigner aléatoirement
        const randomMemberIndex = Math.floor(
          Math.random() * teamMembers.length
        );
        assignedMemberId = teamMembers[randomMemberIndex];
        console.log(
          `Pas d'assignation suggérée, assignation aléatoire à l'index ${randomMemberIndex}`
        );
      }

      // Pour chaque tâche dans l'entité
      entity.tasks.forEach((taskData: any) => {
        const task: Task = {
          title: taskData.title,
          description: `[${entity.name}] ${taskData.description}`,
          status: taskData.status || 'todo',
          priority: taskData.priority || 'medium',
          teamId: this.team._id || '',
          // Utiliser l'ID du membre assigné à l'entité
          assignedTo: assignedMemberId,
        };

        this.taskService.createTask(task).subscribe({
          next: () => {
            createdCount++;
            if (createdCount === totalTasks) {
              this.notificationService.showSuccess(
                `${createdCount} tâches créées avec succès et assignées aux membres de l'équipe`
              );
              // Réinitialiser après création
              this.generatedContent = null;
              this.projectTitle = '';
            }
          },
          error: (error) => {
            console.error('Erreur lors de la création de la tâche:', error);
            this.notificationService.showError(
              'Erreur lors de la création des tâches'
            );
          },
        });
      });
    });
  }

  countTasks(content: any): number {
    if (!content || !content.entities) return 0;

    return content.entities.reduce((total: number, entity: any) => {
      return total + (entity.tasks ? entity.tasks.length : 0);
    }, 0);
  }

  // Méthode pour obtenir un dégradé de couleur basé sur l'index
  getGradientForIndex(index: number): string {
    // Liste de dégradés prédéfinis
    const gradients = [
      'linear-gradient(45deg, #007bff, #6610f2)', // Bleu-Violet
      'linear-gradient(45deg, #11998e, #38ef7d)', // Vert
      'linear-gradient(45deg, #FC5C7D, #6A82FB)', // Rose-Bleu
      'linear-gradient(45deg, #FF8008, #FFC837)', // Orange-Jaune
      'linear-gradient(45deg, #8E2DE2, #4A00E0)', // Violet
      'linear-gradient(45deg, #2193b0, #6dd5ed)', // Bleu clair
      'linear-gradient(45deg, #373B44, #4286f4)', // Gris-Bleu
      'linear-gradient(45deg, #834d9b, #d04ed6)', // Violet-Rose
      'linear-gradient(45deg, #0cebeb, #20e3b2, #29ffc6)', // Turquoise
    ];

    // Utiliser le modulo pour s'assurer que nous ne dépassons pas le tableau
    return gradients[index % gradients.length];
  }

  // Méthode pour obtenir une couleur unique basée sur l'index
  getColorForIndex(index: number): string {
    // Liste de couleurs prédéfinies
    const colors = [
      '#007bff', // Bleu
      '#11998e', // Vert
      '#FC5C7D', // Rose
      '#FF8008', // Orange
      '#8E2DE2', // Violet
      '#2193b0', // Bleu clair
      '#373B44', // Gris foncé
      '#834d9b', // Violet
      '#0cebeb', // Turquoise
    ];

    // Utiliser le modulo pour s'assurer que nous ne dépassons pas le tableau
    return colors[index % colors.length];
  }

  // Méthode pour obtenir une icône en fonction du nom du module
  getIconForModule(moduleName: string): string {
    // Convertir le nom du module en minuscules pour faciliter la comparaison
    const name = moduleName.toLowerCase();

    // Mapper les noms de modules courants à des icônes Bootstrap
    if (
      name.includes('crud') ||
      name.includes('api') ||
      name.includes('données') ||
      name.includes('base')
    ) {
      return 'bi-database-fill';
    } else if (
      name.includes('interface') ||
      name.includes('ui') ||
      name.includes('front') ||
      name.includes('utilisateur')
    ) {
      return 'bi-window';
    } else if (
      name.includes('déploiement') ||
      name.includes('serveur') ||
      name.includes('cloud')
    ) {
      return 'bi-cloud-arrow-up-fill';
    } else if (
      name.includes('test') ||
      name.includes('qualité') ||
      name.includes('qa')
    ) {
      return 'bi-bug-fill';
    } else if (name.includes('sécurité') || name.includes('auth')) {
      return 'bi-shield-lock-fill';
    } else if (name.includes('paiement') || name.includes('transaction')) {
      return 'bi-credit-card-fill';
    } else if (
      name.includes('utilisateur') ||
      name.includes('user') ||
      name.includes('profil')
    ) {
      return 'bi-person-fill';
    } else if (name.includes('doc') || name.includes('documentation')) {
      return 'bi-file-text-fill';
    } else if (name.includes('mobile') || name.includes('app')) {
      return 'bi-phone-fill';
    } else if (name.includes('backend') || name.includes('serveur')) {
      return 'bi-server';
    } else if (
      name.includes('analytics') ||
      name.includes('statistique') ||
      name.includes('seo')
    ) {
      return 'bi-graph-up';
    }

    // Icône par défaut si aucune correspondance n'est trouvée
    return 'bi-code-square';
  }

  // Méthode pour obtenir l'heure actuelle au format HH:MM
  getCurrentTime(): string {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }
}
