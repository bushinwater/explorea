import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { SavedItemDto } from '../../../core/models/user.model';
import { ProfileService } from '../../../core/services/profile.service';
import { SavedService } from '../../../core/services/saved.service';
import { Sidebar } from '../../../layout/shell/sidebar/sidebar';
import { BottomNav } from '../../../shared/bottom-nav/bottom-nav';

@Component({
  selector: 'app-saved-items',
  standalone: true,
  imports: [RouterModule, TranslateModule, Sidebar, BottomNav],
  templateUrl: './saved-items.html',
  styleUrl: './saved-items.css',
})
export class SavedItemsPage implements OnInit {
  items: SavedItemDto[] = [];
  loading = true;
  unsavedMap: Record<string, boolean> = {};

  constructor(
    private profileService: ProfileService,
    private savedService: SavedService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.profileService.getSavedItems().subscribe({
      next: (items) => {
        this.items = items;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  getEntityRoute(item: SavedItemDto): string[] {
    const map: Record<string, string> = {
      activity: '/activities',
      destination: '/destinations',
      event: '/events',
      place: '/places',
    };
    return [map[item.entityType] ?? '/', item.slug];
  }

  getTypeLabel(type: string): string {
    return `SAVED_ITEMS.TYPE_${type}`;
  }

  isSaved(id: string): boolean {
    return !this.unsavedMap[id];
  }

  toggleSaved(item: SavedItemDto, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();

    const currentlySaved = this.isSaved(item.id);

    if (currentlySaved) {
      // Optimistically remove from list
      this.items = this.items.filter(i => i.id !== item.id);
      this.cdr.detectChanges();

      this.savedService.unsave(item.entityType, item.entityId).subscribe({
        error: () => {
          // Restore on failure
          this.items = [...this.items, item];
          this.cdr.detectChanges();
        },
      });
    } else {
      this.unsavedMap = { ...this.unsavedMap, [item.id]: true };
      this.cdr.detectChanges();

      this.savedService.save(item.entityType, item.entityId).subscribe({
        error: () => {
          this.unsavedMap = { ...this.unsavedMap, [item.id]: false };
          this.cdr.detectChanges();
        },
      });
    }
  }

  isExpired(item: SavedItemDto): boolean {
    if (item.entityType !== 'event' || !item.endDatetime) return false;
    return new Date(item.endDatetime) < new Date();
  }

  goBack(): void {
    this.router.navigate(['/profile']);
  }
}
