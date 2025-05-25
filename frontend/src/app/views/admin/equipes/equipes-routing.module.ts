import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { EquipeListComponent } from './equipe-list/equipe-list.component';
import { EquipeFormComponent } from './equipe-form/equipe-form.component';
import { EquipeDetailComponent } from './equipe-detail/equipe-detail.component';
import { TaskListComponent } from './task-list/task-list.component';
import { EquipeComponent } from './equipe/equipe.component';
import { EquipeLayoutComponent } from './equipe-layout/equipe-layout.component';

const routes: Routes = [
  {
    path: '',
    component: EquipeLayoutComponent,
    children: [
      // Liste des équipes
      { path: '', component: EquipeComponent },

      { path: 'liste', component: EquipeListComponent },
      { path: 'mes-equipes', component: EquipeListComponent },

      // Formulaire pour ajouter une nouvelle équipe
      { path: 'ajouter', component: EquipeFormComponent },
      { path: 'nouveau', component: EquipeFormComponent },

      // Formulaire pour modifier une équipe existante
      { path: 'modifier/:id', component: EquipeFormComponent },

      // Détails d'une équipe spécifique
      { path: 'detail/:id', component: EquipeDetailComponent },

      // Gestion des tâches d'une équipe
      { path: 'tasks/:id', component: TaskListComponent },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class EquipesRoutingModule {}
