import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { AuthService } from '../../auth/auth.service';
import { Chart, registerables } from 'chart.js';

// Register all Chart.js components
Chart.register(...registerables);

@Component({
  selector: 'app-user-growth-chart',
  templateUrl: './user-growth-chart.component.html',
  styleUrls: ['./user-growth-chart.component.scss']
})
export class UserGrowthChartComponent implements OnInit {
  @ViewChild('growthChart') growthChartRef!: ElementRef;
  
  loading = true;
  error = '';
  selectedPeriod = 'monthly';
  chart: Chart | null = null;
  
  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    this.loadChartData();
  }

  loadChartData(): void {
    this.loading = true;
    this.error = '';
    
    const token = localStorage.getItem('token');
    if (!token) return;
    
    this.authService.getUserGrowthData(this.selectedPeriod, token).subscribe({
      next: (res: any) => {
        this.loading = false;
        this.renderChart(res.data, res.cumulativeData);
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.message || 'Failed to load user growth data';
      }
    });
  }

  changePeriod(period: string): void {
    this.selectedPeriod = period;
    this.loadChartData();
  }

  renderChart(data: any[], cumulativeData: any[]): void {
    // Destroy previous chart if it exists
    if (this.chart) {
      this.chart.destroy();
    }
    
    // Wait for the view to be initialized
    setTimeout(() => {
      const ctx = this.growthChartRef.nativeElement.getContext('2d');
      
      this.chart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: data.map(item => item.label),
          datasets: [
            {
              label: 'New Users',
              data: data.map(item => item.count),
              backgroundColor: 'rgba(59, 130, 246, 0.5)',
              borderColor: 'rgb(59, 130, 246)',
              borderWidth: 1
            },
            {
              label: 'Total Users',
              data: cumulativeData.map(item => item.cumulativeCount),
              type: 'line',
              fill: false,
              borderColor: 'rgb(16, 185, 129)',
              tension: 0.1,
              yAxisID: 'y1'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: 'New Users'
              }
            },
            y1: {
              beginAtZero: true,
              position: 'right',
              title: {
                display: true,
                text: 'Total Users'
              },
              grid: {
                drawOnChartArea: false
              }
            },
            x: {
              title: {
                display: true,
                text: this.getPeriodLabel()
              }
            }
          },
          plugins: {
            tooltip: {
              mode: 'index',
              intersect: false
            },
            legend: {
              position: 'top',
            },
            title: {
              display: true,
              text: 'User Growth Over Time'
            }
          }
        }
      });
    });
  }

  getPeriodLabel(): string {
    switch (this.selectedPeriod) {
      case 'daily':
        return 'Days';
      case 'weekly':
        return 'Weeks';
      case 'monthly':
      default:
        return 'Months';
    }
  }
}
