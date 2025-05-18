import { Component } from '@angular/core';
import { AuthuserService } from 'src/app/services/authuser.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent {
  recentProjects = [
    {
      name: 'E-Commerce Platform',
      category: 'WEB DESIGN',
      description: 'Create a user-friendly e-commerce platform with a sleek design and intuitive navigation.',
      team: [
        { name: 'Team member 1', avatar: 'https://randomuser.me/api/portraits/women/44.jpg' },
        { name: 'Team member 2', avatar: 'https://randomuser.me/api/portraits/men/32.jpg' }
      ],
      dueDate: 'Due in 3 days'
    },
    // ... autres projets
  ];

  testimonials = [
    {
      name: 'Margot Henschke',
      position: 'Project Manager',
      quote: 'DevBridge has transformed how our team collaborates...'
    },
    // ... autres témoignages
  ];

  constructor(public authService: AuthuserService) {}

  // Ajoutez cette méthode pour vérifier si l'utilisateur est admin
  isAdmin(): boolean {
    const user = this.authService.getCurrentUser();
    return user && user.role === 'admin'; // Adaptez selon votre structure de données
  }
}
