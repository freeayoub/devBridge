import { Injectable } from '@angular/core';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { Observable, from, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from 'src/environments/environment'

@Injectable({
  providedIn: 'root'
})
export class AiService {
  private genAI!: GoogleGenerativeAI;
  private model!: GenerativeModel;
  private apiAvailable: boolean = true;

  constructor() {
    // Utiliser une clé API de l'environnement ou une clé de démonstration
    // Pour une utilisation en production, obtenez une clé API sur https://makersuite.google.com/
    const apiKey = environment.geminiApiKey || 'AIzaSyDCXc16FzaVWSJkW4RGboTZ8AD9_PTDL88';

    try {
      // Initialiser l'API Gemini
      this.genAI = new GoogleGenerativeAI(apiKey);
      // Utiliser le modèle gemini-1.5-pro qui est disponible dans la version actuelle de l'API
      this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
      console.log('Service AI initialisé avec succès');
    } catch (error) {
      console.error('Erreur lors de l\'initialisation du service AI:', error);

      // Créer des objets factices pour éviter les erreurs null
      // Ces objets ne feront rien mais éviteront les erreurs d'exécution
      this.genAI = {} as GoogleGenerativeAI;
      this.model = {
        generateContent: () => Promise.resolve({
          response: { text: () => 'Service AI non disponible' }
        })
      } as unknown as GenerativeModel;

      // Marquer l'API comme non disponible
      this.apiAvailable = false;
    }
  }

  /**
   * Génère des tâches pour un projet en fonction du nombre de membres
   * @param projectTitle Titre du projet
   * @param memberCount Nombre de membres dans l'équipe
   * @param teamMembers Liste des membres de l'équipe (optionnel)
   * @returns Observable contenant les tâches générées
   */
  generateProjectTasks(projectTitle: string, memberCount: number, teamMembers?: any[]): Observable<any> {
    // Si le nombre de membres est trop petit, utiliser au moins 3 entités
    const effectiveMemberCount = Math.max(memberCount, 3);

    // Données de démonstration à utiliser en cas d'erreur ou si l'API n'est pas disponible
    const fallbackData = this.createFallbackTaskData(projectTitle, effectiveMemberCount, teamMembers);

    // Si nous savons déjà que l'API n'est pas disponible, retourner directement les données de démonstration
    if (!this.isApiAvailable()) {
      console.log('API Gemini non disponible, utilisation des données de démonstration');
      return new Observable(observer => {
        setTimeout(() => {
          observer.next(fallbackData);
          observer.complete();
        }, 1000); // Simuler un délai d'API
      });
    }

    // Préparer les informations sur les membres de l'équipe pour le prompt
    let teamMembersInfo = '';
    if (teamMembers && teamMembers.length > 0) {
      teamMembersInfo = `
      Membres de l'équipe:
      ${teamMembers.map((member, index) => {
        const memberName = member.name || member.firstName || member.lastName || `Membre ${index + 1}`;
        const memberRole = member.role || 'membre';
        return `- ${memberName} (${memberRole})`;
      }).join('\n')}
      `;
    }

    const prompt = `
      Agis comme un expert en gestion de projet. Je travaille sur un projet intitulé "${projectTitle}"
      avec une équipe de ${effectiveMemberCount} membres.
      ${teamMembersInfo}

      Divise ce projet en exactement ${effectiveMemberCount} entités ou modules principaux qui peuvent être travaillés en parallèle par chaque membre de l'équipe.

      IMPORTANT: Chaque entité doit être simple, claire et concise (maximum 3-4 mots).
      Exemples d'entités pour un site e-commerce avec 3 membres:
      - CRUD des produits
      - Interface utilisateur
      - Déploiement

      Pour chaque entité/module:
      1. Donne un nom très court et concis (maximum 3-4 mots)
      2. Fournis une brève description (1 phrase maximum)
      3. Liste 2-3 tâches spécifiques avec leur priorité (haute, moyenne, basse)

      Réponds au format JSON suivant sans aucun texte supplémentaire:
      {
        "projectTitle": "${projectTitle}",
        "entities": [
          {
            "name": "Nom court de l'entité",
            "description": "Description très brève de l'entité",
            "assignedTo": "Nom du membre (optionnel)",
            "tasks": [
              {
                "title": "Titre court de la tâche",
                "description": "Description brève de la tâche",
                "priority": "high|medium|low",
                "status": "todo"
              }
            ]
          }
        ]
      }
    `;

    try {
      return from(this.model.generateContent(prompt))
        .pipe(
          map(result => {
            try {
              const textResult = result.response.text();
              // Extraire le JSON de la réponse
              const jsonMatch = textResult.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
              } else {
                console.warn('Format JSON non trouvé dans la réponse, utilisation des données de démonstration');
                return fallbackData;
              }
            } catch (error) {
              console.error('Erreur lors du parsing de la réponse:', error);
              return fallbackData;
            }
          }),
          // Capturer les erreurs au niveau de l'Observable
          catchError(error => {
            console.error('Erreur lors de la génération de contenu:', error);
            // Marquer l'API comme non disponible pour les prochains appels
            this.markApiAsUnavailable();
            return of(fallbackData);
          })
        );
    } catch (error) {
      console.error('Erreur lors de l\'appel à l\'API:', error);
      this.markApiAsUnavailable();
      return of(fallbackData);
    }
  }

  // Méthode pour créer des données de démonstration
  private createFallbackTaskData(projectTitle: string, memberCount: number, teamMembers?: any[]): any {
    // Préparer les informations sur les membres pour l'assignation
    const memberNames: string[] = [];
    if (teamMembers && teamMembers.length > 0) {
      teamMembers.forEach((member, index) => {
        const memberName = member.name || member.firstName ||
                          (member.firstName && member.lastName ? `${member.firstName} ${member.lastName}` : null) ||
                          `Membre ${index + 1}`;
        memberNames.push(memberName);
      });
    }

    // Si pas assez de noms de membres, compléter avec des noms génériques
    while (memberNames.length < memberCount) {
      memberNames.push(`Membre ${memberNames.length + 1}`);
    }

    // Données de démonstration pour un site e-commerce
    if (projectTitle.toLowerCase().includes('ecommerce') || projectTitle.toLowerCase().includes('e-commerce') || projectTitle.toLowerCase().includes('boutique')) {
      const ecommerceEntities = [
        {
          name: "CRUD des produits",
          description: "Gestion des produits dans la base de données",
          assignedTo: memberNames[0] || "Non assigné",
          tasks: [
            {
              title: "Créer API produits",
              description: "Développer les endpoints pour créer, lire, modifier et supprimer des produits",
              priority: "high",
              status: "todo"
            },
            {
              title: "Modèle de données",
              description: "Concevoir le schéma de la base de données pour les produits",
              priority: "medium",
              status: "todo"
            }
          ]
        },
        {
          name: "Interface utilisateur",
          description: "Développement du frontend de l'application",
          assignedTo: memberNames[1] || "Non assigné",
          tasks: [
            {
              title: "Page d'accueil",
              description: "Créer la page d'accueil avec la liste des produits",
              priority: "high",
              status: "todo"
            },
            {
              title: "Panier d'achat",
              description: "Implémenter la fonctionnalité du panier d'achat",
              priority: "medium",
              status: "todo"
            }
          ]
        },
        {
          name: "Déploiement",
          description: "Mise en production de l'application",
          assignedTo: memberNames[2] || "Non assigné",
          tasks: [
            {
              title: "Configuration serveur",
              description: "Configurer le serveur pour l'hébergement",
              priority: "medium",
              status: "todo"
            },
            {
              title: "Tests d'intégration",
              description: "Effectuer des tests d'intégration avant le déploiement",
              priority: "high",
              status: "todo"
            }
          ]
        },
        {
          name: "Gestion utilisateurs",
          description: "Système d'authentification et profils",
          assignedTo: memberNames[3] || "Non assigné",
          tasks: [
            {
              title: "Authentification",
              description: "Implémenter le système de connexion et d'inscription",
              priority: "high",
              status: "todo"
            },
            {
              title: "Profils utilisateurs",
              description: "Créer les pages de profil et de gestion des informations personnelles",
              priority: "medium",
              status: "todo"
            }
          ]
        },
        {
          name: "Paiement en ligne",
          description: "Intégration des systèmes de paiement",
          assignedTo: memberNames[4] || "Non assigné",
          tasks: [
            {
              title: "API de paiement",
              description: "Intégrer une passerelle de paiement comme Stripe ou PayPal",
              priority: "high",
              status: "todo"
            },
            {
              title: "Sécurité transactions",
              description: "Mettre en place les mesures de sécurité pour les transactions",
              priority: "high",
              status: "todo"
            }
          ]
        },
        {
          name: "SEO & Analytics",
          description: "Optimisation pour les moteurs de recherche",
          assignedTo: memberNames[5] || "Non assigné",
          tasks: [
            {
              title: "Balises méta",
              description: "Optimiser les balises méta et la structure du site",
              priority: "medium",
              status: "todo"
            },
            {
              title: "Google Analytics",
              description: "Intégrer des outils d'analyse du trafic",
              priority: "low",
              status: "todo"
            }
          ]
        }
      ];

      // Limiter au nombre de membres
      return {
        projectTitle: projectTitle,
        entities: ecommerceEntities.slice(0, memberCount)
      };
    }

    // Données génériques pour tout autre type de projet
    const moduleTypes = [
      { name: "Backend", description: "Développement du backend de l'application" },
      { name: "Frontend", description: "Développement de l'interface utilisateur" },
      { name: "Base de données", description: "Conception et gestion de la base de données" },
      { name: "Tests", description: "Tests et assurance qualité" },
      { name: "Déploiement", description: "Configuration et déploiement de l'application" },
      { name: "Documentation", description: "Rédaction de la documentation technique" }
    ];

    return {
      projectTitle: projectTitle,
      entities: Array.from({ length: memberCount }, (_, i) => ({
        name: moduleTypes[i % moduleTypes.length].name,
        description: moduleTypes[i % moduleTypes.length].description,
        assignedTo: memberNames[i] || "Non assigné",
        tasks: [
          {
            title: `Conception ${moduleTypes[i % moduleTypes.length].name}`,
            description: `Planifier l'architecture du ${moduleTypes[i % moduleTypes.length].name.toLowerCase()}`,
            priority: 'high',
            status: 'todo'
          },
          {
            title: `Implémentation ${moduleTypes[i % moduleTypes.length].name}`,
            description: `Développer les fonctionnalités du ${moduleTypes[i % moduleTypes.length].name.toLowerCase()}`,
            priority: 'medium',
            status: 'todo'
          },
          {
            title: `Tests ${moduleTypes[i % moduleTypes.length].name}`,
            description: `Tester les fonctionnalités du ${moduleTypes[i % moduleTypes.length].name.toLowerCase()}`,
            priority: 'medium',
            status: 'todo'
          }
        ]
      }))
    };
  }

  // Méthode pour vérifier si l'API est disponible
  private isApiAvailable(): boolean {
    return this.apiAvailable;
  }

  // Méthode pour marquer l'API comme non disponible
  private markApiAsUnavailable(): void {
    this.apiAvailable = false;
    console.warn('API Gemini marquée comme non disponible pour les prochains appels');
  }

  /**
   * Génère une réponse à une question sur le projet
   * @param question Question posée par l'utilisateur
   * @param projectContext Contexte du projet (titre, description, etc.)
   * @returns Observable contenant la réponse générée
   */
  askProjectQuestion(question: string, projectContext: any): Observable<string> {
    // Réponses de secours en cas d'erreur
    const fallbackResponses = [
      `Pour votre projet "${projectContext.title || 'en cours'}", je recommande de commencer par définir clairement les objectifs et les livrables attendus.`,
      `La gestion efficace d'un projet comme "${projectContext.title || 'celui-ci'}" nécessite une bonne planification et une communication claire entre les membres de l'équipe.`,
      `Pour répondre à votre question sur "${question}", je vous suggère de diviser le travail en tâches plus petites et de les assigner aux membres de l'équipe en fonction de leurs compétences.`,
      `Dans le cadre de votre projet, il est important de définir des jalons clairs et de suivre régulièrement l'avancement des travaux.`
    ];

    // Sélectionner une réponse aléatoire de secours
    const getRandomFallbackResponse = () => {
      const randomIndex = Math.floor(Math.random() * fallbackResponses.length);
      return fallbackResponses[randomIndex];
    };

    // Si l'API n'est pas disponible, retourner directement une réponse de secours
    if (!this.isApiAvailable()) {
      console.log('API Gemini non disponible, utilisation d\'une réponse de secours');
      return of(getRandomFallbackResponse());
    }

    const prompt = `
      Contexte du projet:
      Titre: ${projectContext.title || 'Non spécifié'}
      Description: ${projectContext.description || 'Non spécifiée'}

      Question: ${question}

      Réponds de manière concise et professionnelle en tant qu'assistant de gestion de projet.
    `;

    try {
      return from(this.model.generateContent(prompt))
        .pipe(
          map(result => {
            try {
              return result.response.text();
            } catch (error) {
              console.error('Erreur lors de la récupération de la réponse:', error);
              return getRandomFallbackResponse();
            }
          }),
          catchError(error => {
            console.error('Erreur lors de la génération de contenu:', error);
            this.markApiAsUnavailable();
            return of(getRandomFallbackResponse());
          })
        );
    } catch (error) {
      console.error('Erreur lors de la génération de contenu:', error);
      this.markApiAsUnavailable();
      return of(getRandomFallbackResponse());
    }
  }
}