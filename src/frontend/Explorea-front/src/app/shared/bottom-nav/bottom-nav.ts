import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

interface NavItem {
  icon: string;
  labelKey: string;
  route: string;
}

@Component({
  selector: 'app-bottom-nav',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule],
  templateUrl: './bottom-nav.html',
  styleUrl: './bottom-nav.css',
})
export class BottomNav {
  items: NavItem[] = [
    { icon: 'home', labelKey: 'BOTTOM_NAV.HOME', route: '/home' },
    { icon: 'explore', labelKey: 'BOTTOM_NAV.EXPLORE', route: '/explore' },
    { icon: 'search', labelKey: 'BOTTOM_NAV.SEARCH', route: '/search' },
    { icon: 'event', labelKey: 'BOTTOM_NAV.EVENTS', route: '/events' },
    { icon: 'person', labelKey: 'BOTTOM_NAV.PROFILE', route: '/profile' },
  ];
}
