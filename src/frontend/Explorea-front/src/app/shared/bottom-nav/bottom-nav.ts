import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

interface NavItem {
  icon: string;
  label: string;
  route: string;
}

@Component({
  selector: 'app-bottom-nav',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './bottom-nav.html',
  styleUrl: './bottom-nav.css',
})
export class BottomNav {
  items: NavItem[] = [
    { icon: 'home', label: 'Početna', route: '/home' },
    { icon: 'explore', label: 'Istraži', route: '/explore' },
    { icon: 'search', label: 'Pretraži', route: '/search' },
    { icon: 'event', label: 'Događaji', route: '/events' },
    { icon: 'person', label: 'Profil', route: '/profile' },
  ];
}
