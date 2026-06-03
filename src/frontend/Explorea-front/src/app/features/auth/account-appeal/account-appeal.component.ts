import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-account-appeal',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './account-appeal.component.html',
  styleUrl: './account-appeal.component.css',
})
export class AccountAppealComponent implements OnInit {
  protected readonly state = signal<'loading' | 'form' | 'submitted' | 'already' | 'expired' | 'invalid'>('loading');
  protected readonly firstName = signal('');
  protected readonly message = signal('');
  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal('');

  private userId = '';

  constructor(
    private readonly route: ActivatedRoute,
    private readonly http: HttpClient,
  ) {}

  ngOnInit(): void {
    this.userId = this.route.snapshot.queryParamMap.get('userId') ?? '';
    if (!this.userId) {
      this.state.set('invalid');
      return;
    }

    this.http.get<{ canAppeal: boolean; alreadySubmitted: boolean; firstName?: string }>(
      `/api/appeals/check/${this.userId}`
    ).subscribe({
      next: (res) => {
        if (!res.canAppeal) {
          this.state.set('expired');
          return;
        }
        if (res.alreadySubmitted) {
          this.state.set('already');
          return;
        }
        this.firstName.set(res.firstName ?? '');
        this.state.set('form');
      },
      error: () => this.state.set('invalid'),
    });
  }

  protected submit(): void {
    if (this.isSubmitting()) return;
    this.isSubmitting.set(true);
    this.errorMessage.set('');

    this.http.post('/api/appeals', { userId: this.userId, message: this.message() || null }).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.state.set('submitted');
      },
      error: (err) => {
        this.isSubmitting.set(false);
        const msg = err.error?.message;
        if (msg?.toLowerCase().includes('already')) {
          this.state.set('already');
        } else if (msg?.toLowerCase().includes('expired')) {
          this.state.set('expired');
        } else {
          this.errorMessage.set('Greška pri slanju apela. Pokušaj ponovo.');
        }
      },
    });
  }
}
