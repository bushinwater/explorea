import { CommonModule, Location } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { ActivityDetail } from '../../../core/models/activity.model';
import { ActivityService } from '../../../core/services/activity.service';
import { Sidebar } from '../../../layout/shell/sidebar/sidebar';
import { BottomNav } from '../../../shared/bottom-nav/bottom-nav';
import { BookingCardComponent } from '../../../shared/components/booking-card/booking-card';

@Component({
  selector: 'app-activity-detail',
  standalone: true,
  imports: [CommonModule, TranslateModule, Sidebar, BottomNav, BookingCardComponent],
  templateUrl: './activity-detail.html',
  styleUrl: './activity-detail.css',
})
export class ActivityDetailComponent implements OnInit {
  activity: ActivityDetail | null = null;
  loading = true;

  packingList: { key: string; checked: boolean }[] = [
    { key: 'ACTIVITY_DETAIL.PACKING.ITEMS.BOOTS', checked: false },
    { key: 'ACTIVITY_DETAIL.PACKING.ITEMS.SNACKS', checked: false },
    { key: 'ACTIVITY_DETAIL.PACKING.ITEMS.WATER', checked: false },
    { key: 'ACTIVITY_DETAIL.PACKING.ITEMS.POLES', checked: false },
  ];

  constructor(
    private route: ActivatedRoute,
    private activityService: ActivityService,
    private location: Location,
  ) {}

  ngOnInit(): void {
    const slug = this.route.snapshot.paramMap.get('slug') ?? '';
    this.activityService.getBySlug(slug).subscribe({
      next: (data) => {
        this.activity = data;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  get heroImage(): string {
    const first = this.activity?.images?.[0]?.imageUrl;
    return first ?? this.activity?.previewImageUrl ?? '';
  }

  formatDuration(minutes: number | null): string {
    if (!minutes) return '';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}-${h + 1} sati` : `${h}h`;
  }

  getElevation(): string {
    return (this.activity?.extraData?.['elevation'] as string) ?? '';
  }

  getTrailType(): string {
    return (this.activity?.extraData?.['trailType'] as string) ?? '';
  }

  goBack(): void {
    this.location.back();
  }

  toggleItem(index: number): void {
    this.packingList[index].checked = !this.packingList[index].checked;
  }
}
