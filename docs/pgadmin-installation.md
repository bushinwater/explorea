# pgAdmin – Instalacija i podešavanja

## Table of Contents

- [Link za instalaciju](#link-za-instalaciju)
- [Instalacija .exe fajla](#instalacija-exe-fajla)
- [Navigacija aplikacije - pravimo novi server](#navigacija-aplikacije---pravimo-novi-server)
- [Rad sa bazom](#rad-sa-bazom)
- [Query Tool](#query-tool)
  - [Pravljenje nove tabele](#pravljenje-nove-tabele)
  - [Dodavanje vrednost u tabelu](#dodavanje-vrednost-u-tabelu)
  - [Prikazivanje tabele](#prikazivanje-tabele)
  - [Dodatne opcije](#dodatne-opcije)

>Moze da instaliramo pgAdmin i prilikom skidanja/instalacije postgresql-a. Gde ne bi bilo potrebe da ga skidamo posebno, ali ovde ima da pokrijemo instalaciju nevezano za postgresql.


## Link za instalaciju
>PgAdmin je besplatan IDE i dostupan je na mnogim operating system-ima. Prvo idemo na sledeci link da bi preuzeli najnoviju verziju pgAdmina. Moramo voditi racuna da je sledeci link instalacija za Windows operativni sistem.

[pgAdmin-download](https://www.pgadmin.org/download/pgadmin-4-windows/)

Vezija za neki drugi operativni sistem: [link](https://www.pgadmin.org/download/)

>Kada otvorimo stranicu trebamo da odaberemo zeljenu verziju pdAdmina. Posle toga odaberemo .exe fajl, gde ce ubrzo nakon toga da krene skinanje exe fajla na nas racunar.

## Instalacija .exe fajla

Posto skinemo .exe fajl treba da ga pokrenemo i samo idemo u korak sa samom instalacijom.

>Kada pokrenemo pgAdmin moze doci do sledece greske **The pgAdmin 4 server could not be contacted**. U tom slucaju gasimo aplikaciju i idemo u **Roaming** folder, do njega dolazimo ili preko run-a komandom %appdata% ili preko file exprorer-a (putanja C:\Users\ _nas-nalog_ \AppData\Roaming). Potom je potrebno obrisati sledeca dva foldera **pgAdmin** & **pgadmin 4**. Prilikom sledeceg pokretanja pgAdmin aplikacije ne bi trebalo da imamo problema. 

## Navigacija aplikacije - pravimo novi server

>Prilikom pokretanja aplikacije mozemo videti u Object Explorer-u drop meni pod nazivom Servers. U koliko mi imamo vec instaliran postgresql, otvaranjem drop menija ima da vidimo njegov serverm u suprotnom drop meni ima da bude prazan. Za potrebe objasnjivanja ima da pravimo poseban.

>Idemo desni klik na server pa **Register** gde se otvara novi prozor. Gde treba da stavimo ime (naprimer _Postgres Demo_) i mozemo da odaberemo grupu. Potrebno je i pod tabom **Connections** staviti adresu, ako imamo instaliran postgres mozemo samo staviti localhost. Postoji i opcija da stavimo i sifru za nas server. Posle toga idemo na **Save** gde smo mi uspesno kreirali novi server.

## Rad sa bazom

>Prvobitno nama ce sve opcije za SQL biti onemogucene, gde je potrebno selektovati bazu. Idemo na drop meni DataBases gde ce nasa lista prvom pokretanju imati samo defaultnu bazu pod nazivom **postgres**. U slucaju da nam se ne pojavljuje ni jedna baza, desnim klinom idemo na **create > database**. 


## Query Tool
### Pravljenje nove tabele
>Kada selektujemo bazu sve opcije za SQL ce nam biti omogucene za rad. Prvo ima da pregledamo alatku **Query Tool** gde ce klikom na nju da nam se otvori novi prozor.
Bice nam prvobitno otvoreno dva glavna panela Query i Messages. U panel pod nazivom Query ima da kucamo nas SQL kod koji ima da pokrecemo na klikom na dugme **Execute script** ili pritiskom na **F5** dugme na tastaturi.

```
CREATE TABLE pgtest(
testval VARCHAR(10)
);
```
>Kada unesemo ovaj kod i klikom na pokretanje skripte u panelu messages treba da nam pise poruka  
"CREATE TABLE Query returned successfully in X msec."

### Dodavanje vrednost u tabelu

>Pisanjem sledeceg koda ima da unesemo vrednost uzeljenu tabelu.

```
INSERT INTO pgtest (testval)
VALUES ("Hello");
```
>Ako ne zelimo da pokrecemo celu skriptu mozemo samo da slektujemo zelenje linije koda koje zelimo da izvrsimo. Gde bi se pritiskom na dugme F5 pokrenule samo selektovane komande.

### Prikazivanje tabele
>Pisanjem sledeceg koda u panelu **Data output** ima da nam se prikaze nasa tabela sa pretodno dodatom vrednoscu.

```
SELECT *
FROM pgtest
```
> Ukoliko nas zeljeni rezultat zelimo da sacuvamo kao CSV fajl, to mozemo veoma lako uraditi klikom na dugme **Save results to file** ili pritisnom na dugme **F8**. 

### Dodatne opcije

>Takođe možeš sačuvati SQL queries koje si napisao. Klikni na Save File dugme na toolbar-u. Unesi filename i izaberi lokaciju. Nakon što klikneš Save, fajl će biti sačuvan i naslov taba će se promeniti u ime fajla. Ako želiš da otvoriš ranije sačuvan fajl, klikni Open dugme, pronađi fajl i otvori ga. Pored Save dugmeta nalazi se Edit dugme. Ovde ima više opcija.Može pronaći vrednost u skripti, zameniti vrednosti, skočiti na određeni red, uvlačiti ili ukloniti uvlačenje koda, dodati ili ukloniti komentar, promeniti velika i mala slova, obrisati query editor ili formatirati SQL. Format SQL opcija čini query lakšim za čitanje tako što razdvaja delove na nove redove i pretvara keywords u velika slova.