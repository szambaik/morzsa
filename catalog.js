const catalogGroups = [
['Zöldségek','🥕','Paprika|Paradicsom|Krumpli|Hagyma|Fokhagyma|Lilahagyma|Újhagyma|Póréhagyma|Sárgarépa|Fehérrépa|Zeller|Karalábé|Cékla|Uborka|Cukkini|Padlizsán|Brokkoli|Karfiol|Fejes káposzta|Lila káposzta|Kelkáposzta|Kelbimbó|Spenót|Sóska|Saláta|Rukkola|Gomba|Édesburgonya|Sütőtök|Retek|Zöldbab|Spárga|Chili|Kukorica|Borsó'],
['Gyümölcsök','🍑','Barack|Alma|Körte|Banán|Narancs|Mandarin|Citrom|Lime|Grapefruit|Szilva|Szőlő|Eper|Málna|Áfonya|Szeder|Cseresznye|Meggy|Ananász|Mangó|Kiwi|Avokádó|Görögdinnye|Sárgadinnye|Gránátalma'],
['Hús és felvágott','🍗','Csirkecomb|Csirkemell|Csirkeszárny|Egész csirke|Pulykamell|Sertéskaraj|Sertéstarja|Sertéscomb|Sertésszűz|Darált sertéshús|Darált marhahús|Marhapörkölt-hús|Marhasteak|Kacsa|Csirkemáj|Csirkemellsonka|Sonka|Szalonna|Bacon|Kolbász|Szalámi|Virsli|Párizsi|Májkrém'],
['Hal és tengeri','🐟','Hal|Lazac|Tőkehal|Hekk|Pisztráng|Ponty|Tonhalkonzerv|Szardíniakonzerv|Garnéla|Kagyló|Halrudacska'],
['Tejtermék és tojás','🥛','Tojás|Tej|Vaj|Tejszín|Joghurt|Görög joghurt|Tejföl|Kefir|Túró|Sajtkrém|Sajt|Trappista|Cheddar|Mozzarella|Parmezán|Feta|Camembert|Mascarpone|Ricotta|Krémtúró|Író|Laktózmentes tej'],
['Növényi alapok','🌱','Tofu|Füstölt tofu|Tempeh|Hummusz|Zabital|Mandulaital|Szójaital|Kókusztej|Növényi tejszín|Növényi joghurt|Vegán sajt|Seitan'],
['Pékáru','🍞','Kenyér|Teljes kiőrlésű kenyér|Toastkenyér|Zsemle|Kifli|Bagett|Ciabatta|Pita|Tortillalap|Croissant|Kalács|Kétszersült|Pászka'],
['Rizs és tészta','🍚','Rizs|Jázminrizs|Basmati rizs|Barna rizs|Rizottórizs|Tészta|Spagetti|Penne|Fusilli|Tagliatelle|Lasagnelap|Tarhonya|Rizstészta|Üvegtészta|Kuszkusz|Bulgur|Quinoa|Köles|Hajdina|Árpagyöngy|Gnocchi'],
['Konzervek és hüvelyesek','🥫','Konzerv gomba|Babkonzerv|Csicseriborsó-konzerv|Lencsekonzerv|Kukoricakonzerv|Paradicsomkonzerv|Passata|Sűrített paradicsom|Fehér bab|Vörös bab|Száraz csicseriborsó|Lencse|Vörös lencse|Sárgaborsó|Csemegeuborka|Olívabogyó|Savanyú káposzta|Cékla savanyúság|Befőtt'],
['Fagyasztott','🧊','Zöldségkeverék|Mirelit zöldség|Mirelit borsó|Mirelit brokkoli|Mirelit spenót|Mirelit zöldbab|Mirelit kukorica|Mirelit gyümölcs|Mirelit hasábburgonya|Leveles tészta|Pizza|Fagylalt|Jégkocka'],
['Szószok és olajok','🫙','Olaj|Olívaolaj|Kókuszolaj|Szezámolaj|Sertészsír|Majonéz|Mustár|Ketchup|Piros Arany|Szójaszósz|Worcestershire-szósz|Csípős szósz|Pesto|Tahini|Barbecue-szósz|Almaecet|Ételecet|Balzsamecet|Málnás balzsamecet|Méz|Baracklekvár|Eperlekvár|Szilvalekvár|Mogyoróvaj'],
['Fűszerek','🌿','Só|Bors|Pirospaprika|Füstölt paprika|Chilipehely|Fokhagymasó|Delikát|Csirkeleveskocka|Zöldségleveskocka|Marhaleveskocka|Babérlevél|Bazsalikom|Majoranna|Szárított petrezselyem|Oregánó|Kakukkfű|Rozmaring|Kapor|Koriander|Kömény|Római kömény|Curry|Kurkuma|Gyömbér|Fahéj|Szerecsendió|Szegfűszeg|Vanília|Fűszerkeverék'],
['Sütés és édesség','🧁','Liszt|Teljes kiőrlésű liszt|Rétesliszt|Rizsliszt|Mandulaliszt|Búzadara|Zsemlemorzsa|Keményítő|Sütőpor|Szódabikarbóna|Élesztő|Szárított élesztő|Cukor|Barna cukor|Porcukor|Vaníliás cukor|Édesítőszer|Kakaópor|Puding|Étcsokoládé|Tejcsokoládé|Fehér csokoládé|Kókuszreszelék|Dió|Mandula|Mogyoró|Mák|Mazsola|Zselatin|Babapiskóta|Keksz'],
['Reggeli és rágcsálnivaló','🥣','Zabpehely|Müzli|Granola|Kukoricapehely|Chiamag|Lenmag|Tökmag|Napraforgómag|Szezámmag|Aszalt gyümölcs|Datolya|Chips|Sós keksz|Pattogatott kukorica|Mogyorókrém'],
['Italok','☕','Víz|Szénsavas víz|Gyümölcslé|Narancslé|Almalé|Szörp|Tea|Kávé|Kakaóital|Üdítő|Sör|Bor'],
['Háztartás','🧽','Mosogatószer|Mosogatógép-tabletta|Szivacs|Papírtörlő|Szemeteszsák|Alufólia|Sütőpapír|Frissentartó fólia|Fagyasztózacskó|Szalvéta|WC-papír|Mosószer|Öblítő|Tisztítószer|Folyékony szappan']
];
const foodIcons={'Tojás':'🥚','Vaj':'🧈','Sajt':'🧀','Sajtkrém':'🧀','Paprika':'🫑','Paradicsom':'🍅','Krumpli':'🥔','Hagyma':'🧅','Fokhagyma':'🧄','Brokkoli':'🥦','Gomba':'🍄','Konzerv gomba':'🍄','Szalonna':'🥓','Barack':'🍑','Alma':'🍎','Banán':'🍌','Citrom':'🍋','Tészta':'🍝','Spagetti':'🍝'};
Object.assign(foodIcons,{
'Sárgarépa':'🥕','Uborka':'🥒','Padlizsán':'🍆','Cukkini':'🥒','Kukorica':'🌽','Borsó':'🫛','Mirelit borsó':'🫛','Zöldbab':'🫛','Édesburgonya':'🍠','Sütőtök':'🎃','Saláta':'🥬','Spenót':'🥬','Chili':'🌶️',
'Körte':'🍐','Lime':'🍋‍🟩','Narancs':'🍊','Mandarin':'🍊','Szőlő':'🍇','Eper':'🍓','Áfonya':'🫐','Cseresznye':'🍒','Meggy':'🍒','Ananász':'🍍','Mangó':'🥭','Kiwi':'🥝','Avokádó':'🥑','Görögdinnye':'🍉','Sárgadinnye':'🍈',
'Csirkecomb':'🍗','Csirkemell':'🐔','Csirkeszárny':'🍗','Egész csirke':'🐔','Pulykamell':'🦃','Sertéskaraj':'🐖','Sertéstarja':'🐖','Sertéscomb':'🍖','Marhasteak':'🥩','Darált marhahús':'🥩','Kacsa':'🦆','Virsli':'🌭','Kolbász':'🌭','Csirkemellsonka':'🍖','Sonka':'🍖','Bacon':'🥓',
'Garnéla':'🦐','Kagyló':'🦪','Halrudacska':'🐠','Tej':'🥛','Tejszín':'🥛','Joghurt':'🥣','Tejföl':'🥣','Túró':'🧀','Tofu':'⬜','Hummusz':'🫘','Kókusztej':'🥥','Kenyér':'🍞','Zsemle':'🥯','Kifli':'🥖','Bagett':'🥖','Croissant':'🥐','Pita':'🫓','Tortillalap':'🫓','Kalács':'🍞',
'Babkonzerv':'🫘','Fehér bab':'🫘','Vörös bab':'🫘','Lencse':'🫘','Kukoricakonzerv':'🌽','Paradicsomkonzerv':'🍅','Passata':'🍅','Olívabogyó':'🫒','Pizza':'🍕','Fagylalt':'🍨','Jégkocka':'🧊','Mirelit hasábburgonya':'🍟',
'Olaj':'🫗','Olívaolaj':'🫒','Kókuszolaj':'🥥','Méz':'🍯','Piros Arany':'🌶️','Ketchup':'🍅','Almaecet':'🍎','Só':'🧂','Bors':'⚫','Pirospaprika':'🌶️','Gyömbér':'🫚','Fahéj':'🪵','Babérlevél':'🍃',
'Liszt':'🌾','Búzadara':'🌾','Zsemlemorzsa':'🍞','Puding':'🍮','Kakaópor':'🍫','Étcsokoládé':'🍫','Tejcsokoládé':'🍫','Kókuszreszelék':'🥥','Dió':'🌰','Mandula':'🌰','Mogyoró':'🥜','Keksz':'🍪','Babapiskóta':'🍪','Mogyoróvaj':'🥜','Zabpehely':'🌾','Müzli':'🥣','Pattogatott kukorica':'🍿','Chips':'🍟',
'Víz':'💧','Szénsavas víz':'🫧','Gyümölcslé':'🧃','Narancslé':'🍊','Almalé':'🍎','Tea':'🍵','Kávé':'☕','Sör':'🍺','Bor':'🍷','Üdítő':'🥤','Szörp':'🍹',
'Mosogatószer':'🫧','Szivacs':'🧽','Papírtörlő':'🧻','WC-papír':'🧻','Szemeteszsák':'🗑️','Alufólia':'🥡','Sütőpapír':'📜','Szalvéta':'📄','Mosószer':'🧴','Öblítő':'🧴','Folyékony szappan':'🧼','Tisztítószer':'🧹'
});
// Generic supermarket staples; existing names remain stable for saved lists.
const catalogAdditions={
'Zöldségek':'Jégsaláta|Madársaláta|Koktélparadicsom|TV paprika|Kápia paprika|Csípős paprika|Újkrumpli|Friss petrezselyem|Friss bazsalikom|Friss kapor|Friss menta|Édeskömény|Torma|Csíra',
'Gyümölcsök':'Nektarin|Sárgabarack|Őszibarack|Kókuszdió|Füge|Datolyaszilva|Pomelo',
'Hús és felvágott':'Darált pulykahús|Sertésoldalas|Sertéslapocka|Marhalábszár|Leveshús|Pulykacomb|Libacomb|Kacsamell|Sertésmáj|Disznósajt|Kenőmájas|Füstölt csülök|Debreceni|Pulykasonka',
'Hal és tengeri':'Makréla|Szardínia|Harcsa|Tintahal|Füstölt lazac|Halkrém',
'Tejtermék és tojás':'Laktózmentes tejföl|Laktózmentes joghurt|Laktózmentes túró|Laktózmentes sajt|Gyümölcsjoghurt|Natúr joghurt|Ivójoghurt|Skyr|Gouda|Edami|Ementáli|Füstölt sajt|Reszelt sajt|Lapsajt|Kecskesajt|Juhtúró|Sűrített tej|Habtejszín|Főzőtejszín|Margarin',
'Növényi alapok':'Rizsital|Kókuszital|Növényi vaj|Növényi tejföl|Vegán felvágott|Növényi burger|Szójagranulátum',
'Pékáru':'Rozskenyér|Kovászos kenyér|Magvas kenyér|Gluténmentes kenyér|Gluténmentes zsemle|Hamburgerzsemle|Hotdogkifli|Pogácsa|Kakaós csiga|Túrós táska|Fánk|Rétes|Briós|Sajtos rúd',
'Rizs és tészta':'Levestészta|Cérnametélt|Orsótészta|Száraztészta tojás nélkül|Teljes kiőrlésű tészta|Gluténmentes tészta|Instant tészta|Tortellini|Ravioli|Polenta',
'Konzervek és hüvelyesek':'Zöldborsókonzerv|Fehérbab-konzerv|Chilis bab konzerv|Lecsókonzerv|Sóskakrém|Savanyú paprika|Csalamádé|Kovászos uborka|Kapribogyó|Aszalt paradicsom|Ananászkonzerv|Őszibarackbefőtt|Meggybefőtt',
'Fagyasztott':'Mirelit eper|Mirelit málna|Mirelit meggy|Mirelit karfiol|Mirelit gomba|Mirelit leveszöldség|Mirelit halfilé|Mirelit csirkefalatok|Mirelit rántott sajt|Mirelit krokett|Mirelit pogácsa|Mirelit szilvás gombóc|Mirelit derelye|Mirelit pizza|Jégkrém',
'Szószok és olajok':'Repceolaj|Tökmagolaj|Rizsecet|Fehérborecet|Dijoni mustár|Tormakrém|Tartármártás|Salátaöntet|Édes chiliszósz|Teriyaki szósz|Halszósz|Paradicsomos tésztaszósz|Bolognai szósz|Ajvár',
'Fűszerek':'Fehér bors|Egész bors|Fokhagymapor|Vöröshagymapor|Mustármag|Sáfrány|Csillagánizs|Kardamom|Szegfűbors|Szárított kapor|Provence-i fűszerkeverék|Grillfűszer|Mézeskalács-fűszerkeverék',
'Sütés és édesség':'Kukoricaliszt|Zabliszt|Gluténmentes lisztkeverék|Sütőcsokoládé|Tortabevonó|Habfixáló|Tortazselé|Vaníliaaroma|Citromlé|Citromhéj|Sütőrum|Marcipán|Ételfesték|Leveles tésztalap|Réteslap|Piskótalap',
'Reggeli és rágcsálnivaló':'Instant zabkása|Kölesgolyó|Rizsszelet|Abonett|Puffasztott kukorica|Korpapehely|Fehérjeszelet',
'Italok':'Szénsavmentes ásványvíz|Szénsavas ásványvíz|Ízesített víz|Jeges tea|Kóla|Tonik|Energiaital|Izotóniás ital|Paradicsomlé|Smoothie|Forrócsoki-por|Szálas tea|Gyógytea|Gyümölcstea|Zöld tea|Szemes kávé|Őrölt kávé|Instant kávé|Kávékapszula|Koffeinmentes kávé'
};
for(const [category,names] of Object.entries(catalogAdditions))catalogGroups.find(g=>g[0]===category)[2]+='|'+names;
// Split broad aisles into categories that remain quick to scan on a phone.
function moveProducts(category,emoji,names){
 const products=names.split('|');
 for(const group of catalogGroups)group[2]=group[2].split('|').filter(n=>!products.includes(n)).join('|');
 catalogGroups.push([category,emoji,names]);
}
moveProducts('Édességek','🍫','Étcsokoládé|Tejcsokoládé|Fehér csokoládé|Keksz|Babapiskóta|Mogyorókrém|Túró Rudi|Csokiszelet|Bonbon|Nápolyi|Gumicukor|Cukorka|Nyalóka|Rágógumi|Müzliszelet|Piskótaszelet');
moveProducts('Magvak és rágcsálnivalók','🥜','Dió|Mandula|Mogyoró|Tökmag|Napraforgómag|Aszalt gyümölcs|Datolya|Chips|Sós keksz|Pattogatott kukorica|Kesudió|Pisztácia|Földimogyoró|Pekándió|Sós perec|Ropi|Tortillachips|Diákcsemege|Aszalt szilva|Aszalt sárgabarack');
moveProducts('Lekvárok és kenhető krémek','🍯','Méz|Baracklekvár|Eperlekvár|Szilvalekvár|Mogyoróvaj|Málnalekvár|Áfonyalekvár|Meggy lekvár|Almapüré');
moveProducts('Sör, bor és szeszes italok','🍷','Sör|Bor|Alkoholmentes sör|Radler|Almabor|Vörösbor|Fehérbor|Rozé|Pezsgő|Prosecco|Vodka|Gin|Rum|Whisky|Pálinka|Likőr');
moveProducts('Takarítás és mosás','🧽','Mosogatószer|Mosogatógép-tabletta|Szivacs|Mosószer|Öblítő|Tisztítószer|Mosógél|Mosókapszula|Folteltávolító|Fehérítő|Vízlágyító|Mosogatógépsó|Öblítőszer|Ablaktisztító|Fürdőszobai tisztítószer|WC-tisztító|Vízkőoldó|Lefolyótisztító|Zsíroldó|Felmosószer|Fertőtlenítőszer|Törlőkendő|Gumikesztyű|Súrolószivacs|Mikroszálas kendő|Felmosófej|Légfrissítő');
moveProducts('Papír és konyhai kellékek','🧻','Papírtörlő|Szemeteszsák|Alufólia|Sütőpapír|Frissentartó fólia|Fagyasztózacskó|Szalvéta|WC-papír|Papír zsebkendő|Uzsonnás zacskó|Sütőzacskó|Jégkockazacskó|Muffinpapír|Fogpiszkáló|Saslikpálca|Kávéfilter|Papírpohár|Papírtányér|Ételtároló doboz|Befőttesüveg');
moveProducts('Tisztálkodás és szépségápolás','🧴','Folyékony szappan|Szappan|Tusfürdő|Sampon|Hajbalzsam|Szárazsampon|Dezodor|Izzadásgátló|Testápoló|Kézkrém|Arckrém|Arclemosó|Sminklemosó|Micellás víz|Naptej|Ajakápoló|Borotva|Borotvahab|Borotvabetét|Hajfesték|Hajlakk');
catalogGroups.push(
['Fogápolás és higiénia','🪥','Fogkrém|Fogkefe|Elektromos fogkefefej|Fogselyem|Szájvíz|Vattakorong|Fültisztító pálcika|Nedves törlőkendő|Egészségügyi betét|Tisztasági betét|Tampon|Óvszer|Sebtapasz|Kézfertőtlenítő'],
['Baba és kisgyerek','🍼','Pelenka|Úszópelenka|Babatörlőkendő|Popsikrém|Babafürdető|Babasampon|Babaolaj|Tápszer|Bébiétel|Babakása|Babakeksz|Gyümölcspüré tasak|Cumisüveg|Cumi'],
['Állateledel és kellékek','🐾','Száraz kutyaeledel|Nedves kutyaeledel|Száraz macskaeledel|Nedves macskaeledel|Kutya jutalomfalat|Macska jutalomfalat|Macskaalom|Kutyapiszokzacskó|Rágócsont|Madáreleség|Rágcsálóeledel|Alom kisállatnak'],
['Készételek és gyors fogások','🍲','Instant leves|Leveskonzerv|Kész főzelék|Kész rizses étel|Kész tésztaétel|Burgonyapürépor|Kész saláta|Szendvics|Sushi|Falafel|Körözött|Padlizsánkrém'],
['Otthoni apróságok','💡','Elem AA|Elem AAA|Gombelem|Izzó|Gyufa|Öngyújtó|Gyertya|Ragasztószalag|Pillanatragasztó|Szemetesvödör|Rovarirtó|Szúnyogriasztó|Cipőápoló|Varrókészlet']
);
// Remove the old empty catch-all; names and stored cart entries stay compatible.
for(let i=catalogGroups.length-1;i>=0;i--)if(!catalogGroups[i][2])catalogGroups.splice(i,1);
const nonFoodCategories=new Set(['Háztartás','Takarítás és mosás','Papír és konyhai kellékek','Tisztálkodás és szépségápolás','Fogápolás és higiénia','Baba és kisgyerek','Állateledel és kellékek','Otthoni apróságok']);
const iconFamilies={
'🧀':'Trappista|Cheddar|Mozzarella|Parmezán|Feta|Camembert|Mascarpone|Ricotta|Krémtúró|Gouda|Edami|Ementáli|Füstölt sajt|Reszelt sajt|Lapsajt|Kecskesajt|Juhtúró|Laktózmentes túró|Laktózmentes sajt',
'🥣':'Bébiétel|Babakása|Görög joghurt|Natúr joghurt|Gyümölcsjoghurt|Skyr|Kefir|Növényi joghurt|Laktózmentes joghurt|Laktózmentes tejföl',
'🥛':'Laktózmentes tej|Író|Ivójoghurt|Sűrített tej|Habtejszín|Főzőtejszín',
'🍅':'Koktélparadicsom|Sűrített paradicsom|Paradicsomos tésztaszósz|Bolognai szósz|Paradicsomlé',
'🫑':'TV paprika|Kápia paprika|Savanyú paprika','🌶️':'Csípős paprika|Chilipehely|Füstölt paprika|Édes chiliszósz|Ajvár',
'🥬':'Jégsaláta|Madársaláta|Rukkola|Sóska|Kelkáposzta|Fejes káposzta|Lila káposzta|Savanyú káposzta|Mirelit spenót',
'🌿':'Friss bazsalikom|Friss petrezselyem|Friss kapor|Friss menta|Csíra',
'🥔':'Újkrumpli|Burgonyapürépor','🧅':'Lilahagyma|Újhagyma|Póréhagyma','🍑':'Nektarin|Sárgabarack|Őszibarack|Őszibarackbefőtt',
'🐟':'Lazac|Tőkehal|Hekk|Pisztráng|Ponty|Tonhalkonzerv|Szardíniakonzerv|Makréla|Szardínia|Harcsa|Füstölt lazac|Halkrém|Mirelit halfilé','🦑':'Tintahal',
'🦆':'Kacsamell|Libacomb','🦃':'Darált pulykahús|Pulykacomb|Pulykasonka','🥩':'Sertésszűz|Darált sertéshús|Marhapörkölt-hús|Marhalábszár|Leveshús|Sertésoldalas|Sertéslapocka',
'🥐':'Briós','🍩':'Fánk','🍔':'Hamburgerzsemle|Növényi burger','🥖':'Hotdogkifli|Ciabatta|Sajtos rúd','🍞':'Rozskenyér|Kovászos kenyér|Magvas kenyér|Gluténmentes kenyér|Teljes kiőrlésű kenyér|Toastkenyér|Kétszersült','🥯':'Gluténmentes zsemle|Pogácsa',
'🍝':'Penne|Fusilli|Tagliatelle|Lasagnelap|Rizstészta|Üvegtészta|Gnocchi|Levestészta|Cérnametélt|Orsótészta|Száraztészta tojás nélkül|Teljes kiőrlésű tészta|Gluténmentes tészta|Tortellini|Ravioli','🍜':'Instant tészta',
'🫘':'Csicseriborsó-konzerv|Lencsekonzerv|Száraz csicseriborsó|Vörös lencse|Sárgaborsó|Fehérbab-konzerv|Chilis bab konzerv','🫛':'Zöldborsókonzerv|Mirelit zöldbab','🥒':'Csemegeuborka|Kovászos uborka',
'🍓':'Mirelit eper|Eperlekvár','🍒':'Mirelit meggy|Meggybefőtt|Meggy lekvár','🍕':'Mirelit pizza','🥟':'Mirelit derelye|Mirelit szilvás gombóc','🍦':'Jégkrém',
'🧈':'Margarin|Növényi vaj|Sertészsír','🥥':'Kókuszital|Kókuszdió','🌾':'Zabital|Zabliszt|Teljes kiőrlésű liszt|Rétesliszt|Rizsliszt|Kukoricaliszt|Gluténmentes lisztkeverék',
'🍫':'Sütőcsokoládé|Tortabevonó|Csokiszelet|Bonbon|Forrócsoki-por','🍬':'Cukorka|Rágógumi|Gumicukor','🍭':'Nyalóka','🍪':'Nápolyi|Babakeksz','🥨':'Sós perec|Ropi','🥜':'Földimogyoró|Kesudió|Pisztácia|Diákcsemege','🌰':'Pekándió',
'☕':'Szemes kávé|Őrölt kávé|Instant kávé|Kávékapszula|Koffeinmentes kávé','🍵':'Szálas tea|Gyógytea|Gyümölcstea|Zöld tea','💧':'Szénsavmentes ásványvíz','🫧':'Szénsavas ásványvíz|Mosogatógépsó|Öblítőszer','🥤':'Kóla|Tonik|Energiaital|Jeges tea|Izotóniás ital','🍺':'Alkoholmentes sör|Radler','🥂':'Pezsgő|Prosecco','🥃':'Whisky|Rum|Pálinka|Likőr',
'🧴':'Tusfürdő|Sampon|Hajbalzsam|Testápoló|Naptej|Babasampon|Babaolaj|Babafürdető|Mosógél|Öblítő','🧼':'Szappan|Folyékony szappan','🪒':'Borotva|Borotvabetét|Borotvahab','🪥':'Fogkefe|Elektromos fogkefefej','🦷':'Fogkrém|Fogselyem|Szájvíz','🩹':'Sebtapasz','🧤':'Gumikesztyű','🪟':'Ablaktisztító','🚽':'WC-tisztító','🧹':'Felmosószer|Felmosófej','🧽':'Súrolószivacs|Mikroszálas kendő|Törlőkendő',
'🧻':'Papír zsebkendő|Nedves törlőkendő|Babatörlőkendő','🍼':'Tápszer|Cumisüveg|Cumi','👶':'Pelenka|Úszópelenka|Popsikrém','🐶':'Száraz kutyaeledel|Nedves kutyaeledel|Kutya jutalomfalat|Kutyapiszokzacskó','🐱':'Száraz macskaeledel|Nedves macskaeledel|Macska jutalomfalat|Macskaalom','🦴':'Rágócsont','🐦':'Madáreleség','🐹':'Rágcsálóeledel|Alom kisállatnak',
'🔋':'Elem AA|Elem AAA|Gombelem','💡':'Izzó','🕯️':'Gyertya','🔥':'Gyufa|Öngyújtó','🪡':'Varrókészlet','🦟':'Rovarirtó|Szúnyogriasztó','👞':'Cipőápoló','🥡':'Ételtároló doboz','🥪':'Szendvics','🍣':'Sushi','🧆':'Falafel'
};
for(const [icon,names] of Object.entries(iconFamilies))for(const name of names.split('|'))foodIcons[name]=icon;

