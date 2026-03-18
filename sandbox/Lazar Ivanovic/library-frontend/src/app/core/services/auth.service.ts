import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { LoginRequest, LoginResponse } from '../models/auth.model';
import { User } from '../models/user.model';

@Injectable({
  providedIn: 'root' // dostupan u celoj aplikaciji, ne treba nigde da ga registrujemo
})
export class AuthService {
  private apiUrl = 'http://localhost:5234/api/auth';

  // signal je moderan Angular način čuvanja stanja - kada se promeni, 
  // sve komponente koje ga koriste se automatski osvežavaju
  trenutniKorisnik = signal<User | null>(null);

  constructor(private http: HttpClient, private router: Router) {
    // kada se aplikacija pokrene, proverimo da li korisnik već ima token
    // (da se ne odjavljuje svaki put kada refresh-uje stranicu)
    this.ucitajKorisnikaIzStorage();
  }

  login(zahtev: LoginRequest) {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, zahtev);
  }

  register(name: string, email: string, password: string) {
    return this.http.post(`${this.apiUrl}/register`, { name, email, password });
  }

  // poziva se nakon uspešnog logovanja - čuva token i korisnika
  sacuvajLogin(odgovor: LoginResponse) {
    // localStorage je kao mali skladišni prostor u browseru
    // ostaje i nakon zatvaranja taba
    localStorage.setItem('token', odgovor.token);
    localStorage.setItem('korisnik', JSON.stringify({
      name: odgovor.name,
      email: odgovor.email,
      role: odgovor.role
    }));

    this.trenutniKorisnik.set({
      name: odgovor.name,
      email: odgovor.email,
      role: odgovor.role as 'Admin' | 'User'
    });
  }

  odjavi() {
    // brišemo sve iz localStorage i vraćamo na login
    localStorage.removeItem('token');
    localStorage.removeItem('korisnik');
    this.trenutniKorisnik.set(null);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  jeUlogovan(): boolean {
    return this.getToken() !== null;
  }

  jeAdmin(): boolean {
    return this.trenutniKorisnik()?.role === 'Admin';
  }

  private ucitajKorisnikaIzStorage() {
    const korisnikStr = localStorage.getItem('korisnik');
    if (korisnikStr) {
      const korisnik = JSON.parse(korisnikStr) as User;
      this.trenutniKorisnik.set(korisnik);
    }
  }
}