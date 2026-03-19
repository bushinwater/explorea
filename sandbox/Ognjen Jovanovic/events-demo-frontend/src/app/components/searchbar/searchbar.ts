import { Component, EventEmitter, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-search-bar',
  imports: [FormsModule],
  templateUrl: './searchbar.html',
  styleUrl: './searchbar.css',
})
export class SearchBarComponent {
  @Output() searchChanged = new EventEmitter<string>();

  searchTerm = '';

  onSearchChange(): void {
    this.searchChanged.emit(this.searchTerm);
  }
}
