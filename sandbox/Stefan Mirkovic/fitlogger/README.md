# FitLogger 💪

Fitness workout tracker aplikacija sa .NET 8 backendom, Angular 17 frontendom, PostgreSQL bazom.

## Arhitektura

```
fitlogger/
├── backend/FitLogger/        .NET 8 Web API
└──frontend/                 Angular 17
```

## Pokretanje

### 1. PostgreSQL

Kreiraj bazu:
```sql
CREATE DATABASE fitlogger;
```

### 2. Backend (.NET 8)

```bash
cd backend/FitLogger
# Izmeni appsettings.json — upiši DB lozinku i JWT ključ
dotnet restore
dotnet ef migrations add InitialCreate
dotnet ef database update
dotnet run
```

API radi na: http://localhost:5000  
Swagger: http://localhost:5000/swagger

### 3. Frontend (Angular 17)

```bash
cd frontend
npm install
ng serve
```

Frontend radi na: http://localhost:4200

### 4. MCP Server

```bash
cd mcp-server
npm install
cp .env.example .env   # ili izmeni .env direktno
npm start
```

## Podrazumevani admin nalog

```
Email:    admin@fitlogger.com
Lozinka:  Admin123!
```

## API endpointi

| Metoda | Ruta                    | Opis                    | Auth       |
|--------|-------------------------|-------------------------|------------|
| POST   | /api/auth/register      | Registracija            | —          |
| POST   | /api/auth/login         | Login (vraća JWT)       | —          |
| GET    | /api/workouts           | Lista treninga          | User       |
| POST   | /api/workouts           | Kreiraj trening         | User       |
| DELETE | /api/workouts/{id}      | Obriši trening          | User       |
| GET    | /api/workouts/stats     | Statistike              | User       |
| GET    | /api/exercises          | Katalog vežbi           | —          |
| POST   | /api/exercises          | Dodaj vežbu             | Admin      |
| DELETE | /api/exercises/{id}     | Obriši vežbu            | Admin      |
| GET    | /api/bodystats          | Lista merenja težine    | User       |
| POST   | /api/bodystats          | Dodaj merenje           | User       |
| GET    | /api/admin/users        | Lista korisnika         | Admin      |
| DELETE | /api/admin/users/{id}   | Obriši korisnika        | Admin      |
| GET    | /api/admin/stats        | Sistemske statistike    | Admin      |

## MCP alati

| Alat                  | Opis                                          |
|-----------------------|-----------------------------------------------|
| `get_workout_history` | Istorija treninga za korisnika                |
| `get_user_stats`      | Statistike (mišićne grupe, max težine...)     |
| `suggest_workout`     | Predlog narednog treninga                     |
| `get_exercise_catalog`| Katalog vežbi (opcioni filter po grupi)       |
| `log_exercise`        | Logovanje vežbe kroz AI                       |

## Angular rute

| Ruta                | Komponenta            | Guard      |
|---------------------|-----------------------|------------|
| /login              | LoginComponent        | guestGuard |
| /register           | RegisterComponent     | guestGuard |
| /dashboard          | DashboardComponent    | authGuard  |
| /workouts           | WorkoutLogComponent   | authGuard  |
| /workout/new        | WorkoutFormComponent  | authGuard  |
| /body-stats         | BodyStatsComponent    | authGuard  |
| /admin              | AdminDashboardComponent | adminGuard |
| /admin/users        | AdminUsersComponent   | adminGuard |
| /admin/exercises    | AdminExercisesComponent | adminGuard |

## Angular rute
```
Dalje pokretanje aplikacije je izvodljivo samo pokretanjem start.bat skripte
```