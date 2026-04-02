import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DestinationCard } from '../../../shared/components/destination-card/destination-card';
import { DestinationCard as DestinationCardModel } from '../../../core/models/home.model';

@Component({
  selector: 'app-ai-recommendations',
  standalone: true,
  imports: [CommonModule, FormsModule, DestinationCard],
  templateUrl: './ai-recommendations.html',
  styleUrl: './ai-recommendations.css',
})
export class AiRecommendations {
  @Input() recommendations: DestinationCardModel[] = [];

  newsletterEmail = '';
  newsletterSent = false;

  submitNewsletter() {
    if (this.newsletterEmail.trim()) {
      this.newsletterSent = true;
    }
  }
}
