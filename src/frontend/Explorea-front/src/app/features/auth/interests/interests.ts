import { NgFor } from '@angular/common';
import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-interests',
  standalone: true,
  imports: [NgFor],
  templateUrl: './interests.html',
  styleUrl: './interests.css',
})
export class Interests {
  interests = [
    { id: 1, label: 'Avanture', selected: false },
    { id: 2, label: 'Clubing', selected: false },
    { id: 3, label: 'Kultura', selected: false },
    { id: 4, label: 'Umetnost', selected: false },
    { id: 5, label: 'Hrana', selected: false },
    { id: 6, label: 'Sport', selected: false },
  ];

  constructor(private router: Router) {}

  toggle(interest: any) {
    interest.selected = !interest.selected;
  }

  nastavi() {
    const selected = this.interests.filter((i) => i.selected);
    console.log('Selektovani interesi:', selected);
    this.router.navigate(['/home']); // zameni sa pravom rutom
  }
}
