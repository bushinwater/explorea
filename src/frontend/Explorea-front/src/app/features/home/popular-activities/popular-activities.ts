import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivityCard as ActivityCardModel } from '../../../core/models/home.model';

@Component({
  selector: 'app-popular-activities',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './popular-activities.html',
  styleUrl: './popular-activities.css',
})
export class PopularActivities {
  @Input() activities: ActivityCardModel[] = [];
}
