# Morzsa – termékterv

## Alapverzió

Gyors, mobilos segítség ahhoz, hogy tudd, mi van otthon és mit kell venni. Nem készletkönyvelés: nincs kötelező mennyiség- vagy lejáratvezetés az otthoni készletben.

- Kategorizált termékkatalógus, keresés, fontossági és ABC-rend.
- Egymástól független „van otthon” és bevásárlólistás jelölés.
- Egy koppintásos hozzáadás, hosszan nyomva vásárlási mennyiségválasztás.
- Kategorizált bevásárlólista, ürítés mentéssel, korábbi listák és vásárlások archívuma.
- Saját tételek, visszavonható otthoni kivétel.
- Receptötletek, kedvencek, az alap készletilleszkedés továbbra is elérhető.
- Navigáció: Készlet – kiemelt Lista – Ötletek.

## Tervezett fizetős csomag

Az alábbiak termékkövetelmények, nem a jelenlegi Pages-kiadásban működő előfizetéses funkciók. Ár és használati keret még nincs meghatározva.

| Funkció | Felhasználói élmény | Szükséges háttér |
| --- | --- | --- |
| AI-csevegés | Receptenként kérdezhető segítség, helyettesítések és elkészítési tanácsok | Bejelentkezés, szerveroldali AI, előfizetés-ellenőrzés, használati keret |
| Lista értékének becslése | Várható összeg vagy ársáv, pénznemmel, dátummal és feltételezett kiszereléssel | Megbízható, friss bolti vagy átlagáradat; mennyiségek átváltása, hiányzó árak jelzése |
| Talk to lista | A felhasználó bemondja a tételeket. Az app a katalógushoz párosítja őket, mennyiséget és egységet értelmez, az ismeretleneket saját tételként kínálja fel | Magyar beszédfelismerés, terméknév- és szinonimafeloldás, ellenőrző felület, mikrofonengedély |
| AI-javaslatok | A készlethez, kedvencekhez és felhasználói igényekhez igazodó főzési ötletek, hiányzó hozzávalók listára tétele | Készlet- és receptkontextus, étkezési preferenciák, AI-szolgáltatás |

### Bemondott lista

Példa: „Két kiló krumpli, három tej és egy mosogatószer.” Felismerés után rövid előnézet: Krumpli 2 kg; Tej 3 l (alapértelmezett egység, módosítható); Mosogatószer 1 db. A bizonytalan találatot és az új saját tételt jelölni kell. A felhasználó javíthat, majd egy művelettel hozzáadhatja a listához. A meglévő mennyiségek összeadódnak; eltérő egységeket fel kell oldani. A mikrofon használatát csak a felhasználó indítja; a hang megőrzése nem alapkövetelmény.

### Árbecslés

Az AI nem találhat ki bolti árakat hiteles árként. Az eredmény becslés: meg kell mutatni az adatok dátumát, a boltot vagy árforrást, a feltételezett kiszereléseket és azokat a tételeket, amelyekhez nincs ár. Márka, bolt és akció nélkül indokolt egy ársáv. A súlyalapú és darabos tételek eltérő kiszerelése miatt az összeg nem kasszagarancia.

## Katalógus és ikonok

A jelenlegi katalógus 667 általános terméknevet fed le, 27 kategóriában. Ez szerkesztett szupermarket-alapkínálat, nem egy adott lánc teljes vagy élő választéka. Márka- és kiszerelésváltozatokat nem sokszorozunk meg külön kártyákkal; a vásárlási egység a listán módosítható. A korábbi terméknevek megmaradnak, hogy a mentett listák tovább működjenek.

Most 139 különböző emoji segíti a felismerést. Konkrét termékhez konkrét ikon, közeli változatokhoz közös családikon tartozik. A nevek mindig látszanak; az ikon önmagában nem azonosító. A végleges vizuális irány egy saját vagy igazoltan licencelt, egységes színes SVG-készlet lehet: előbb a leggyakoribb termékek, majd a hosszú farok. Az egyforma ikonok mesterséges megkülönböztetése helyett a felismerhetőség a cél.

A készlet, archívum és kedvencek jelenleg böngészőnként, helyben tárolódnak. A fizetős csomaghoz tartós fiók és megfelelő backend szükséges; a GitHub Pages önmagában nem futtatja ezeket.
