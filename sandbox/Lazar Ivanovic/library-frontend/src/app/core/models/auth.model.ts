// šta šaljemo kada se korisnik loguje
export interface LoginRequest {
  email: string;
  password: string;
}

// šta dobijamo nazad nakon uspešnog logovanja
export interface LoginResponse {
  token: string;
  name: string;
  email: string;
  role: string;
}