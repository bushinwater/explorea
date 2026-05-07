import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  ConfirmDialogComponent,
  EmptyStateComponent,
  FeedbackBannerComponent,
} from '@shared/components';
import { AdminUiPreferencesService } from '../../../core/services/admin-ui-preferences.service';
import { ObjectRequestsService } from '../../object-requests';
import { RequestPriority } from '../../object-requests.models';

@Component({
  selector: 'app-admin-object-request-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FeedbackBannerComponent, ConfirmDialogComponent, EmptyStateComponent],
  templateUrl: './object-request-detail.html',
  styleUrl: './object-request-detail.css',
})
export class AdminObjectRequestDetailComponent implements OnInit {
  protected route = inject(ActivatedRoute);
  private router = inject(Router);
  private service = inject(ObjectRequestsService);
  protected readonly ui = inject(AdminUiPreferencesService);

  protected readonly request = this.service.request;
  protected readonly isLoading = this.service.loading;

  protected readonly adminComment = signal('');
  protected readonly isConfirmOpen = signal(false);
  protected readonly isSubmitting = signal(false);
  protected readonly pendingAction = signal<'approve' | 'decline' | null>(null);

  protected readonly successMessage = signal('');
  protected readonly errorMessage = signal('');

  protected readonly totalSteps = computed(() => 4);

  protected readonly currentStep = computed(() => {
    const req = this.request();
    if (!req) return 1;
    if (req.status === 'approved' || req.status === 'rejected') return 4;
    return req.pipelineSteps.filter((s) => s.state === 'done').length + 1;
  });

  protected readonly fullPipelineSteps = computed(() => {
    const req = this.request();
    if (!req) return [];

    const steps = [...req.pipelineSteps];

    if (req.status === 'approved') {
      steps.push({
        label: this.ui.t('requests.pipeline.adminDecision'),
        actor: this.ui.t('requests.verify.title'),
        comment: req.adminComment || this.ui.t('requests.pipeline.approvedComment'),
        state: 'done',
      });
    } else if (req.status === 'rejected') {
      steps.push({
        label: this.ui.t('requests.pipeline.adminDecision'),
        actor: this.ui.t('requests.verify.title'),
        comment: req.rejectionReason || '',
        state: 'rejected',
      });
    }

    return steps;
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '1';
    this.service.loadRequestById(id);
  }

  protected goBack(): void {
    this.router.navigate(['/admin/destinations']);
  }

  protected priorityLabel(p: RequestPriority): string {
    return this.ui.t(`requests.priority.${p}`);
  }

  protected initiateAction(action: 'approve' | 'decline'): void {
    if (action === 'decline' && !this.adminComment().trim()) {
      this.errorMessage.set(this.ui.t('requests.error.commentRequired'));
      setTimeout(() => this.errorMessage.set(''), 4000);
      return;
    }
    this.pendingAction.set(action);
    this.isConfirmOpen.set(true);
  }

  protected cancelAction(): void {
    this.pendingAction.set(null);
    this.isConfirmOpen.set(false);
  }

  protected submitAction(): void {
    const action = this.pendingAction();
    this.isSubmitting.set(true);

    setTimeout(() => {
      if (action === 'approve') {
        this.service.approveRequest(this.adminComment());
        this.successMessage.set(this.ui.t('requests.success.approved'));
      } else if (action === 'decline') {
        this.service.rejectRequest(this.adminComment());
        this.successMessage.set(this.ui.t('requests.success.rejected'));
      }
      this.isSubmitting.set(false);
      this.isConfirmOpen.set(false);
      this.pendingAction.set(null);
      setTimeout(() => this.successMessage.set(''), 4000);
    }, 600);
  }

  protected downloadDoc(doc: { url: string }): void {
    window.open(doc.url, '_blank');
  }
}
