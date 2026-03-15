-- Kreiranje baze
CREATE DATABASE demo_app_db;

-- Konektuj se na bazu
\c demo_app_db

-- Kreiranje tabela
CREATE TABLE "Users" (
    "Id" SERIAL PRIMARY KEY,
    "Username" VARCHAR(50) NOT NULL UNIQUE,
    "Password" VARCHAR(100) NOT NULL,
    "Role" VARCHAR(10) NOT NULL DEFAULT 'User'
);

CREATE TABLE "Posts" (
    "Id" SERIAL PRIMARY KEY,
    "UserId" INT NOT NULL REFERENCES "Users"("Id"),
    "Title" VARCHAR(100) NOT NULL,
    "Content" TEXT NOT NULL,
    "CreatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Test podaci
INSERT INTO "Users" ("Username", "Password", "Role")
VALUES
    ('Marko', 'password123', 'User'),
    ('Jovan', 'password456', 'User'),
    ('Admin', 'adminpass', 'Admin');

INSERT INTO "Posts" ("UserId", "Title", "Content")
VALUES
    (1, 'Markov prvi post', 'Ovo je sadrzaj prvog posta Marka.'),
    (2, 'Jovanov post', 'Ovo je sadrzaj Jovanovog posta.'),
    (3, 'Admin poruka', 'Ovo je obavestenje od Admina.');