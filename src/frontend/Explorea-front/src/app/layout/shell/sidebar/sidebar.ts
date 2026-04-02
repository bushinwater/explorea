import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ThemeService } from '../../../core/services/theme.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
})
export class Sidebar {
  isOpen = false;      // mobile overlay
  isExpanded = false;  // desktop expand

  constructor(public themeService: ThemeService) {}

  toggle() {
    if (window.innerWidth >= 769) {
      this.isExpanded = !this.isExpanded;
    } else {
      this.isOpen = !this.isOpen;
    }
  }
}
