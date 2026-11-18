# Morzsa – önálló AWS backend, a Supabase út megtartásával

Elfogadott irány, 2026-11-18: az AWS teljes alternatív backend lesz. Nem a
Supabase Edge Functions másik futtatója. Az AWS út bejelentkezése, adatbázisa,
jogosultságkezelése, szinkronja, képtárolása és AI-funkciói nem függhetnek a
Supabase működésétől. A jelenlegi Supabase-kód és konfiguráció megmarad.

A havi infrastruktúra-keret legfeljebb 15 EUR, AI-díjak nélkül. A felhasználó
az új AWS experience-t használja, kiválasztott régiója eu-north-1, CLI-profilja
morzsa, magyarázati szintje MEDIUM. A szolgáltatások saját ingyenes keretét az induló kredittől külön
számoljuk. A korábbi Lightsail és Supabase-funkciókat futtató AWS változatok
nem az elfogadott cél.

## A két teljes út közötti határ

| Terület | Meglévő út | Önálló AWS út |
| --- | --- | --- |
| Bejelentkezés | Supabase Auth | Cognito, weben és iOS-en PKCE |
| Háztartási adatok és tagság | PostgreSQL + RLS + RPC | DynamoDB + szerveroldali hozzáférés és tranzakciók |
| Előzmények, receptek és preferenciák | PostgreSQL | AWS-adatmodell, változatlan alkalmazás-UUID-kkal |
| Közös szinkron | Supabase Realtime | AWS WebSocket értesítés vagy mért, aktív képernyős polling |
| Recept-, lépés- és chat-képek | Supabase Storage | S3, privát URL-ek és publikus CDN-cache |
| AI és hang | Supabase Edge Functions | Lambda, aszinkron munkákhoz SQS + webhook |
| Kliens | Jelenlegi adapter | Új, külön AWS-adapter és fiókhoz kötött cache |

Az AWS-adaptert additívan kapcsoljuk be. Nem cseréljük ki a jelenlegi
household.js, household-live.js, Auth és Edge Function implementációkat.
Szolgáltatót csak kifejezett választás és ellenőrzött állapotátadás után
váltunk; nem irányítunk át automatikusan sikertelen írást másik adatbázisba.

A tartalmi rekordformátumok, tombstone-ok, revisionök, alkalmazás-azonosítók,
server-confirmed nyugták és idempotens műveletek megmaradnak. A Cognito sub
nem cseréli le a régi alkalmazás-user UUID-t; explicit megfeleltetés kell.
Helyi morzsa-v1/morzsa-v2 mentést nem törlünk és nem importálunk csendben
közös háztartásba. A privát előzmények nem válnak automatikusan megosztottá.

## Futás és cold start

- Régió: eu-north-1; VPC/NAT nélküli Lambdák az induló felállásban.
- Külön kis csomag a gyakori adat-API-nak és az AI/hang útvonalnak. Képfeldolgozó
  és modellfüggőségeket nem töltünk be a készlet/lista kérésekhez.
- A meglévő tiszta JavaScript üzleti segédek használhatók az új AWS-úton is,
  de a Supabase-függő auth/DB/storage részeket külön adapter váltja fel.
- Az AI-streaminghez ellenőrzött Lambda response-streaming út kell; a hosszú
  generálást nem feltételezett HTTP API időkorláton vagy stream-támogatáson át futtatjuk.
- CloudFront Functions: publikus képek URL-je, fejlécei és cache-szabályai.
  Ezek nem végeznek hálózati auth/DB/AI-hívást, és nem látnak request body-t.
  A személyes és háztartási API-válaszokat nem tesszük közös CDN-cache-be.
- Kérésszintű UUID, időbélyeg és jogosultság nem kerülhet snapshotba. Connection
  és credential cache esetén a restore utáni frissítést ellenőrizni kell.

### SnapStart próba

A snapstart/ külön, adatot nem kezelő runtime-próba. Ugyanazt a Java handlert
SnapStarttal és anélkül, valamint egy minimális Node handlert hasonlít össze.
Ez még nem az alkalmazás backendje.

A támogatott managed runtime-ok Java 11+, Python 3.12+ és .NET 8+.
Node.js nem támogatott. A támogatott Java managed runtime SnapStartjához nincs
külön SnapStart-díj; Python/.NET esetén snapshot-cache és restore díj is van.
Provisioned Concurrency nem használható ugyanazon funkción SnapStarttal.
SnapStart published versionhöz kell, nem $LATEST-hez; a próba aliasra irányul.

