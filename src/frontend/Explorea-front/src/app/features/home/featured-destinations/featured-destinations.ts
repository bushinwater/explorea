import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { DestinationCard } from '../../../shared/components/destination-card/destination-card';
import { DestinationCard as DestinationCardModel } from '../../../core/models/home.model';

@Component({
  selector: 'app-featured-destinations',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule, DestinationCard],
  templateUrl: './featured-destinations.html',
  styleUrl: './featured-destinations.css',
})
export class FeaturedDestinations {
  @Input() destinations: DestinationCardModel[] = [];
}
