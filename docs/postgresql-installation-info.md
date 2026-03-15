# PostgreSQL — Vodič za instalaciju i korišćenje

---

## Sadržaj

1. [Šta je PostgreSQL?](#1-šta-je-postgresql)
2. [Gde se najčešće koristi?](#2-gde-se-najčešće-koristi)
3. [Preduslovi](#3-preduslovi)
4. [Instalacija](#4-instalacija)
5. [Konekcioni string](#7-konekcioni-string)
6. [Konfiguracija u ASP.NET Core projektu](#8-konfiguracija-u-aspnet-core-projektu)
7. [Primer iz C# koda](#9-primer-iz-c-koda)
8. [Zašto smo izabrali Npgsql?](#10-zašto-smo-izabrali-npgsql)

---

## 1. Šta je PostgreSQL?

PostgreSQL (skraćeno „Postgres") je besplatan, open-source sistem za upravljanje relacionim bazama podataka. Razvija se od 1986. godine i danas je jedan od najpopularnijih sistema za baze podataka na svetu. Poznat je po pouzdanosti, fleksibilnosti i podršci za napredne SQL funkcionalnosti.

---

## 2. Gde se najčešće koristi?

- Web aplikacije i API-ji (najčešći slučaj)
- Poslovne aplikacije koje zahtevaju složene upite i relacije između podataka
- Sistemi koji kombinuju strukturirane podatke i JSON dokumente
- Platforme koje zahtevaju visoku pouzdanost i integritet podataka
- Osnova za AI/MCP sisteme koji rade sa strukturiranim podacima

---

## 3. Preduslovi

Pre instalacije proverite sledeće:

- **Operativni sistem:** Windows 10/11 (64-bit), macOS 12+, ili Linux
- **RAM:** Minimum 512 MB slobodnih, preporučeno 2 GB+
- **Disk:** Minimum 1 GB slobodnog prostora za instalaciju
- **Administratorska prava:** Potrebna za instalaciju na Windows-u
- **.NET projekat:** Ako koristite Npgsql, potreban je .NET 6 ili noviji

---

## 4. Instalacija

### Windows (preporučeni način)

1. Preuzmite installer sa [postgresql.org/download/windows](https://www.postgresql.org/download/windows/)
2. Pokrenite `.exe` fajl **kao administrator** (desni klik → *Run as administrator*)
3. Pratite korake čarobnjaka:

   - **Installation Directory** — ostavite podrazumevano (`C:\Program Files\PostgreSQL\17`)
   - **Select Components** — obavezno označite:
     - ☐ PostgreSQL Server
     - ☐ Command Line Tools
     - ☐ pgAdmin 4 *(opciono, može se instalirati posebno — videti sekciju 5)*
     - ☐ Stack Builder *(može se preskočiti, ali je pozeljno cekirati, jer pri finalizaciji instalacije, mozete cekirati da Stack builder skine potrebne potprograme za rad sa bazom, kao sto su pgadmin4 i Npgsql)*
   - **Data Directory** — ostavite podrazumevano
   - **Password** — unesite lozinku za `postgres` superuser nalog. **Zapamtite ovu lozinku!**
   - **Port** — ostavite `5432`
   - **Locale** — ostavite podrazumevano

4. Kliknite *Next* do kraja i sačekajte instalaciju.
5. Na kraju **isključite** Stack Builder ako se ponudi i kliknite *Finish*.

**Provera instalacije** — otvorite Command Prompt i ukucajte:

```cmd
psql --version
```

Trebalo bi da vidite nešto poput: `psql (PostgreSQL) 17.x`

---

### macOS

```bash
# Instalirajte Homebrew ako ga nemate
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Instalirajte PostgreSQL
brew install postgresql@17

# Dodajte u PATH
echo 'export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc

# Pokrenite servis
brew services start postgresql@17
```

---

### Linux (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install -y postgresql postgresql-contrib

# Proverite status
sudo systemctl status postgresql
```

---

### Docker (brz start za razvoj)

```yaml
# docker-compose.yml
version: '3.8'
services:
  postgres:
    image: postgres:17-alpine
    container_name: postgres_dev
    restart: unless-stopped
    environment:
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: mojalozinka
      POSTGRES_DB: mojaprojekt
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

```bash
docker compose up -d
```

---

## 5. Konekcioni string

Konekcioni string je tekst koji sadrži sve informacije potrebne aplikaciji da se poveže na bazu.

### Format sa korisničkim imenom i lozinkom

```
Host=localhost;Port=5432;Database=mojaprojekt;Username=postgres;Password=mojalozinka
```

---

### Format sa Windows SSPI autentifikacijom

**SSPI (Security Support Provider Interface)** je Windows mehanizam koji koristi trenutno prijavljenog Windows korisnika za autentifikaciju — bez lozinke. Radi samo kada su i aplikacija i baza na istom Windows računaru ili unutar iste domene.

```
Host=localhost;Port=5432;Database=mojaprojekt;Integrated Security=true
```

> Da bi SSPI radilo, PostgreSQL mora biti podešen da prihvata `sspi` metodu u `pg_hba.conf` fajlu. Kod standardne instalacije na Windows-u ovo je već konfigurisano za lokalne konekcije.

---

## 6. Konfiguracija u ASP.NET Core projektu

### Korak 1 — Instalacija Npgsql paketa

```bash
dotnet add package Npgsql.EntityFrameworkCore.PostgreSQL
```

Ili putem NuGet Package Manager-a u Visual Studio-u: pronađite `Npgsql.EntityFrameworkCore.PostgreSQL` i instalirajte.

---

### Korak 2 — Konekcioni string u `appsettings.json`

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Port=5432;Database=mojaprojekt;Username=postgres;Password=mojalozinka"
  }
}
```

> Za produkciju, konekcioni string čuvajte u environment varijablama ili secrets menadžeru — nikad u repozitorijumu.

---

### Korak 3 — Registracija u `Program.cs`

```csharp
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

var app = builder.Build();
```

---

### Korak 4 — DbContext

```csharp
using Microsoft.EntityFrameworkCore;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Korisnik> Korisnici { get; set; }
    public DbSet<Narudzba> Narudzbe { get; set; }
}
```

---

### Korak 5 — Migracije

```bash
# Kreiranje prve migracije
dotnet ef migrations add InitialCreate

# Primena migracija na bazu
dotnet ef database update
```

---

## 7. Primer iz C# koda

### Model

```csharp
public class Korisnik
{
    public int Id { get; set; }
    public string Ime { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public bool Aktivan { get; set; } = true;
    public DateTime KreiranU { get; set; } = DateTime.UtcNow;
}
```

### Servis sa osnovnim CRUD operacijama

```csharp
public class KorisnikService
{
    private readonly AppDbContext _db;

    public KorisnikService(AppDbContext db)
    {
        _db = db;
    }

    // Dohvati sve aktivne korisnike
    public async Task<List<Korisnik>> GetAktivneAsync()
    {
        return await _db.Korisnici
            .Where(k => k.Aktivan)
            .OrderBy(k => k.Ime)
            .ToListAsync();
    }

    // Dohvati jednog korisnika po ID-u
    public async Task<Korisnik?> GetByIdAsync(int id)
    {
        return await _db.Korisnici.FindAsync(id);
    }

    // Kreiranje
    public async Task<Korisnik> KreirajAsync(string ime, string email)
    {
        var korisnik = new Korisnik { Ime = ime, Email = email };
        _db.Korisnici.Add(korisnik);
        await _db.SaveChangesAsync();
        return korisnik;
    }

    // Ažuriranje
    public async Task AzurirajEmailAsync(int id, string noviEmail)
    {
        var korisnik = await _db.Korisnici.FindAsync(id);
        if (korisnik is null) return;

        korisnik.Email = noviEmail;
        await _db.SaveChangesAsync();
    }

    // Brisanje
    public async Task ObrisiAsync(int id)
    {
        var korisnik = await _db.Korisnici.FindAsync(id);
        if (korisnik is null) return;

        _db.Korisnici.Remove(korisnik);
        await _db.SaveChangesAsync();
    }
}
```

### Direktan SQL upit (kada EF nije dovoljan)

```csharp
using Npgsql;

public async Task<List<string>> GetEmailoviAktivnihAsync(string connectionString)
{
    var emailovi = new List<string>();

    await using var conn = new NpgsqlConnection(connectionString);
    await conn.OpenAsync();

    await using var cmd = new NpgsqlCommand(
        "SELECT email FROM korisnici WHERE aktivan = @aktivan", conn);
    cmd.Parameters.AddWithValue("aktivan", true);

    await using var reader = await cmd.ExecuteReaderAsync();
    while (await reader.ReadAsync())
    {
        emailovi.Add(reader.GetString(0));
    }

    return emailovi;
}
```

---

## 8. Zašto smo izabrali Npgsql?

**Npgsql** je zvanični .NET drajver za PostgreSQL i jedina preporučena opcija za C#/.NET projekte.

Razlozi zbog kojih smo ga izabrali u ovom projektu:

**Podrška za novije PostgreSQL funkcionalnosti** — Npgsql prati PostgreSQL razvoj i uvek podržava najnovije tipove podataka, JSON operacije i napredne SQL komande koje stariji drajveri ne podržavaju ili podržavaju delimično.

**Fleksibilnost upita** — Omogućava pisanje i čistog SQL-a i korišćenje Entity Framework Core ORM-a bez potrebe za zasebnim paketima. Možete mešati oba pristupa po potrebi.

**Pripremljenost za MCP integraciju** — Planirana implementacija MCP (Model Context Protocol) sistema zahteva drajver koji podržava napredne PostgreSQL funkcionalnosti kao što su `LISTEN/NOTIFY`, streaming i asinhrono procesiranje. Npgsql ima nativnu podršku za sve ovo, što ga čini prirodnim izborom za budući razvoj sistema.

**Aktivno održavanje** — Redovno se ažurira, ima veliku zajednicu i odličnu dokumentaciju, što smanjuje rizik od problema u produkciji.

---

*Dokumentacija pokriva PostgreSQL 16/17 i Npgsql 8.x.*
