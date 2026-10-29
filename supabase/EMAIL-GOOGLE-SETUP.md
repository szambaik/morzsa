# Emailes háztartásmeghívás és Google-belépés

## 1. A meglévő Supabase-projekt frissítése

Projekt: https://supabase.com/dashboard/project/cbgcugshwivxpaurzyqq/sql/new

Másold be a migrations/20261029_email_invitations.sql teljes tartalmát a SQL Editorba, majd Run. Meglévő projektnél a schema.sql-t ne futtasd újra. A migráció nem törli a készletet, listát, háztartásokat vagy tagságokat. Új projektben előbb schema.sql, majd ez a migráció futtatandó. A migráció újrafuttatható.

Az új rendszer email-címzett meghívásokat kezel. A korábbi kódos csatlakozás megszűnik; a régi kódokhoz új emailes meghívás kell. A már csatlakozott tagok tagsága megmarad.

## 2. Google OAuth kliens

Nyisd meg: https://console.cloud.google.com/auth/overview

Válassz vagy hozz létre projektet. A Google Auth Platform alatt töltsd ki a Branding adatokat, majd az Audience beállítást. Saját teszteléshez Testing állapot és a tesztfiókok felvétele elég; nyilvános használathoz az Audience alatt publikálni kell az alkalmazást. A Google által esetleg kért ellenőrzéseket is teljesíteni kell.

A Clients alatt hozz létre Web application OAuth klienst:

- Authorized JavaScript origins: https://szambaik.github.io
- Authorized redirect URIs: https://cbgcugshwivxpaurzyqq.supabase.co/auth/v1/callback

Csak az alap profil/email bejelentkezési jogosultságok kellenek; Gmail-levelekhez hozzáférés nem szükséges.

## 3. Supabase Google provider

Supabase → Authentication → Sign In / Providers → Google. Kapcsold be, és add meg a Google Client ID és Client Secret értékeket. A titkot kizárólag itt tárold, ne a frontendben vagy a GitHubon.

Authentication → URL Configuration:

- Site URL: https://szambaik.github.io/morzsa/
- Redirect URLs: https://szambaik.github.io/morzsa/

A Google felől a Supabase callback kapja a választ, utána a Supabase irányít vissza az appba. A Morzsa a visszakapott munkamenetet a Supabase /auth/v1/user végpontján ellenőrzi, és eltávolítja a hitelesítési adatokat a címsorból.

## 4. Kipróbálás két fiókkal

1. A tulajdonos belép, kiválasztja a háztartását, majd újra megnyitja a felső házikó menüt.
2. Beírja a másik fél email-címét, és megnyomja a Meghívás gombot.
3. A másik fél ezzel az igazolt email-címmel lép be, Google-fiókkal vagy emailes linkkel.
4. A felső háztartásgombon jelvény jelenik meg. A menüben Elfogadom / Elutasítom gombok látszanak.
5. Elfogadáskor rögtön a közös háztartás töltődik be. A személyes helyi készlet nem kerül bele.
6. Ellenőrizzétek mindkét eszközön a közös lista frissülését.

A meghívások 7 napig érvényesek. A tulajdonos látja az állapotukat, és visszavonhatja a függő meghívásokat. Az app megnyitáskor, visszatéréskor és előtérben 30 másodpercenként ellenőrzi őket. Nem küldünk meghívó emailt vagy háttérben mobil push értesítést. Új felhasználó az adott email-címmel később regisztrálva is megtalálja az érvényes meghívást.

## Ellenőrzött és még bekötendő részek

A SQL tesztek helyi PostgreSQL/PGlite környezetben ellenőrzik a jogosultságokat, igazolt emailt, elfogadást, elutasítást, lejáratot és visszavonást. A böngészős folyamat helyettesített hálózattal tesztelt. Valódi Google-belépés és két élő fiók közötti csatlakozás csak a fenti konfiguráció után ellenőrizhető.
