import { Component, EventEmitter, HostListener, Input, OnDestroy, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChangeDetectorRef } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { BugReportService } from '../../../core/services/bug-report.service';

@Component({
  selector: 'app-bug-report-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './bug-report-modal.html',
  styleUrl: './bug-report-modal.css',
})
export class BugReportModal implements OnInit, OnDestroy {
  @Input() isLoggedIn = false;
  @Output() closed = new EventEmitter<void>();

  subject = '';
  description = '';
  email = '';

  subjectError = '';
  descriptionError = '';
  emailError = '';
  submitError = '';

  submitting = false;
  submitted = false;

  private bugReportService = inject(BugReportService);
  private cdr = inject(ChangeDetectorRef);
  private translate = inject(TranslateService);
  private lockedScrollY = 0;

  private static readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
  }

  ngOnInit(): void {
    this.lockPageScroll();
  }

  ngOnDestroy(): void {
    this.unlockPageScroll();
  }

  close(): void {
    this.closed.emit();
  }

  submit(): void {
    if (this.submitting) return;

    this.subjectError = '';
    this.descriptionError = '';
    this.emailError = '';
    this.submitError = '';

    let valid = true;

    if (!this.subject.trim()) {
      this.subjectError = this.translate.instant('BUG_REPORT.ERROR_SUBJECT_REQUIRED');
      valid = false;
    } else if (this.subject.trim().length > 200) {
      this.subjectError = this.translate.instant('BUG_REPORT.ERROR_SUBJECT_MAX');
      valid = false;
    }

    if (!this.description.trim()) {
      this.descriptionError = this.translate.instant('BUG_REPORT.ERROR_DESC_REQUIRED');
      valid = false;
    } else if (this.description.trim().length > 2000) {
      this.descriptionError = this.translate.instant('BUG_REPORT.ERROR_DESC_MAX');
      valid = false;
    }

    if (!this.isLoggedIn && this.email.trim() && !BugReportModal.EMAIL_REGEX.test(this.email.trim())) {
      this.emailError = this.translate.instant('BUG_REPORT.ERROR_EMAIL_INVALID');
      valid = false;
    }

    if (!valid) {
      this.cdr.detectChanges();
      return;
    }

    this.submitting = true;
    this.cdr.detectChanges();

    const dto: { subject: string; description: string; email?: string } = {
      subject: this.subject.trim(),
      description: this.description.trim(),
    };
    if (!this.isLoggedIn && this.email.trim()) {
      dto.email = this.email.trim();
    }

    this.bugReportService.submit(dto).subscribe({
      next: () => {
        this.submitting = false;
        this.submitted = true;
        this.cdr.detectChanges();
      },
      error: () => {
        this.submitting = false;
        this.submitError = this.translate.instant('BUG_REPORT.ERROR_SUBMIT');
        this.cdr.detectChanges();
      },
    });
  }

  private lockPageScroll(): void {
    if (document.body.style.position === 'fixed') return;

    this.lockedScrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${this.lockedScrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
  }

  private unlockPageScroll(): void {
    if (document.body.style.position !== 'fixed') return;

    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    document.body.style.overflow = '';
    window.scrollTo({ top: this.lockedScrollY, behavior: 'instant' as ScrollBehavior });
  }
}
