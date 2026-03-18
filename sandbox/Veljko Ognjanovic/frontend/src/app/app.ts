import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PersonForm } from './person-form/person-form'; // dodaj import

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, PersonForm], // dodaj komponentu u imports
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('frontend');
}