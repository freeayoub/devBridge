import { Component, OnInit, ViewChild, ElementRef, Input } from '@angular/core';
import { Chart, registerables } from 'chart.js';

// Register all Chart.js components
Chart.register(...registerables);

@Component({
  selector: 'app-role-distribution-chart',
  templateUrl: './role-distribution-chart.component.html',
  styleUrls: ['./role-distribution-chart.component.scss']
})
export class RoleDistributionChartComponent implements OnInit {
  @ViewChild('roleChart') roleChartRef!: ElementRef;
  @Input() studentCount: number = 0;
  @Input() teacherCount: number = 0;
  @Input() adminCount: number = 0;
  
  chart: Chart | null = null;
  
  constructor() {}

  ngOnInit(): void {}

  ngAfterViewInit(): void {
    this.renderChart();
  }

  ngOnChanges(): void {
    if (this.chart) {
      this.chart.destroy();
    }
    if (this.roleChartRef && this.roleChartRef.nativeElement) {
      this.renderChart();
    }
  }

  renderChart(): void {
    // Wait for the view to be initialized
    setTimeout(() => {
      if (!this.roleChartRef) return;
      
      const ctx = this.roleChartRef.nativeElement.getContext('2d');
      
      // Define colors for each role
      const colors = {
        students: {
          backgroundColor: 'rgba(59, 130, 246, 0.7)',
          borderColor: 'rgb(59, 130, 246)'
        },
        teachers: {
          backgroundColor: 'rgba(168, 85, 247, 0.7)',
          borderColor: 'rgb(168, 85, 247)'
        },
        admins: {
          backgroundColor: 'rgba(245, 158, 11, 0.7)',
          borderColor: 'rgb(245, 158, 11)'
        }
      };
      
      // Calculate total users
      const totalUsers = this.studentCount + this.teacherCount + this.adminCount;
      
      // Calculate percentages
      const studentPercentage = totalUsers > 0 ? Math.round((this.studentCount / totalUsers) * 100) : 0;
      const teacherPercentage = totalUsers > 0 ? Math.round((this.teacherCount / totalUsers) * 100) : 0;
      const adminPercentage = totalUsers > 0 ? Math.round((this.adminCount / totalUsers) * 100) : 0;
      
      this.chart = new Chart(ctx, {
        type: 'pie',
        data: {
          labels: [
            `Students (${studentPercentage}%)`,
            `Teachers (${teacherPercentage}%)`,
            `Admins (${adminPercentage}%)`
          ],
          datasets: [{
            data: [this.studentCount, this.teacherCount, this.adminCount],
            backgroundColor: [
              colors.students.backgroundColor,
              colors.teachers.backgroundColor,
              colors.admins.backgroundColor
            ],
            borderColor: [
              colors.students.borderColor,
              colors.teachers.borderColor,
              colors.admins.borderColor
            ],
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'right',
              labels: {
                usePointStyle: true,
                padding: 15,
                font: {
                  size: 11
                }
              }
            },
            tooltip: {
              callbacks: {
                label: function(context) {
                  const label = context.label || '';
                  const value = context.raw || 0;
                  return `${label}: ${value} users`;
                }
              }
            }
          }
        }
      });
    });
  }
}
