import { NgFor } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { InterestsService } from '../../../core/services/interests.service';

const ALL_INTERESTS = [
  { id: 1, label: 'Avanture' },
  { id: 2, label: 'Clubing' },
  { id: 3, label: 'Kultura' },
  { id: 4, label: 'Umetnost' },
  { id: 5, label: 'Hrana' },
  { id: 6, label: 'Sport' },
];

@Component({
  selector: 'app-interests',
  standalone: true,
  imports: [NgFor],
  templateUrl: './interests.html',
  styleUrl: './interests.css',
})
export class Interests implements OnInit {
  interests: { id: number; label: string; selected: boolean }[] = [];
  fromProfile = false;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private interestsService: InterestsService,
  ) {}

  ngOnInit() {
    this.fromProfile = this.route.snapshot.queryParamMap.get('from') === 'profile';

    const savedIds = this.interestsService.getSelectedIds();

    this.interests = ALL_INTERESTS.map((i) => ({
      ...i,
      selected: savedIds.includes(i.id),
    }));
  }

  toggle(interest: { id: number; label: string; selected: boolean }) {
    interest.selected = !interest.selected;
  }

  nastavi() {
    const selectedIds = this.interests.filter((i) => i.selected).map((i) => i.id);
    this.interestsService.saveSelectedIds(selectedIds);

    if (this.fromProfile) {
      this.router.navigate(['/profile']);
    } else {
      this.router.navigate(['/home']);
    }
  }
}
