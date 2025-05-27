import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { DashboardComponent } from './dashboard/dashboard.component';
import { ProfileComponent } from './profile/profile.component';
import { UserGrowthChartComponent } from './user-growth-chart/user-growth-chart.component';
import { RoleDistributionChartComponent } from './role-distribution-chart/role-distribution-chart.component';
import { SidebarComponent } from './sidebar/sidebar.component';
import { UserFormModalComponent } from './user-form-modal/user-form-modal.component';
import { UserFilterModalComponent } from './user-filter-modal/user-filter-modal.component';
import { SharedModule } from '../shared/shared.module';

@NgModule({
  declarations: [
    DashboardComponent,
    ProfileComponent,
    UserGrowthChartComponent,
    RoleDistributionChartComponent,
    SidebarComponent,
    UserFormModalComponent,
    UserFilterModalComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    SharedModule
  ]
})
export class AdminModule { }
