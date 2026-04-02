import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DestinationCard as DestinationCardModel } from '../../../core/models/home.model';

@Component({
  selector: 'app-destination-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './destination-card.html',
  styleUrl: './destination-card.css',
})
export class DestinationCard {
  @Input() destination!: DestinationCardModel;
  @Input() featured: boolean = false;
}
