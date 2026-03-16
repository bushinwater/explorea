
# Model Context Protocol (MCP) — Instalacija i korišćenje 

## Sadržaj

1. [Šta je MCP?](#1-šta-je-mcp)
2. [Kako MCP funkcioniše?](#2-kako-mcp-funkcioniše)
3. [Ključni koncepti](#3-ključni-koncepti)
4. [Kada koristiti MCP?](#4-kada-koristiti-mcp)
5. [Preduslovi](#5-preduslovi)
6. [Priprema baze podataka](#6-priprema-baze-podataka)
7. [Kreiranje MCP servera](#7-kreiranje-mcp-servera)
8. [Pokretanje servera](#8-pokretanje-servera)
9. [Testiranje sa MCP Inspector](#9-testiranje-sa-mcp-inspector)
10. [Korisni linkovi](#10-korisni-linkovi)

---

## 1. Šta je MCP?

**Model Context Protocol (MCP)** je otvoreni standard koji je kompanija Anthropic objavila krajem 2024. godine. Jednostavno rečeno — to je način na koji AI modeli (kao što su ChatGPT, Copilot ili Claude) mogu da pristupe podacima iz naših sistema i odgovaraju na pitanja na osnovu tih podataka.

Da bi ovo bilo jasnije, zamislimo sledeći primer. Pitamo ChatGPT: *„Koje planine mogu da posetim u Srbiji?"* ChatGPT može da odgovori na osnovu svog opšteg znanja. Ali šta ako pitamo: *„Koji hoteli su slobodni ovog vikenda u Beogradu?"* — to ChatGPT ne može da zna, jer ti podaci se nalaze u nekoj bazi podataka i menjaju se svakodnevno.

MCP rešava upravo ovaj problem. Umesto da AI odgovara samo iz svog znanja, MCP mu omogućava da pozove naše metode, dobije prave podatke iz naše baze, i na osnovu toga odgovori korisniku.

Najjednostavnija analogija: **MCP je za AI modele ono što je USB port za računare.** USB standardizuje način na koji se svaki uređaj priključuje na računar — isti priključak za miš, štampač, tastaturu. Na isti način, MCP standardizuje kako AI modeli pristupaju eksternim podacima. Jednom napisan MCP server može koristiti bilo koji AI klijent koji podržava protokol.

---

## 2. Kako MCP funkcioniše?

Kada korisnik postavi pitanje AI agentu, ceo proces izgleda ovako:

1. Korisnik pita: *„Koje planine mogu da posetim u Srbiji?"*
2. AI agent proverava koje metode su mu dostupne kroz MCP i čita njihove opise
3. Na osnovu opisa zaključuje koju metodu da pozove i sa kojim parametrima
4. Šalje poziv našem MCP serveru — npr. poziva metodu `PretraziPoKategoriji` sa parametrom `"planina"`
5. MCP server prima poziv, izvršava upit nad bazom podataka i vraća rezultate
6. AI agent dobija podatke i formuliše odgovor korisniku na prirodnom jeziku

Ključna stvar: **mi ne pišemo nikakav AI kod.** Mi samo definišemo metode i opisujemo šta svaka radi. AI sam čita te opise i odlučuje kada i kako da ih pozove.

MCP sistem se sastoji od tri komponente:

| Komponenta | Uloga | Primer |
|------------|-------|--------|
| **MCP Host** | Aplikacija koja sadrži AI model | ChatGPT, Copilot, Claude Desktop |
| **MCP Client** | Deo host aplikacije koji komunicira sa serverom | Ugrađen u host, ne piše se ručno |
| **MCP Server** | Naš server koji izlaže podatke i metode | .NET aplikacija koju mi pravimo |

---

## 3. Ključni koncepti

MCP server može da izlaže tri vrste stvari:

### Tools (Alati)

Tools su metode koje AI agent može da pozove. Svaka metoda ima naziv, opis i parametre. Na osnovu opisa AI zaključuje kada i kako da je pozove. Ovo je najvažniji koncept — sve što radimo u ovom dokumentu spada u Tools.

### Resources (Resursi)

Resources su podaci koje AI može samo da čita, ali ne i da menja. Koriste se za statične informacije — na primer, lista kategorija ili konfiguracija sistema. Za većinu projekata nisu obavezni.

### Prompts (Šabloni)

Prompts su unapred definisani šabloni za česte upite. Nisu obavezni i za početak se mogu izostaviti.

---

## 4. Kada koristiti MCP?

MCP ima smisla koristiti kada:

- Želite da AI agent može da čita podatke iz vaše baze i odgovara na pitanja u prirodnom jeziku
- Sistem treba da podrži više različitih AI klijenata kroz jedan interfejs
- AI treba da obavlja akcije u sistemu — pretrage, rezervacije, ažuriranja
- Korisnici treba da postavljaju složene upite bez poznavanja SQL-a


---

## 5. Preduslovi

Za pokretanje MCP servera potrebno je sledeće:

### .NET SDK (verzija 8 ili novija)

Preuzmite sa [dotnet.microsoft.com/download](https://dotnet.microsoft.com/download) — odaberite verziju označenu kao **LTS**.

Nakon instalacije proverite u terminalu:

```bash
dotnet --version
```

Trebalo bi da vidite nešto poput: `9.0.x`

### PostgreSQL (verzija 16 ili novija)

Detaljna uputstva za instalaciju nalaze se u posebnoj dokumentaciji za PostgreSQL u okviru ovog projekta. Preuzmite sa [postgresql.org/download](https://www.postgresql.org/download/).

Nakon instalacije proverite u terminalu:

```bash
psql --version
```

Trebalo bi da vidite nešto poput: `psql (PostgreSQL) 17.x`

> **Napomena za Windows korisnike:** Ako `psql` nije prepoznat kao komanda, potrebno je dodati PostgreSQL u PATH. U Windows pretrazi pronađite *"Edit the system environment variables"*, otvorite *Environment Variables*, pronađite promenljivu *Path* u delu System variables, kliknite *Edit* pa *New* i dodajte putanju: `C:\Program Files\PostgreSQL\17\bin`. Nakon toga zatvorite i ponovo otvorite terminal.

### Node.js (verzija 18 ili novija)

Potreban samo za MCP Inspector alat za testiranje. Preuzmite sa [nodejs.org](https://nodejs.org) — odaberite **LTS** verziju.

> **Napomena za Windows korisnike:** Ako dobijete grešku `running scripts is disabled`, pokrenite sledeću komandu u terminalu i potvrdite sa `Y`:
> ```powershell
> Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
> ```

---

## 6. Priprema baze podataka

### Pokretanje PostgreSQL konzole

Otvorite terminal i pokrenite:

```bash
psql -U postgres
```

Unesite lozinku koju ste zadali tokom instalacije PostgreSQL-a. Kada uđete, videćete oznaku:

```
postgres=#
```

### Kreiranje baze podataka

```sql
CREATE DATABASE turisticka_srbija;
```

Prebacite se na novu bazu:

```sql
\c turisticka_srbija
```

### Kreiranje tabele

```sql
CREATE TABLE destinacije (
    id          SERIAL PRIMARY KEY,
    naziv       VARCHAR(100) NOT NULL,
    kategorija  VARCHAR(50)  NOT NULL,
    region      VARCHAR(100) NOT NULL,
    opis        TEXT
);
```

### Unos podataka

```sql
INSERT INTO destinacije (Naziv, Kategorija, Region, Opis) VALUES
('Beograd',        'grad',    'Centralna Srbija', 'Glavni grad Srbije na ušću Save u Dunav, poznat po Kalemegdanu i živoj noćnoj sceni.'),
('Novi Sad',       'grad',    'Vojvodina',        'Grad na Dunavu, domaćin EXIT festivala i tvrđave Petrovaradin.'),
('Niš',            'grad',    'Južna Srbija',     'Treći grad Srbije, rodni grad Konstantina Velikog, poznat po tvrđavi i ćele-kuli.'),
('Zlatibor',       'planina', 'Zapadna Srbija',   'Popularno planinsko odmaralište sa čistim vazduhom i prostranim pašnjacima.'),
('Kopaonik',       'planina', 'Centralna Srbija', 'Najveći planinski centar u Srbiji, poznat po ski-stazama i nacionalnom parku.'),
('Tara',           'planina', 'Zapadna Srbija',   'Nacionalni park sa gustim šumama, kanjonom Drine i pogledom na Perućačko jezero.'),
('Vrnjačka Banja', 'banja',   'Centralna Srbija', 'Najveća banja u Srbiji, poznata po mineralnim izvorima i šetalištima.'),
('Sokobanja',      'banja',   'Istočna Srbija',   'Banja u dolini okruženoj planinama, poznata po termalno-mineralnim vodama.'),
('Prolom Banja',   'banja',   'Južna Srbija',     'Planinska banja na Radan planini, poznata po vodi sa najnižim sadržajem natrijuma u Evropi.');
```

Proverite da su podaci uspešno uneti:

```sql
SELECT * FROM destinacije;
```

Izađite iz PostgreSQL konzole:

```sql
\q
```

---

## 7. Kreiranje MCP servera

### Korak 1 — Kreiranje projekta

Otvorite terminal, odaberite folder gde želite da napravite projekat i pokrenite:

```bash
dotnet new web -n SrbijaMcpServer
cd SrbijaMcpServer
```

### Korak 2 — Instalacija paketa

```bash
dotnet add package ModelContextProtocol.AspNetCore --prerelease
dotnet add package Npgsql.EntityFrameworkCore.PostgreSQL
dotnet add package Microsoft.EntityFrameworkCore.Tools
```

### Korak 3 — Konekcioni string
Otvorite folder projekta u Visual Studio Code radi lakšeg nastavka rada.  
Otvorite fajl `appsettings.json` koji se nalazi u folderu projekta i zamenite ceo sadržaj sledećim. Unesite svoju PostgreSQL lozinku umesto `VASA_LOZINKA`:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Port=5432;Database=turisticka_srbija;Username=postgres;Password=VASA_LOZINKA"
  },
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "*"
}
```

### Korak 4 — Kod aplikacije

Otvorite fajl `Program.cs`, obrišite sve što se nalazi unutra i unesite sledeći kod:

```csharp
using Microsoft.EntityFrameworkCore;
using ModelContextProtocol.Server;
using System.ComponentModel;

// ============================================================
// KONFIGURACIJA APLIKACIJE
// ============================================================

var builder = WebApplication.CreateBuilder(args);

// Registracija konekcije ka PostgreSQL bazi
// Konekcioni string se čita iz appsettings.json
builder.Services.AddDbContext<Baza>(opcije =>
    opcije.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// Registracija MCP servera:
// WithHttpTransport — koristi HTTP/SSE protokol za komunikaciju sa AI klijentima
// WithToolsFromAssembly — automatski pronalazi sve klase označene sa [McpServerToolType]
builder.Services.AddMcpServer()
    .WithHttpTransport()
    .WithToolsFromAssembly();

var app = builder.Build();

// Sve MCP komunikacije idu na putanju /mcp
app.MapMcp("/mcp");

app.Run();


// ============================================================
// MODEL — predstavlja jedan red iz tabele destinacije u bazi
// ============================================================

public class Destinacija
{
    public int Id { get; set; }
    public string Naziv { get; set; } = string.Empty;
    public string Kategorija { get; set; } = string.Empty;
    public string Region { get; set; } = string.Empty;
    public string Opis { get; set; } = string.Empty;
}


// ============================================================
// BAZA KONTEKST — upravlja konekcijom ka bazi i mapiranjem tabela
// ============================================================

public class Baza : DbContext
{
    public Baza(DbContextOptions<Baza> opcije) : base(opcije) { }

    // Svaki DbSet predstavlja jednu tabelu u bazi
    public DbSet<Destinacija> Destinacije { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Mapiramo C# klasu Destinacija na tabelu "destinacije" u bazi
        // i svako svojstvo na odgovarajuću kolonu
        // PostgreSQL koristi mala slova za nazive tabela i kolona
        // pa je ovo mapiranje neophodno da bi EF Core pronašao ispravne kolone
        modelBuilder.Entity<Destinacija>(entitet =>
        {
            entitet.ToTable("destinacije");
            entitet.Property(d => d.Id).HasColumnName("id");
            entitet.Property(d => d.Naziv).HasColumnName("naziv");
            entitet.Property(d => d.Kategorija).HasColumnName("kategorija");
            entitet.Property(d => d.Region).HasColumnName("region");
            entitet.Property(d => d.Opis).HasColumnName("opis");
        });
    }
}


// ============================================================
// MCP TOOLS — metode koje AI agent može da pozove
//
// Svaka metoda mora imati:
//   [McpServerTool] — označava da je metoda dostupna AI agentu
//   [Description("...")] — AI čita ovaj tekst da bi znao kada da pozove metodu
//                          što je opis precizniji, AI će ga bolje koristiti
// ============================================================

[McpServerToolType] // Označava da ova klasa sadrži MCP tools metode
public class DestinacijeTools
{
    // DbContext se automatski ubacuje kroz Dependency Injection
    // Ne pravimo ga ručno — .NET to radi za nas
    private readonly Baza _baza;

    public DestinacijeTools(Baza baza)
    {
        _baza = baza;
    }

    // ----------------------------------------------------------
    // Tool 1: Vraća sve destinacije iz baze
    // AI poziva ovu metodu kada korisnik pita npr:
    // "Koje sve destinacije postoje?" ili "Pokaži mi sve destinacije"
    // ----------------------------------------------------------
    [McpServerTool, Description("Vraca listu svih turistickih destinacija u Srbiji.")]
    public async Task<List<Destinacija>> SveDestinacije()
    {
        return await _baza.Destinacije
            .OrderBy(d => d.Naziv)   // sortiramo po nazivu
            .ToListAsync();
    }

    // ----------------------------------------------------------
    // Tool 2: Filtrira destinacije po kategoriji
    // AI poziva ovu metodu kada korisnik pita npr:
    // "Koje planine postoje?" ili "Preporuči mi neku banju"
    // ----------------------------------------------------------
    [McpServerTool, Description("Pretrazuje turisticke destinacije po kategoriji. Dostupne kategorije su: grad, planina, banja.")]
    public async Task<List<Destinacija>> PretraziPoKategoriji(
        [Description("Kategorija destinacije — moze biti: grad, planina ili banja")] string kategorija)
    {
        return await _baza.Destinacije
            .Where(d => d.Kategorija.ToLower() == kategorija.ToLower())  // .ToLower() da radi i ako AI prosledi "Planina" ili "PLANINA"
            .OrderBy(d => d.Naziv)
            .ToListAsync();
    }

    // ----------------------------------------------------------
    // Tool 3: Vraća sve informacije o jednoj destinaciji po nazivu
    // AI poziva ovu metodu kada korisnik pita npr:
    // "Reci mi više o Kopaoniku" ili "Šta mogu da vidim u Nišu?"
    // ----------------------------------------------------------
    [McpServerTool, Description("Vraca sve informacije o jednoj destinaciji na osnovu njenog naziva.")]
    public async Task<Destinacija?> DetaljiDestinacije(
        [Description("Naziv destinacije, npr. Kopaonik, Beograd, Vrnjacka Banja")] string naziv)
    {
        return await _baza.Destinacije
            .FirstOrDefaultAsync(d => d.Naziv.ToLower() == naziv.ToLower());  // upoređujemo bez razlike u veličini slova
    }

    // ----------------------------------------------------------
    // Tool 4: Filtrira destinacije po regionu Srbije
    // AI poziva ovu metodu kada korisnik pita npr:
    // "Šta ima da se poseti u Vojvodini?" ili "Destinacije u zapadnoj Srbiji"
    // ----------------------------------------------------------
    [McpServerTool, Description("Pretrazuje turisticke destinacije po regionu Srbije. Dostupni regioni su: Centralna Srbija, Vojvodina, Zapadna Srbija, Juzna Srbija, Istocna Srbija.")]
    public async Task<List<Destinacija>> PretraziPoRegionu(
        [Description("Region Srbije, npr. Vojvodina, Zapadna Srbija, Juzna Srbija")] string region)
    {
        return await _baza.Destinacije
            .Where(d => d.Region.ToLower().Contains(region.ToLower()))  // .Contains() da radi i ako AI prosledi samo "vojvodina" bez "Vojvodina"
            .OrderBy(d => d.Naziv)
            .ToListAsync();
    }
}
```

---

## 8. Pokretanje servera

U terminalu unutar foldera projekta pokrenite:

```bash
dotnet run
```

Ako je sve ispravno podešeno, videćete:

```
Now listening on: http://localhost:5000
Application started. Press Ctrl+C to shut down.
```

> Port se može razlikovati — .NET automatski bira slobodan port. Zabeležite tačan port jer će biti potreban za testiranje.

Za zaustavljanje servera pritisnite `Ctrl+C`.

---

## 9. Testiranje sa MCP Inspector

MCP Inspector je zvanični alat za testiranje MCP servera direktno u browseru. Omogućava ručno pozivanje tools metoda i prikazuje tačno ono što bi dobio AI agent kao odgovor — korisno tokom razvoja.

### Pokretanje

Otvorite **novi terminal** (server mora ostati pokrenut u prvom terminalu) i pokrenite:

```bash
npx @modelcontextprotocol/inspector
```

Ako se traži potvrda za instalaciju, ukucajte `y` i pritisnite Enter. U browseru će se nakon pokretanja otvoriti MCP Inspector.
### Povezivanje na server

1. Proverite da je **Transport Type** postavljen na `Streamable HTTP`
2. U polje za URL unesite adresu servera sa portom koji je vaš server ispisao:
   ```
   http://localhost:5000/mcp
   ```
3. Kliknite **Connect**

Kada na tabu "Tools" kliknemo na "List Tools" pojaviće se sve četiri tools metode.

### Testiranje metoda

Kliknite na bilo koji tool, popunite parametre i kliknite **Run Tool**. Rezultat se prikazuje u JSON formatu.

Nekoliko primera za testiranje:

| Tool | Parametar | Očekivani rezultat |
|------|-----------|-------------------|
| `SveDestinacije` | *(bez parametara)* | Svih 9 destinacija |
| `PretraziPoKategoriji` | `planina` | Zlatibor, Kopaonik, Tara |
| `PretraziPoKategoriji` | `banja` | Vrnjačka Banja, Sokobanja, Prolom Banja |
| `DetaljiDestinacije` | `Kopaonik` | Sve informacije o Kopaoniku |
| `PretraziPoRegionu` | `Vojvodina` | Novi Sad |

## 10. Korisni linkovi  
  
- **Model Context Protocol – zvanična dokumentacija**   
 <https://modelcontextprotocol.io/docs/>  
  
- **MCP u .NET aplikacijama (Microsoft vodič)**   
 <https://learn.microsoft.com/en-us/dotnet/ai/get-started-mcp>  
  
- **Entity Framework Core dokumentacija**   
 <https://learn.microsoft.com/en-us/ef/core/>  