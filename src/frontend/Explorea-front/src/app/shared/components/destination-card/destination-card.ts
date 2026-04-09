import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { DestinationCard as DestinationCardModel } from '../../../core/models/home.model';

@Component({
  selector: 'app-destination-card',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './destination-card.html',
  styleUrls: ['./destination-card.css'],
})
export class DestinationCard {
  @Input() destination!: DestinationCardModel;
  @Input() featured: boolean = false;
}