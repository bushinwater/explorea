// korisnik sistema - odgovara LoginResponse DTO iz backenda
export interface User {
  id?: number;
  name: string;
  email: string;
  role: 'Admin' | 'User'; // samo ove dve vrednosti su moguće
}