import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Registration } from '../../services/registration';

@Component({
  selector: 'app-admin-dashboard',
  imports: [CommonModule],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.scss'
})
export class AdminDashboard implements OnInit {
  private registrationService = inject(Registration);

  registrations: any[] = [];
  errorMessage = '';

  ngOnInit(): void {
    this.registrationService.getAllRegistrations().subscribe({
      next: data => {
        this.registrations = data;
      },
      error: () => {
        this.errorMessage = 'Greška pri učitavanju svih prijava.';
      }
    });
  }
}