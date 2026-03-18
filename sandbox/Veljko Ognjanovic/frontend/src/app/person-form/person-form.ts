import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-person-form',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './person-form.html',
  styleUrl: './person-form.css',
})
export class PersonForm {

  person = {
    ime: '',
    prezime: '',
    jmbg: ''
  };

  constructor(private http: HttpClient) {}

  submit() {
    this.http.post('http://localhost:5048/api/person', this.person)
      .subscribe(() => alert('Sacuvano!'));
  }
}