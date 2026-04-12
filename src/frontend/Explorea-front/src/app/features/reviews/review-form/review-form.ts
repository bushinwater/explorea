import { CommonModule, Location } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { Sidebar } from '../../../layout/shell/sidebar/sidebar';
import { BottomNav } from '../../../shared/bottom-nav/bottom-nav';

@Component({
  selector: 'app-review-form',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, Sidebar, BottomNav],
  templateUrl: './review-form.html',
  styleUrl: './review-form.css',
})
export class ReviewFormComponent {
  rating = 0;
  hoverRating = 0;
  comment = '';
  photos: string[] = [];

  readonly maxComment = 500;

  entity = {
    name: 'Hotel Zlatni Bor & Spa Resort',
    location: 'Zlatibor, Srbija',
    imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=80',
  };

  constructor(private location: Location) {}

  setRating(value: number): void {
    this.rating = value;
  }

  setHover(value: number): void {
    this.hoverRating = value;
  }

  clearHover(): void {
    this.hoverRating = 0;
  }

  getStarState(index: number): 'filled' | 'hover' | 'empty' {
    const active = this.hoverRating || this.rating;
    if (index <= active) return this.hoverRating ? 'hover' : 'filled';
    return 'empty';
  }

  onPhotoAdd(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;
    Array.from(input.files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        this.photos.push(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    });
    input.value = '';
  }

  removePhoto(index: number): void {
    this.photos.splice(index, 1);
  }

  get canSubmit(): boolean {
    return this.rating > 0;
  }

  submit(): void {
    if (!this.canSubmit) return;
  }

  goBack(): void {
    this.location.back();
  }
}
