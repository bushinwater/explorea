import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Book, CreateBookRequest } from '../models/book.model';

@Injectable({
  providedIn: 'root'
})
export class BookService {
  private apiUrl = 'http://localhost:5234/api/books';

  // HttpClient ubacujemo kroz dependency injection - isto kao u .NET-u
  constructor(private http: HttpClient) {}

  // GET /api/books - vraća sve knjige
  getAll() {
    return this.http.get<Book[]>(this.apiUrl);
  }

  // GET /api/books/search?pojam=... - pretraga knjiga
  search(pojam: string) {
    return this.http.get<Book[]>(`${this.apiUrl}/search`, {
      params: { pojam }
    });
  }

  // POST /api/books - admin dodaje novu knjigu
  create(knjiga: CreateBookRequest) {
    return this.http.post<Book>(this.apiUrl, knjiga);
  }

  // PUT /api/books/5 - admin menja postojeću knjigu
  update(id: number, knjiga: CreateBookRequest) {
    return this.http.put<Book>(`${this.apiUrl}/${id}`, knjiga);
  }

  // DELETE /api/books/5 - admin briše knjigu
  delete(id: number) {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
}