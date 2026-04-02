import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DestinationCard } from '../../../shared/components/destination-card/destination-card';
import { DestinationCard as DestinationCardModel } from '../../../core/models/home.model';

@Component({
  selector: 'app-featured-destinations',
  standalone: true,
  imports: [CommonModule, DestinationCard],
  templateUrl: './featured-destinations.html',
  styleUrl: './featured-destinations.css',
})
export class FeaturedDestinations {
  @Input() destinations: DestinationCardModel[] = [];
}
