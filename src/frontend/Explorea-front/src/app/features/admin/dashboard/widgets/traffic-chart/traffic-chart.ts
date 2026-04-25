import {
  AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, Input, OnChanges, OnDestroy, ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, registerables, TooltipItem } from 'chart.js';
import { TrafficPoint } from '../../../core/models/admin.models';
import { AdminUiPreferencesService } from '../../../core/services/admin-ui-preferences.service';

Chart.register(...registerables);

@Component({
  selector: 'app-traffic-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  templateUrl: './traffic-chart.html',
  styleUrl: './traffic-chart.css',
})
export class TrafficChart implements AfterViewInit, OnChanges, OnDestroy {
  @Input() data: TrafficPoint[] = [];
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  private chart: Chart | null = null;

  constructor(public ui: AdminUiPreferencesService) {}

  ngAfterViewInit(): void {
    this.buildChart();
  }

  ngOnChanges(): void {
    if (this.chart) this.updateChart();
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  private buildChart(): void {
    if (!this.canvasRef) return;
    const ctx = this.canvasRef.nativeElement.getContext('2d')!;

    const gradient1 = ctx.createLinearGradient(0, 0, 0, 220);
    gradient1.addColorStop(0, 'rgba(40,105,76,0.35)');
    gradient1.addColorStop(1, 'rgba(40,105,76,0.01)');

    const gradient2 = ctx.createLinearGradient(0, 0, 0, 220);
    gradient2.addColorStop(0, 'rgba(217,178,111,0.25)');
    gradient2.addColorStop(1, 'rgba(217,178,111,0.01)');

    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: this.data.map(d => d.day),
        datasets: [
          {
            label: 'Pregledi',
            data: this.data.map(d => d.views),
            borderColor: '#28694c',
            backgroundColor: gradient1,
            borderWidth: 2.5,
            pointRadius: 4,
            pointBackgroundColor: '#28694c',
            pointBorderColor: '#0f1612',
            pointBorderWidth: 2,
            tension: 0.4,
            fill: true,
          },
          {
            label: 'Rezervacije',
            data: this.data.map(d => d.reservations),
            borderColor: '#d9b26f',
            backgroundColor: gradient2,
            borderWidth: 2.5,
            pointRadius: 4,
            pointBackgroundColor: '#d9b26f',
            pointBorderColor: '#0f1612',
            pointBorderWidth: 2,
            tension: 0.4,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            align: 'end',
            labels: {
              color: '#8fa896',
              font: { family: 'Inter', size: 12 },
              boxWidth: 12,
              boxHeight: 3,
              padding: 16,
              usePointStyle: true,
              pointStyle: 'line',
            },
          },
          tooltip: {
            backgroundColor: '#1e2b20',
            borderColor: '#2a3a2d',
            borderWidth: 1,
            titleColor: '#f0f4f1',
            bodyColor: '#8fa896',
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              label: (ctx: TooltipItem<'line'>) => ` ${ctx.dataset.label}: ${(ctx.parsed.y ?? 0).toLocaleString('sr-RS')}`,
            },
          },
        },
        scales: {
          x: {
            grid: { color: 'rgba(42,58,45,0.5)', drawBorder: false } as any,
            ticks: { color: '#5a7060', font: { family: 'Inter', size: 11 } },
            border: { display: false },
          },
          y: {
            grid: { color: 'rgba(42,58,45,0.5)', drawBorder: false } as any,
            ticks: {
              color: '#5a7060',
              font: { family: 'Inter', size: 11 },
              callback: (v: any) => (v as number) >= 1000 ? `${((v as number) / 1000).toFixed(1)}k` : v,
            },
            border: { display: false },
          },
        },
      },
    });
  }

  private updateChart(): void {
    if (!this.chart) return;
    this.chart.data.labels = this.data.map(d => d.day);
    this.chart.data.datasets[0].data = this.data.map(d => d.views);
    this.chart.data.datasets[1].data = this.data.map(d => d.reservations);
    this.chart.update();
  }
}
