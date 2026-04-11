import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { PlaceCard } from '../../../core/models/place.model';

@Component({
  selector: 'app-place-card',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule],
  templateUrl: './place-card.html',
  styleUrl: './place-card.css',
})
export class PlaceCardComponent {
  @Input() place!: PlaceCard;
}
