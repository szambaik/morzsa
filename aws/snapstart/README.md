# Elkülönített SnapStart runtime-próba

Ez a próba nem ír alkalmazásadatot, nem fér hozzá a Supabase-hez, és nem nyit
publikus végpontot. Három IAM-mal hívható Lambda azonos, kicsi SHA-256/UUID
feladatot végez: Java 21 SnapStarttal, ugyanaz a Java nélküle és Node 22.
Mindegyik 256 MB, x86_64, VPC és Provisioned Concurrency nélkül, hét napos
naplómegőrzéssel. A két Java funkció ugyanazt az artefaktumot használja.

A próba a futtatókörnyezet alapadatait adja; nem modellezi a teljes Morzsa
auth/DB/AI terhelést. Az üzleti API runtime-választásához utóbb azt is mérni kell.

## Helyi ellenőrzés, AWS és költség nélkül

Node 22+, JDK 21+, jar és zip kell, Maven/framework nem. A repo gyökeréből:

~~~sh
node aws/snapstart/build.mjs
node --test aws/snapstart/test/*.test.mjs
javac --release 21 -cp aws/snapstart/build/classes -d aws/snapstart/build/test-classes aws/snapstart/test/ProbeTest.java
java -cp aws/snapstart/build/classes:aws/snapstart/build/test-classes morzsa.aws.ProbeTest
~~~

## AWS telepítés

AWS CLI v2, kész helyi profil és külön pilot deployment bucket kell. A profil,
bucket és account helyettesítők, nem titkok. Az aws sts get-caller-identity
paranccsal előbb ellenőrizd a fiókot. A deployment bucket legyen eu-north-1
régióban, publikus hozzáférés tiltásával és titkosítással. A telepítés már
AWS-erőforrást és mért használatot hoz létre.

~~~sh
aws cloudformation package --template-file aws/snapstart/build/template.json --s3-bucket DEPLOYMENT_BUCKET --output-template-file aws/snapstart/build/packaged.json --region eu-north-1 --profile AWS_PROFILE
aws cloudformation deploy --template-file aws/snapstart/build/packaged.json --stack-name morzsa-snapstart-pilot --capabilities CAPABILITY_IAM --region eu-north-1 --profile AWS_PROFILE
node aws/snapstart/benchmark.mjs morzsa-snapstart-pilot AWS_PROFILE
~~~

A benchmark 45 validált meghívást végez, ellenőrzi a tartalmat és az egyedi
kérésszintű nonce-okat. Csak a megadott saját stack probe aliasait hívja.
Az első, szekvenciális és burst mintákból a Lambda riportban ténylegesen
megfigyelt Init Duration / Restore Duration kerül a jelentésbe. A burst
nem garantál cold startot; null mérést nem nevezünk 0 ms cold startnak.
A CLI teljes ideje kliensindítást és hálózatot is tartalmaz. Nyers naplót nem
mentünk a jelentésbe. A jelentés a próbához tartozó ignorált build/ mappába kerül.

Megismételt build friss published versionöket hoz létre. A SnapStart snapshot
publikálásakor várni kell a készenlétre; a benchmark ellenőrzi az On állapotot.

Takarítás a mérés után:

~~~sh
aws cloudformation delete-stack --stack-name morzsa-snapstart-pilot --region eu-north-1 --profile AWS_PROFILE
aws cloudformation wait stack-delete-complete --stack-name morzsa-snapstart-pilot --region eu-north-1 --profile AWS_PROFILE
~~~

A stack törlése a saját három funkciót, aliasokat, verziókat és naplócsoportokat
törli. A deployment bucket és artefaktumai külön maradnak meg.

## Ár és korlát

A támogatott Java managed runtime SnapStartjához a jelenlegi dokumentáció
szerint nincs külön SnapStart-díj. Ettől a Lambda requests/duration, a logs és
az artefaktum tárolása még mért szolgáltatás. Python/.NET SnapStart külön
snapshot/restore díját nem vetítjük rá a Java-próbára. Nem használunk fizetős
Provisioned Concurrencyt vagy mesterséges, folyamatos warm-up pingeket.

Források: https://docs.aws.amazon.com/lambda/latest/dg/snapstart.html és
https://aws.amazon.com/lambda/pricing/ – ellenőrizve 2026-11-18.
