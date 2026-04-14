import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { InterestsService } from '../../../core/services/interests.service';

@Component({
  selector: 'app-interests',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './interests.html',
  styleUrl: './interests.css',
})
export class Interests implements OnInit {
  interests: { id: number; name: string; icon: string | null; selected: boolean }[] = [];
  fromProfile = false;
  loading = true;
  validationError = '';
  readonly skeletonItems = [1, 2, 3, 4, 5, 6];
  readonly MIN = 2;
  readonly MAX = 5;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private interestsService: InterestsService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.fromProfile = this.route.snapshot.queryParamMap.get('from') === 'profile';
    const savedIds = this.fromProfile ? this.interestsService.getSelectedIds() : [];

    this.interestsService.getInterestTags().subscribe({
      next: (tags) => {
        this.interests = tags.map((t) => ({
          ...t,
          selected: savedIds.includes(t.id),
        }));
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  get selectedCount(): number {
    return this.interests.filter(i => i.selected).length;
  }

  toggle(interest: { id: number; selected: boolean }) {
    if (!interest.selected && this.selectedCount >= this.MAX) return;
    interest.selected = !interest.selected;
    this.validationError = '';
    this.cdr.detectChanges();
  }

  nastavi() {
    if (this.selectedCount < this.MIN) {
      this.validationError = `Izaberi najmanje ${this.MIN} interesovanja.`;
      this.cdr.detectChanges();
      return;
    }
    const selectedIds = this.interests.filter((i) => i.selected).map((i) => i.id);
    this.interestsService.saveSelectedIds(selectedIds);
    this.router.navigate(['/profile']);
  }
}