const catalog=catalogGroups.flatMap(([category,emoji,names])=>names.split('|').map(name=>({name,category,emoji:foodIcons[name]||emoji})));

// Editorial household defaults, not measured purchase frequency. Keep all items reachable.
const categoryPriorityOrder=['Zöldségek','Tejtermék és tojás','Pékáru','Gyümölcsök','Hús és felvágott','Rizs és tészta','Italok','Konzervek és hüvelyesek','Szószok és olajok','Fűszerek','Fagyasztott','Sütés és édesség','Reggeli és rágcsálnivaló','Lekvárok és kenhető krémek','Édességek','Magvak és rágcsálnivalók','Növényi alapok','Hal és tengeri','Készételek és gyors fogások','Sör, bor és szeszes italok','Takarítás és mosás','Papír és konyhai kellékek','Tisztálkodás és szépségápolás','Fogápolás és higiénia','Baba és kisgyerek','Állateledel és kellékek','Otthoni apróságok','Saját tételek','Egyéb'];
const householdEssentials=['Tojás','Tej','Kenyér','Paradicsom','Krumpli','Hagyma','Paprika','Fokhagyma','Alma','Banán','Vaj','Sajt','Tejföl','Joghurt','Csirkemell','Csirkecomb','Rizs','Tészta','Olaj','Liszt','Só','Cukor','Sárgarépa','Uborka','Citrom','Zsemle','Kifli','Csirkemellsonka','Sonka','Trappista','Túró','Tejszín','Sajtkrém','Zabpehely','Kávé','Tea','Pirospaprika','Bors','Mustár','Majonéz','Ketchup','Zöldségkeverék','Borsó','Gomba','Brokkoli','Cukkini','Saláta','Narancs','Körte','Barack','Jázminrizs','Spagetti','Penne','Darált sertéshús','Darált marhahús','Szalonna','Virsli','Kolbász','Babkonzerv','Kukoricakonzerv','Paradicsomkonzerv','Sűrített paradicsom','Lencse','Méz','Baracklekvár','Müzli','Sütőpor','Kakaópor','Mosogatószer','WC-papír','Papírtörlő','Szemeteszsák','Mosószer'];
householdEssentials.push('Fogkrém','Tusfürdő','Sampon','Pelenka','Papír zsebkendő','Mosogatógép-tabletta','Folyékony szappan','Száraz kutyaeledel','Száraz macskaeledel');
const householdPriority=new Map(catalog.map((item,index)=>[item.name,1000+categoryPriorityOrder.indexOf(item.category)*100+index]));
householdEssentials.forEach((name,index)=>householdPriority.set(name,index));
