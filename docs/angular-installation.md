# Angular 20 instalacija i inicijalizacija projekta

> Ovaj dokument objašnjava kako podesiti razvojno okruženje za Angular 20, kako se inicijalizuje novi projekat i kako izgleda osnovna struktura Angular aplikacije.

---

## 1. Preduslovi

Pre instalacije Angular-a 20 potrebno je imati:

- instaliran Node.js (`^20.19.0`, `^22.12.0`, `^24.0.0`), TypeScri (`>=5.8.0 <6.0.0`), RxJS(`^6.5.3` ili `^7.4.0`).
- instaliran npm (dolazi uz Node.js)
- preporučeno: Visual Studio Code
- preporučeno: Git

Angular zvanično navodi da je za Angular CLI potrebno prvo instalirati Node.js, a da Node.js instalacija uključuje i npm.

---

## 2. Provera okruženja

Pre početka proveriti da li su Node.js i npm pravilno instalirani:

```powershell
node -v
npm -v
```

Ako komande vrate verzije, okruženje je spremno za nastavak.

---

## 3. Instalacija Angular CLI

CLI se instalira globalno sledećom komandom:

```powershell
npm install -g @angular/cli
```

Provera verzije:

```powershell
ng version
```

Angular dokumentacija koristi Angular CLI kao standardni način da kreira i vodi projekat, novi projekat se inicijalizuje sa:`ng new`.

---

## 4. Inicijalizacija novog Angular projekta:

Novi Angular projekat se kreira komandom:

```powershell
ng new ime-projekta
```

Preporučene opcije za ovaj projekat:

- Routing: `Yes`
- Stylesheet format: `CSS` ili `SCSS`

Dobijanje projekta sa uključenim routing-om i SCSS stilovima:

```powershell
ng new frontend-app --routing --style=scss
```

Po kreiranju projekta Angular CLI instalira potrebne npm pakete i inicijalizuje repozitorijum.

---

## 5. Pokretanje projekta lokalno:

Kada se kreira projekat, ulazi se u njegov folder:

```powershell
cd frontend-app
```

Razvojni server se pokreće sa:

```powershell
ng serve
```

ili:

```powershell
npm start
```

Aplikacija će biti dostupna lokalno na browser-u, na adresi:

```powershell
http://localhost:4200
```

Angular zvanična dokumentacija navodi da se nakon `ng new` projekta aplikacija može odmah pokrenuti lokalno i da su zavisnosti već instalirane.

---

## 6. Najvažnije Angular CLI komande:

**Pokretanje development servera**

```powershell
ng serve
```

**Build aplikacije**

```powershell
ng build
```

Angular koristi workspace konfiguraciju iz `angular.json`, a `ng build` koristi podrazumevanu build konfiguraciju koju generiše CLI. Application builder koristi `esbuild`, dok novije Angu;ar aplikacije koriste novi build sistem kao podrazumevani.

**Pokretanje testova**

```powershell
ng test
```

Za nove Angular CLI projekte, podrazumevani test koristi **Vitest**, a novi projekti uključuju `vitest` i `jsdom`.
**Generisanje nove komponente**

```powershell
ng g c naziv-komponenete
```

---

## 7. Šta Angular CLI kreira

Komanda `ng new` kreira Angular workspace. Workspace je okruženje koje može da sadrži jednu ili više Angular aplikacija i biblioteka. Kod standardnog početnog projekta CLI kreira root-level aplikaciju čiji se izvorni fajlovi nalaze u `src/` folderu.

Tipična struktura izgleda ovako:

```plain text
frontend-app/
├── .editorconfig
├── .gitignore
├── angular.json
├── package.json
├── package-lock.json
├── tsconfig.json
├── README.md
├── public/                (može postojati u novijim projektima za statičke fajlove)
├── src/
│   ├── main.ts
│   ├── index.html
│   ├── styles.scss / styles.css
│   ├── app/
│   │   ├── app.ts
│   │   ├── app.html
│   │   ├── app.css / app.scss
│   │   ├── app.spec.ts
│   │   ├── app.config.ts
│   │   └── app.routes.ts
```

---

## 8. Objašnjenje najvažnijih fajlova

`angular.json`

Glavni konfiguracioni fajl Angular workspace-a. U njemu se definišu pravila za build, serve, test i ostale CLI operacije. Takođe sadrži konfiguraciju pojedinačnih projekata unutar workspace-a.

`package.json`

Definiše npm zavisnosti projekta i scripts komande koje koristimo tokom razvoja.

`package-lock.json`

Zaključava tačne verzije instaliranih paketa kako bi svi članovi tima imali isto okruženje.

`tsconfig.json`
Osnovna TypeScript konfiguracija za ceo workspace. Ostale TypeScript konfiguracije se naslanjaju na ovaj fajl.

`.gitignore`

Definiše koje fajlove Git ne treba da prati, na primer node_modules, build output i privremene fajlove.

`src/index.html`

Osnovni HTML dokument aplikacije. Angular aplikacija se “ubacuje” u ovaj dokument.

`src/main.ts`

Glavna ulazna tačka aplikacije. Odatle Angular podiže aplikaciju i pokreće bootstrap proces.

`src/styles.css` / `src/styles.scss`

Globalni stilovi aplikacije. Ovde idu stilovi koji važe za celu aplikaciju.

---

## 9. Objašnjenje src/app/ foldera

U novijim Angular projektima logika aplikacije je uglavnom organizovana u src/app/ folderu.

`app.ts`

Root komponenta aplikacije. Predstavlja osnovnu komponentu koja se prva učitava.

`app.html`

Template root komponente. Ovde se definiše HTML prikaz za App komponentu.

`app.css` / `app.scss`

Stilovi vezani za root komponentu.

`app.spec.ts`

Test fajl za root komponentu. Angular CLI automatski generiše osnovni test primer. Novi Angular CLI projekti su spremni za testiranje odmah po kreiranju.

`app.config.ts`

Mesto za centralnu konfiguraciju aplikacije, na primer providers konfiguraciju.

`app.routes.ts`

Definicija ruta aplikacije. Angular Router je zvanična biblioteka za navigaciju i uključen je podrazumevano u projekte kreirane preko Angular CLI.

---

## 10. Komunikacija sa backend-om

Angular frontend komunicira sa backend-om preko HTTP poziva ka API endpoint-ima. Angular koristi `HttpClient` iz paketa `@angular/common/http`.

Primer:

- Angular šalje GET / POST / PUT / DELETE zahtev
- .NET backend obradi zahtev
- PostgreSQL ostaje iza backend sloja

---

## 11. Sažetak

Angular 20 projekat se standardno pokreće kroz Angular CLI. Proces podrazumeva:

- instalaciju Node.js i npm
- instalaciju Angular CLI
- kreiranje projekta komandom ng new
- pokretanje aplikacije pomoću ng serve
- dalji razvoj kroz komponente, rute, servise i testove

Angular CLI automatski kreira workspace, osnovnu strukturu projekta, konfiguracione fajlove i inicijalni kod spreman za dalji razvoj.

---

## 12. Reference

[Angular Local Setup](https://angular.dev/tools/cli/setup-local)

[Angular Version Compatibility](https://angular.dev/reference/versions)

[Angular Workspace and File Structure](https://angular.dev/reference/configs/file-structure)

[Angular Workspace Configuration](https://angular.dev/reference/configs/workspace-config)

[Angular CLI `ng new`](https://angular.dev/cli/new)

[Angular Installation](https://angular.dev/installation)

[Angular Testing](https://angular.dev/guide/testing)

[Angular HTTP Client](https://angular.dev/guide/http)