Nem váltunk Java-ra minden funkciót pusztán a próba miatt. Döntési pont: a
teljes API-val mért indulás, p95 késleltetés, csomagméret, karbantartás és
regionális költség. A minimális próba csak a runtime alapadatait adja.

## Mi kell a telepítéshez

1. Kész AWS-projekt és helyi AWS CLI bejelentkezés, lehetőleg ideiglenes/SSO
   hozzáféréssel. A profil neve és a nem titkos account ID elég a konfiguráció
   kiválasztásához; access key, session token, root-jelszó nem kell chatbe.
2. Az induló, külön pilot környezethez Lambda, IAM, CloudFormation,
   CloudWatch, S3 jogosultságok; a teljes backendhez Cognito, DynamoDB, SQS és
   API Gateway, később CloudFront is. A runtime-szerepek külön, szűk jogúak.
3. A választott AI-szolgáltatók meglévő kulcsai biztonságos AWS secret-tárolóba
   kerüljenek. Csak a ténylegesen használt fal.ai/OpenAI/Groq/Gemini/Cloudflare
   integrációkhoz kell kulcs. Supabase service-role key az önálló AWS
   runtime-nak nem kell; exporthoz szükséges hozzáférés külön migrációs eszközé.
4. A jelenlegi Google-belépés megtartásához OAuth-kliens és redirect
   konfiguráció Cognitóhoz. A repo publikus originje és iOS callbackje ismert;
   új domain nem előfeltétel az első pilothoz.

Az AWS CLI v2 telepítve van, a morzsa profil eu-north-1 régióval létrejött.
A böngészős belépés és az STS-hozzáférés ellenőrzése sikeres. Az Agent Toolkit
25 alap skillt telepített; a távoli katalógus 126 skillje elérhető. Az AWS MCP
a morzsa profilra van állítva. Az új MCP-eszközök betöltéséhez új Codex-session
kell; a skillfrissítő hook bizalmi lépését a telepítő külön jelzi. A részletes,
titkokat nem tartalmazó telepítési állapot a TOOLKIT-SETUP.md fájlban található.
Az új AWS experience-ben a regionális erőforrásokat kizárólag a kiválasztott
régióba telepítjük; Lambda@Edge és több régiós StackSets nem része a tervnek.
Az Agent Toolkit konfigurációs szolgáltatása külön, us-east-1-ben érhető el.

## Sorrend és élesíthetőség

1. Elkülönített runtime-mérés, költségellenőrzés.
2. AWS teljes infrastruktúra és új adapter, szintetikus háztartásokkal.
3. Az összes meglévő SQL/RPC viselkedés és adatmodell átültetése. DynamoDB-ben
   a legfeljebb 100 műveletes tranzakció és a régi 3000 elemes atomic batch
   közötti eltérést is meg kell oldani a produkciós bekapcsolás előtt.
4. Fiókhoz kötött offline cache, biztonságos outbox, két kliens párhuzamos
   írása, tagság-visszavonás, privát chat, képcache és ismételt műveletek.
5. Teljes, ellenőrzött export/import: UUID, checksum, revision, objektumok,
   tagságok és auth. Cognito-jelszóátvitel nem feltételezhető automatikusan.
6. Egyetlen éles írási forrás, végső delta, valódi web/iOS ellenőrzés és
   rollback-próba az új írások megőrzésével. Supabase-kód ekkor is megmarad.
7. A Supabase szolgáltatás kikapcsolása külön, későbbi lépés.

AWS-alkalmazásbackend és éles adatátállás még nem készült el. A runtime-próba
sikere nem bizonyítja az alkalmazás jogosultságait, szinkronját vagy migrációját.
Publikálásnál megmarad az origin/main merge és a teljes audit release gate.

## Források, ellenőrizve 2026-11-18

- https://aws.amazon.com/free/
- https://aws.amazon.com/lambda/pricing/
- https://docs.aws.amazon.com/lambda/latest/dg/snapstart.html
- https://docs.aws.amazon.com/lambda/latest/dg/provisioned-concurrency.html
- https://docs.aws.amazon.com/lambda/latest/dg/java-handler.html
- https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cloudfront-function-restrictions.html
