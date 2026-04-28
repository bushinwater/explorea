import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { AboutUsModal } from '../about-us-modal/about-us-modal';

@Component({
  selector: 'app-detail-footer',
  standalone: true,
  imports: [CommonModule, TranslateModule, AboutUsModal],
  templateUrl: './detail-footer.html',
  styleUrl: './detail-footer.css',
})
export class DetailFooter {
  aboutOpen = false;
}
