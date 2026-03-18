import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Registration } from '../../services/registration';
import { RegistrationModel } from '../../models/registration.model';

@Component({
  selector: 'app-my-registration',
  imports: [CommonModule],
  templateUrl: './my-registration.html',
  styleUrl: './my-registration.scss'
})
export class MyRegistration implements OnInit {
  private registrationService = inject(Registration);

  registrations: RegistrationModel[] = [];
  errorMessage = '';

  ngOnInit(): void {
    this.registrationService.getMyRegistrations().subscribe({
      next: data => {
        this.registrations = data;
      },
      error: () => {
        this.errorMessage = 'Greška pri učitavanju prijava.';
      }
    });
  }
}