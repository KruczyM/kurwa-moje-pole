/**
 * NpcAiAgent - Lokalny, zero-cost silnik inteligencji dialogowej NPC.
 *
 * Zapewnia kontekstowe odpowiedzi w świecie Pol'and'Rock / Woodstock
 * z uwzględnieniem charakteru, historii i specyfiki każdej z kanonicznych postaci,
 * rozszerzonych bohaterów oraz 90 modeli tłumu festiwalowego.
 * Zgodny z regułą braku zewnętrznych płatnych API (Rule 2 w AGENTS.md).
 */

export interface NpcVoiceSettings {
  pitch: number;
  rate: number;
  volume: number;
  gender?: 'male' | 'female';
}

export interface NpcDialogueResponse {
  text: string;
  topic: string;
  voiceSettings: NpcVoiceSettings;
}

export interface NpcDialogueContext {
  lastNpcMessage?: string;
  history?: Array<{ sender: string; text: string; isPlayer: boolean }>;
}

export interface NpcPersona {
  name: string;
  title: string;
  voiceSettings: NpcVoiceSettings;
  greetings: string[];
  identity: string[];
  festivalLore: Record<string, string[]>;
  genericCatchphrases: string[];
}

/**
 * Kanoniczne 8 postaci głównych obozu "Kurwa Moje Pole".
 */
export const NPC_PERSONAS: Record<string, NpcPersona> = {
  Pień: {
    name: 'Pień aka Peposz',
    title: 'Gospodarz Pola',
    voiceSettings: { pitch: 0.85, rate: 0.95, volume: 1.0 },
    greetings: [
      'Siemanko! Pamiętaj, czyje to pole!',
      'Cześć! Wbijaj pod plandekę, ale szanuj porządek.',
      'Siema brachu! Dobrze cię widzieć w obozie.',
    ],
    identity: [
      'Jestem Peposz, pan i władca tego kawałka ziemi! Hasło jest jedno: KURWA, MOJE POLE!',
      'Gospodarz obozu we własnej osobie. Pilnuję, żeby nikt nam nie zwinął flagi ani dobrego klimatu.',
    ],
    festivalLore: {
      ciemno: [
        'Zaraz będzie ciemno? ZAMKNIJ SIĘ! Klasyka gatunku, tak ma być!',
        'ZAMKNIJ SIĘ! Ale latarkę miej pod ręką, bo w nocy zgubisz namiot.',
      ],
      pole: [
        'To jest NASZE pole! Granica jest święta, a flaga na maszcie stoi twardo.',
        'Moje pole, moje zasady, ale browarem z dobrym człowiekiem zawsze się podzielę.',
      ],
      piwo: [
        'Zimne piwko to podstawa przetrwania w tym upale. Pod plandeką mamy zapas w cieniu.',
        'Na zdrowie! Tylko nie rzucaj puszek w trawę, zbieramy do worków.',
      ],
      bloto: [
        'Błoto pod sceną to esencja festiwalu! Jak wrócisz czysty, to znaczy, że cię tu nie było.',
        'Kąpiel błotna uodparnia na cały rok. Idź do grzybka albo pod Dużą Scenę!',
      ],
      koncert: [
        'Koncerty już grają albo zaraz zaczną. Dźwięk z Dużej Sceny niesie się po całym pasie startowym.',
        'Sprawdź rozpiskę przy namiocie prasowym, ale najważniejsze to iść tam, gdzie jest największy ogień!',
      ],
      kibel: [
        'Toi-toi stoi w narożniku obozu. Zawór dba o zaopatrzenie, papier jeszcze powinien być.',
        'W rogu pola masz toi-toie. Pamiętaj: nie wrzucaj tam butelek, szanujmy serwis!',
      ],
      deszcz: [
        'Plandeka jest naciągnięta na mur-beton. Nawet jak lunie oberwanie chmury, siedzimy na suchym.',
        "Deszcz na Pol'and'Rocku to tylko darmowy prysznic przed pogo!",
      ],
    },
    genericCatchphrases: [
      'Festiwal trwa, muzyka gra, a pole stoi na swoim miejscu!',
      'Pamiętaj: miłość, przyjaźń, muzyka i... kurwa, moje pole!',
      'Złap oddech, napij się wody i leć pod scenę.',
    ],
  },

  Amper: {
    name: 'Amper',
    title: 'Elektryk Obozowy',
    voiceSettings: { pitch: 1.05, rate: 1.1, volume: 1.0 },
    greetings: [
      'Siema! Uważaj pod nogi, kable idą w trawie.',
      'Cześć! Potrzebujesz naładować powerbanka czy po prostu pogadać?',
    ],
    identity: [
      'Jestem Amper. Pilnuję zasilania, agregatu, lampek i żeby nikogo nie popieściło pod prysznicem.',
      'Nazywają mnie Amper, bo bez prądu nie ma muzyki, a bez muzyki nie ma tego festiwalu!',
    ],
    festivalLore: {
      ciemno: ['ZAMKNIJ SIĘ! Chociaż agregat odpalam dopiero o dwudziestej pierwszej!'],
      pole: ['Nasze pole ma najlepszą instalację oświetleniową na całym Czaplinku.'],
      piwo: ['Zimne piwo najlepiej chłodzić przy wentylatorze agregatu, sprawdzony patent.'],
      bloto: ['Błoto i wysokie napięcie to ryzykowna fuzja, dlatego kable trzymam w izolacji!'],
      koncert: ['Nagłośnienie na Dużej Scenie bierze gigawaty mocy! Czuć bas aż w trzewiach.'],
      kibel: ['Zawór ogarnia kible, ja ewentualnie mogę podciągnąć lampkę solarną na daszek.'],
      deszcz: ['Jak zacznie padać, natychmiast chowam przedłużacze pod plandekę!'],
    },
    genericCatchphrases: [
      'Napięcie rośnie, do koncertu gwiazdy wieczoru zostało niewiele czasu!',
      'Miej naładowaną baterię, żeby nie zgubić ekipy po zmroku.',
    ],
  },

  Antena: {
    name: 'Antena',
    title: 'Nawigator i Hipis',
    voiceSettings: { pitch: 1.18, rate: 1.05, volume: 1.0 },
    greetings: [
      'Pokój i miłość! Piękny dzień na festiwal, prawda?',
      'Siemanko wędrowcze! Spójrz na niebo, co za energia!',
    ],
    identity: [
      'Jestem Antena. Odbieram dobre wibracje z całego pola i pilnuję masztu z flagą.',
      'Nazywają mnie Antena, bo z daleka widać moją czuprynę i maszt, który prowadzi zagubionych do domu.',
    ],
    festivalLore: {
      ciemno: ['ZAMKNIJ SIĘ! Ale gwiazdy dziś będą świecić niesamowicie, zobaczysz!'],
      pole: ['Nasz obóz to oaza spokoju pośród festiwalowego szaleństwa. Maszt wskazuje drogę.'],
      piwo: ['Chłodny napój w cieniu plandeki otwiera czakry i łączy ludzi.'],
      bloto: ['Błoto to matka ziemia, która przytula każdego festiwalowicza bez wyjątku!'],
      koncert: ['Fale dźwiękowe ze sceny rezonują z sercami setek tysięcy pięknych dusz.'],
      kibel: ['Kolejka do toi-toia to wspaniałe miejsce na nawiązanie nowych przyjaźni!'],
      deszcz: ['Tęcza po deszczu nad Czaplinkiem to najpiękniejszy widok na świecie.'],
    },
    genericCatchphrases: [
      'Uśmiechnij się do kogoś obok, dobra energia zawsze wraca ze zdwojoną siłą.',
      'Zgubienie się na tym festiwalu to najlepszy sposób na przeżycie przygody.',
    ],
  },

  Gruczoł: {
    name: 'Gruczoł',
    title: 'Weteran i Filozof',
    voiceSettings: { pitch: 0.88, rate: 0.88, volume: 1.0 },
    greetings: [
      'Siemanko. Siadaj na leżaku, nigdzie się nie pali.',
      'Elo. Spokojnie, powoli, festiwal to maraton, nie sprint.',
    ],
    identity: [
      'Gruczoł jestem. Pamiętam jeszcze Żary i Kostrzyn, a teraz pilnuję, by młodzi nie przesadzili pierwszego dnia.',
      'Mówią na mnie Gruczoł. Mój plan dnia to: leżak, rozmowa, muzyka i chillout.',
    ],
    festivalLore: {
      ciemno: ['ZAMKNIJ SIĘ... mówiłem to już w 2003 roku w Żarach, tradycja musi trwać.'],
      pole: ['Pole jest równe, namioty stoją prosto, czegóż chcieć więcej od życia?'],
      piwo: ['Jedno piwo na godzinę i dużo wody z kranu, a dożyjesz niedzielnego finału.'],
      bloto: ['Błoto jak wyschnie samo odpadnie. Nie ma co panikować ze praniem.'],
      koncert: ['Dobre kapele grają w nocy, w dzień najlepiej odpoczywać w cieniu.'],
      kibel: ['Do toi-toia idź rano tuż po czyszczeniu, złota zasada weterana.'],
      deszcz: ['Deszcz zmyje kurz z pasów lotniska, od razu lżej się oddycha.'],
    },
    genericCatchphrases: [
      'Wszystko jest pod kontrolą. Najważniejsze to nie tracić głowy i humoru.',
      'Najlepsze wspomnienia tworzą się same, wystarczy usiąść i słuchać.',
    ],
  },

  Klątwa: {
    name: 'Klątwa',
    title: 'Pogodyn i Szef Plandeki',
    voiceSettings: { pitch: 1.02, rate: 1.02, volume: 1.0 },
    greetings: [
      'Cześć. Sprawdzałeś śledzie w swoim namiocie? Lepiej sprawdź.',
      'Siema. Nad horyzontem idą chmury, trzeba trzymać wartę.',
    ],
    identity: [
      'Jestem Klątwa. Pilnuję naciągów, linek i plandeki. Jeśli coś ma runąć, ja to zabezpieczę.',
      'Nazywają mnie Klątwa, bo zawsze wykraczę deszcz, ale za to mój obóz nigdy nie odpływa z wiatrem.',
    ],
    festivalLore: {
      ciemno: ['ZAMKNIJ SIĘ! Bo jak zawieje, to nam linki zerwie!'],
      pole: ['Nasze pole jest dobrze zabezpieczone. Dodatkowe odciągi zamontowałem rano.'],
      piwo: ['Piwo spoko, byle puszki nie latały przy podmuchach wiatru.'],
      bloto: [
        'Jak ziemia nasiąknie, śledzie namiotowe łatwiej wychodzą. Wbijajcie je pod kątem czterdziestu pięciu stopni!',
      ],
      koncert: [
        'Na koncert idę w kurtce przeciwdeszczowej. Pogoda na lotnisku potrafi zmienić się w kwadrans.',
      ],
      kibel: ['Zawór pilnuje sanitariatów, a ja pilnuję, żeby wiatr nie przewrócił kabiny.'],
      deszcz: ['Wszyscy pod plandekę! Miejsca starczy dla każdego, kto nie panikuje.'],
    },
    genericCatchphrases: [
      'Dobra linka to podstawa stabilnego życia na festiwalu.',
      'Przezorny festiwalowicz zawsze ma zapasowe suche skarpety w worku foliowym.',
    ],
  },

  Krwiak: {
    name: 'Krwiak',
    title: 'Punk i Pogowicz',
    voiceSettings: { pitch: 0.95, rate: 1.22, volume: 1.0 },
    greetings: [
      'OIE OIE! Wstawać, szkoda dnia na spanie, pogo czeka!',
      'Siema załogancie! Masz glany zawiązane na dwa węzły?',
    ],
    identity: [
      'Krwiak z tej strony! Krew, pot, gitary i ściana śmierci pod Dużą Sceną!',
      'Jestem Krwiak. Gdzie jest najostrzejszy łomot na festiwalu, tam jestem ja!',
    ],
    festivalLore: {
      ciemno: ['ZARAZ BĘDZIE CIEMNO! ZAMKNIJ SIĘ! I OGIŃ POD BARIERKAMI!'],
      pole: ['Pole jest naszą bazą wypadową do skakania w tłum!'],
      piwo: ['Browar na orzeźwienie po dwugodzinnym młynie to dar od bogów rocka!'],
      bloto: ['Wskakuj w błoto na główkę! Prawdziwy punk pachnie ziemią i wolnością!'],
      koncert: ['Za chwilę zaczyna się koncert, zrobimy największe pogo w historii Czaplinka!'],
      kibel: ['Szybki wypad do toi-toia i wracamy pod głośniki, nie ma czasu do stracenia!'],
      deszcz: ['Deszcz? To tylko dodaje siły do darcia gardła razem z wokalistą!'],
    },
    genericCatchphrases: [
      'Jak ktoś upadnie w pogo, to go podnosisz – to pierwsza i jedyna zasada!',
      'Głośniej, mocniej, do przodu! Woodstock to czysta energia!',
    ],
  },

  Pierścień: {
    name: 'Pierścień',
    title: 'Strażnik Obozu',
    voiceSettings: { pitch: 0.92, rate: 0.98, volume: 1.0 },
    greetings: [
      'Czołem! Pilnuj drogi pożarowej, nie zastawiaj przejścia.',
      'Siemanko. Wszystko gra w twoim sektorze?',
    ],
    identity: [
      'Jestem Pierścień. Dbam o to, żeby nikt obcy nie wchodził w szkodę i żebyśmy mieli bezpieczną przestrzeń.',
      'Pierścień – strażnik spokoju i ładu przestrzennego tego obozu.',
    ],
    festivalLore: {
      ciemno: ['ZAMKNIJ SIĘ! Ale po zmroku miej latarkę, żeby nie potknąć się o linkę namiotu.'],
      pole: ['Obóz ma wyraźne granice. Dzięki temu każdy ma kawałek trawy dla siebie.'],
      piwo: ['Pijemy kulturalnie, śmieci wrzucamy do worków powieszonych na słupku.'],
      bloto: ['Uważaj na śliskich podejściach, łatwo wywinąć orła przed wejściem pod plandekę.'],
      koncert: ['Wychodząc na koncert zamknij namiot na suwak i schowaj cenne rzeczy do kieszeni.'],
      kibel: ['Kolejka ma być płynna, nikt się nie wpycha, wszyscy jesteśmy tu przyjaciółmi.'],
      deszcz: ['Woda musi spływać rowkiem poza krawędź obozu, wykopaliśmy odpływ wczoraj.'],
    },
    genericCatchphrases: [
      'Porządek w obozie to spokojna głowa pod sceną.',
      'Szanuj sąsiadów z namiotu obok, a oni uszanują twój odpoczynek.',
    ],
  },

  Zawór: {
    name: 'Zawór',
    title: 'Hydraulik i Zaopatrzeniowiec Sanitariatu',
    voiceSettings: { pitch: 0.98, rate: 0.96, volume: 1.0 },
    greetings: [
      'Cześć! Pijesz wystarczająco dużo wody w tym słońcu?',
      'Siemanko. Zaopatrzenie sanitarne pod kontrolą, możesz działać.',
    ],
    identity: [
      'Jestem Zawór. Woda, kraniki, baniaki, toi-toie i higiena polowa to moja domena.',
      'Mówią mi Zawór, bo odkręcam każdą kryzysową sytuację z wodą na tym polu.',
    ],
    festivalLore: {
      ciemno: ['ZAMKNIJ SIĘ! I umyj zęby przed snem, woda w baniaku przy wejściu!'],
      pole: ['Mamy najczystszy kącik sanitarny w promieniu kilometra lotniska.'],
      piwo: ['Złota reguła Zaworu: na każde jedno piwo przypada szklanka czystej wody.'],
      bloto: ['Błoto jest fajne, ale wieczorem warto obmyć stopy w zimnej wodzie pod kranikiem.'],
      koncert: [
        'Na koncert weź ze sobą małą butelkę wody, pod sceną temperatura sięga pięćdziesięciu stopni!',
      ],
      kibel: ['Toi-toi jest w rogu. Serwis jeździ regularnie, więc pachnie względną świeżością.'],
      deszcz: [
        'Deszczówka to dobra woda techniczna, ale do picia bierzemy tylko ze sprawdzonych ujęć kranowych!',
      ],
    },
    genericCatchphrases: [
      'Nawodnienie to klucz do przeżycia trzydniowego festiwalu w pełnym zdrowiu.',
      'Nie stój za długo w pełnym słońcu, czapka na głowę i leć pod daszek.',
    ],
  },
};

/**
 * 8 Rozszerzonych Bohaterów Obozu i Festiwalu.
 */
export const EXTENDED_HERO_PERSONAS: Record<string, NpcPersona> = {
  Ambona: {
    name: 'Ambona',
    title: 'Kaznodzieja Rocka i Wolności',
    voiceSettings: { pitch: 0.9, rate: 1.05, volume: 1.0 },
    greetings: [
      'Błogosławieni, którzy skaczą pod barierkami!',
      'Bracia i siostry w rocku, zbierzcie się wokół słowa wolności!',
      'Pokój temu obozowi i każdemu, kto niesie dobrego ducha muzyki!',
    ],
    identity: [
      "Jam jest Ambona! Ze skrzynki po browarze niczym z kazalnicy głoszę wieczną ewangelię rock'n'rolla, miłości i braterstwa!",
      'Mówią na mnie Ambona. Zamiast kazań o karach głoszę pochwałę wolności, tolerancji i potężnego przesteru gitarowego.',
    ],
    festivalLore: {
      ciemno: ['ZAMKNIJ SIĘ! Niech światłość waszych serc i latarek rozproszy wszelki mrok tego świata!'],
      pole: ['To pole jest ziemią obiecaną, mlekiem i chmielem płynącą! Szanujmy ten skrawek raju.'],
      piwo: ['Złocisty napój chmielowy dla spragnionych dusz to dar serca, pijcie z umiarem i radością.'],
      bloto: ['Z prochu powstałeś, w błoto wejdziesz i z czystym duchem wyjdziesz z pogo!'],
      koncert: ['Każdy koncert to nabożeństwo wolności, a gitara elektryczna to nasz dzwon!'],
      kibel: ['Cierpliwość w kolejce do toi-toia hartuje cnoty kardynalne każdego festiwalowicza.'],
      deszcz: ['Deszcz z nieba to chrzest festiwalowy, nie lękajcie się kropel!'],
    },
    genericCatchphrases: [
      'Idźcie pod scenę i czyńcie hałas wielki na chwałę rocka!',
      'Miłujcie bliźniego swego, a zwłaszcza tego, który upadł w pogo.',
    ],
  },

  Chlebak: {
    name: 'Chlebak',
    title: 'Zaopatrzeniowiec Obozowy',
    voiceSettings: { pitch: 0.95, rate: 1.0, volume: 1.0 },
    greetings: [
      'Głodny? W moim chlebaku zawsze znajdzie się kabanos albo pasztet podlaski!',
      'Siemanko! Masz ze sobą suchy prowiant, czy ratować cię konserwą turystyczną?',
      'Czołem! Pamiętaj: pusty żołądek to zły kompan do skakania pod sceną.',
    ],
    identity: [
      'Mówią mi Chlebak. Mój wojskowy chlebak ma pojemność czarnej dziury – wyciągnę z niego konserwę, otwieracz, sól, a jak trzeba to i sucharki!',
      'Jestem Chlebak, szef polowej spiżarni. Z głodu u nas nikt jeszcze nie zszedł ze świata.',
    ],
    festivalLore: {
      ciemno: ['ZAMKNIJ SIĘ! I zjedz kanapkę, bo do rana nie dociągniesz o suchym pysku!'],
      pole: ['W naszym obozie jedzenie trzymamy w cieniu pod plandeką, w bezpiecznych pojemnikach.'],
      piwo: ['Browar bez podkładu z kabanosa to prosta droga do przedwczesnego snu w krzakach!'],
      bloto: ['Błoto błotem, ale ręce przed jedzeniem konserwy wytrzyj chociaż w suchą chusteczkę!'],
      koncert: ['Przed koncertem wrzuć coś na ząb, energia pod sceną spala się w piętnaście minut.'],
      kibel: ['Dobra dieta obozowa to podstawa – fasolka po bretońsku tylko na własną odpowiedzialność!'],
      deszcz: ['Chlebak z brezentu nie przemaka, prowiant jest w stu procentach bezpieczny.'],
    },
    genericCatchphrases: [
      'Podziel się kabanosem z sąsiadem, a zyskasz przyjaciela na całe życie.',
      'Konserwa turystyczna to król festiwalowej gastronomii!',
    ],
  },

  Dziąsło: {
    name: 'Dziąsło',
    title: "Weteran Jarocina '88",
    voiceSettings: { pitch: 0.82, rate: 0.92, volume: 1.0 },
    greetings: [
      'Siema młody! Zęby może straciłem w Jarocinie, ale serce do punka bije mocniej niż kiedykolwiek!',
      'Oooo, nowy załogant! Uważaj w pogo, bo skończysz ze szczerbatym uśmiechem jak mój!',
      'Siemanko. Trzymaj fason, szanuj starszych punków i nigdy się nie poddawaj.',
    ],
    identity: [
      "Dziąsło jestem. W '88 na Jarocinie dostałem glanem w szczękę i tak już zostało. Za to w pogo nikt mi już zęba nie wybije!",
      'Stary punk ze mnie, pamiętam Jarocin i czasy kaset magnetofonowych przegrywanych na jamniku. Piękny festiwal mamy teraz!',
    ],
    festivalLore: {
      ciemno: [
        'ZARAZ BĘDZIE CIEMNO? ZAMKNIJ SIĘ! Za komuny milicja wyłączała nam prąd i śpiewaliśmy a cappella!',
      ],
      pole: ['Dobre pole to skarb. Kiedyś spało się na dworcu na betonie i też było pięknie.'],
      piwo: [
        'Piwko z puszki dobre, byle zimne. Kiedyś piło się z butelek z kapslem na ząb – dopóki były zęby!',
      ],
      bloto: ['Błoto leczy rany po pogo lepiej niż maść z apteki, wiem co mówię.'],
      koncert: ['Kiedyś to grał Dezerter i Siekiera... ale dzisiejsza młoda krew też ma niezłego kopa!'],
      kibel: ['Toi-toie to luksus! W latach osiemdziesiątych był tylko las i szpadel!'],
      deszcz: ['Prawdziwy punk deszczu się nie boi, skóra i tak wyschnie przy ognisku.'],
    },
    genericCatchphrases: [
      'Punk to nie moda, to sposób patrzenia na świat.',
      'Szanuj ludzi pod sceną – jak ktoś leży, to podnosisz, prosta zasada od czterdziestu lat.',
    ],
  },

  Hemoroid: {
    name: 'Hemoroid',
    title: 'Miłośnik Wygody i Leżaków',
    voiceSettings: { pitch: 0.87, rate: 0.9, volume: 1.0 },
    greetings: [
      'Uch... cześć. Masz może wolny leżak z miękkim obiciem?',
      'Siemanko. Piękny festiwal, tylko ziemia twarda jak beton...',
      'Hej. Boli mnie krzyż od wczorajszego spania na szyszkach, ale koncertu nie odpuszczę!',
    ],
    identity: [
      'Mówią na mnie Hemoroid. Wszyscy myślą, że marudzę, a ja po prostu wiem, że bez dobrego krzesła turystycznego trzeciego dnia nie wstaniesz z namiotu!',
      'Jestem koneserem miękkich powierzchni. Dmuchany materac, fotel wędkarski i poduszka z gąbki to moje święte trio.',
    ],
    festivalLore: {
      ciemno: ['ZAMKNIJ SIĘ... i po ciemku nie siadaj na twardej ziemi, bo cię korzonki złapią!'],
      pole: ['Nasze pole jest równe, dzięki Bogu. Na kretowisku bym w ogóle nie zmrużył oka.'],
      piwo: ['Piwko pomaga zapomnieć o twardym podłożu, polej jedno na ukojenie lędźwi.'],
      bloto: ['W błocie jest miękko, to fakt, ale potem tyłek zmarznie na wietrze!'],
      koncert: [
        'Na koncert biorę małe rozkładane krzesełko. Stanie pięć godzin przy barierkach to katorga dla kręgosłupa.',
      ],
      kibel: ['Toi-toie mogłyby mieć miękką deskę, ale nie bądźmy przesadnie roszczeniowi.'],
      deszcz: ['Deszcz oznacza wilgoć, a wilgoć to ból w kościach. Siadam tylko na suchym!'],
    },
    genericCatchphrases: [
      'Młodość nie wieczność, dbajcie o kręgosłupy póki czas!',
      'Dobry leżak kempingowy to inwestycja ważniejsza niż bilet powrotny.',
    ],
  },

  Jęczmień: {
    name: 'Jęczmień',
    title: 'Piwowar i Koneser Chmielu',
    voiceSettings: { pitch: 0.92, rate: 0.98, volume: 1.0 },
    greetings: [
      'Witaj koneserze! Poczuj ten chmielowy aromat w letnim powietrzu!',
      'Cześć! Ciepłe piwo to zbrodnia przeciw ludzkości – wpadaj do naszego cienia!',
      'Siemanko! Szukasz zimnego złota? Trafiłeś pod właściwy namiot.',
    ],
    identity: [
      'Jestem Jęczmień. Znam każdy gatunek chmielu od Lublina po Żatec. Pilnuję, by na naszym polu żaden trunek nie przekroczył ośmiu stopni Celsjusza!',
      'Nazywają mnie Jęczmień, bo z pasją badam właściwości złocistego trunku w warunkach polowych.',
    ],
    festivalLore: {
      ciemno: ['ZAMKNIJ SIĘ! Ciemność jest dobra tylko dla porteru bałtyckiego!'],
      pole: [
        'Wykopaliśmy dół w ziemi pod namiotem – to najlepsza naturalna lodówka na puszki na całym pasie lotniska.',
      ],
      piwo: ['Chmiel, woda, słód jęczmienny i festiwalowy klimat – to cztery żywioły prawdziwego szczęścia!'],
      bloto: ['Błoto pod sceną ma kolor dobrego stoutu, ale pić go nie polecam!'],
      koncert: ['Zimny trunek w dłoni, potężny riff z Dużej Sceny – tak smakuje lato życia.'],
      kibel: ['Złota reguła piwna: po trzecim kuflu zlokalizuj toi-toia zanim będzie za późno!'],
      deszcz: ['Krople deszczu w kuflu to tylko darmowe rozcieńczenie ekstraktu chmielowego.'],
    },
    genericCatchphrases: [
      'Pij z głową, delektuj się smakiem i zbieraj puszki do recyklingu!',
      'Dobry chmiel łączy ludzi szybciej niż najszybszy internet.',
    ],
  },

  Kobra: {
    name: 'Kobra',
    title: 'Niewzruszony Mistrz Młyna',
    voiceSettings: { pitch: 1.04, rate: 1.15, volume: 1.0 },
    greetings: [
      'Siema! W pogo liczy się zwinność, a nie masa – zapamiętaj to dobrze!',
      'Siemanko! Kobra w gotowości, widziałeś jaki młyn szykuje się pod Dużą Sceną?',
      'Cześć! Ruszaj się, rozgrzej stawy, nie stój jak słup soli!',
    ],
    identity: [
      'Kobra to ja! Wpadam w sam środek ściany śmierci i wychodzę bez jednego zadrapania. Balans i zwinność!',
      'Nazywają mnie Kobra, bo unikam ciosów łokciem w pogo jak nikt inny. Zawsze na nogach!',
    ],
    festivalLore: {
      ciemno: ['ZAMKNIJ SIĘ! W ciemności pogo staje się jeszcze bardziej nieprzewidywalne, kocham to!'],
      pole: ['Pole obozowe to arena treningowa przed wieczornymi koncertami.'],
      piwo: ['Browarek dopiero po wyjściu z młyna – w trakcie trzeba mieć sto procent refleksu!'],
      bloto: ['Śliskie błoto to test mistrzowski dla stóp. Kto utrzyma pion, ten jest królem!'],
      koncert: ['Jak tylko uderzy perkusja, ruszamy w kółko! Pokażę ci jak płynąć z prądem tłumu.'],
      kibel: ['Szybki unik do toi-toia i z powrotem na barierki, bez ociągania się.'],
      deszcz: ['Deszcz chłodzi rozgrzane mięśnie, idealna pogoda na dwugodzinny kocioł!'],
    },
    genericCatchphrases: [
      'Nigdy nie walcz z tłumem – tańcz z tłumem!',
      'Upadłeś? Ręka w górę, ekipa zaraz cię podniesie.',
    ],
  },

  Korba: {
    name: 'Korba',
    title: 'Zakręcona Tancerka Festiwalowa',
    voiceSettings: { pitch: 1.32, rate: 1.2, volume: 1.0, gender: 'female' },
    greetings: [
      'HEEEJ! Tańczysz ze mną?! Muzyka gra w naszych żyłach non stop!',
      'Siemanko! Nie ma spania, szkoda życia, zaraz zaczyna się kolejny gigantyczny set!',
      'Czeeeść! Masz ochotę pokręcić korbą? Ja nie zwalniam ani na sekundę!',
    ],
    identity: [
      'Jestem Korba! Nazywają mnie tak, bo mam w środku nakręconą sprężynę, która nigdy się nie rozładowuje! Juuuhuu!',
      'Tańczę do wszystkiego: od death metalu po orkiestrę dętą! Życie jest za krótkie, żeby podpierać ściany namiotu!',
    ],
    festivalLore: {
      ciemno: ['ZARAZ BĘDZIE CIEMNO? TO WŁĄCZAMY NEONY I DALEJ W TANY! ZAMKNIJ SIĘ I SKACZ!'],
      pole: ['Nasz obóz to najweselsze miejsce na całej płycie lotniska!'],
      piwo: ['Łyk chłodnego napoju i lecimy kręcić piruety pod sceną!'],
      bloto: ['Taniec w błocie to najlepsza zabawa na świecie, spójrz na moje buty!'],
      koncert: ['Muzyka na żywo to najczystsza magia, czuję każdy dźwięk w koniuszkach palców!'],
      kibel: ['W kolejce do toi-toia też można tańczyć lambadę, polecam każdemu!'],
      deszcz: ['Deszcz to tylko darmowe konfetti z nieba! Tańczymy dalej!'],
    },
    genericCatchphrases: [
      'Uśmiech, skok i do przodu! Festiwal trwa wiecznie!',
      'Rusz biodrami, zrzuć z siebie cały stres z całego roku!',
    ],
  },

  Szerszeń: {
    name: 'Szerszeń',
    title: 'Głośny Komentator i Plotkarz Obozowy',
    voiceSettings: { pitch: 1.1, rate: 1.18, volume: 1.0 },
    greetings: [
      'Bzzzt! Siema! Słyszałeś co się działo w nocy w sektorze trzecim?!',
      'Cześć! Mam najświeższe plotki z całego lotniska Czaplinek!',
      'Siemanko! Szerszeń na posterunku, nic nie umknie mojej uwadze!',
    ],
    identity: [
      'Szerszeń z tej strony! Krążę nad polem, podsłuchuję, komentuję i wiem o wszystkim zanim Jurek Owsiak wyjdzie na scenę!',
      'Mówią mi Szerszeń, bo jestem wszędzie tam, gdzie coś się dzieje i brzęczę o tym na cały obóz.',
    ],
    festivalLore: {
      ciemno: ['ZAMKNIJ SIĘ! Ale słuchaj, podobno w sektorze B ktoś zgubił sztuczną szczękę!'],
      pole: ['Nasze pole ma najlepszą lokację – blisko do sceny, a wystarczająco daleko od agregatów.'],
      piwo: ['W sklepie rzucili świeżą dostawę zimnych puszek, leć zanim wykupią!'],
      bloto: ['Widziałem kolesia w stroju dinozaura, który zrobił ślizg na brzuchu na dwadzieścia metrów!'],
      koncert: ['Podobno wieczorem ma być niespodziewany gość specjalny na Dużej Scenie, miej uszy otwarte!'],
      kibel: ['Kolejka do toi-toia ma teraz piętnaście osób, lepiej przeczekać z kwadrans!'],
      deszcz: ['Radar pogodowy pokazuje deszcz za pół godziny, chowajcie suszące się ręczniki!'],
    },
    genericCatchphrases: [
      'Wiem wszystko, widziałem wszystko, a czego nie widziałem, to dopowiem!',
      'Festiwal bez dobrych plotek to jak gitara bez strun!',
    ],
  },
};

/**
 * Sygnaturowe, ikoniczne modele tłumu festiwalowego (np. z paczki npc_models).
 */
export const SIGNATURE_MODEL_PERSONAS: Record<string, NpcPersona> = {
  '050_blue_alien_girl': {
    name: 'Niebieska Kosmitka',
    title: 'Międzygalaktyczna Fanka Rocka',
    voiceSettings: { pitch: 1.35, rate: 1.05, volume: 1.0, gender: 'female' },
    greetings: [
      'Pozdrowienia z Mgławicy Andromedy, Ziemianinie!',
      'Wylądowałam na Czaplinku, bo wasze gitary słychać w całym kwadrancie kosmicznym!',
      "Cześć istotko! Wasza atmosfera jest przesiąknięta falami rock'n'rolla!",
    ],
    identity: [
      "Jestem podróżniczką z odległej galaktyki. Przechwyciliśmy sygnał Pol'and'Rocka przez radioteleskop i przyleciałam na najgłośniejsze święto wolności we wszechświecie!",
      'Niebieska skóra, kosmiczne okulary i ziemska miłość do gitarowego przesteru – oto cała ja.',
    ],
    festivalLore: {
      ciemno: ['W próżni kosmicznej zawsze jest ciemno! ZAMKNIJ SIĘ i włącz fotony!'],
      pole: ['Wasz obóz jest oznaczony z orbity jako strefa najwyższego poziomu pozytywnej energii.'],
      piwo: ['Wasz chmielowy nektar jest o niebo smaczniejszy niż syntetyczne paliwo rakietowe.'],
      bloto: ['Ziemskie błoto ma niezwykłe właściwości regenerujące dla niebieskiego naskórka!'],
      koncert: ['Częstotliwość basu ze sceny wprowadza mój statek w rezonans grawitacyjny!'],
      kibel: ['Wasze kabiny sanitarne są fascynującym przykładem prostej ziemskiej inżynierii polowej.'],
      deszcz: ['U nas na planecie pada ciekły metan, więc wasz ciepły letni deszcz to czysta rozkosz!'],
    },
    genericCatchphrases: [
      'Pokój dla wszystkich galaktyk i głośna muzyka dla każdego!',
      'Zabiorę wspomnienia z tego festiwalu do mojej macierzystej gwiezdnej bazy.',
    ],
  },

  '082_hotdog_girl': {
    name: 'Parówkowa Wojowniczka',
    title: 'Królowa Festiwalowej Gastronomii',
    voiceSettings: { pitch: 1.25, rate: 1.18, volume: 1.0, gender: 'female' },
    greetings: [
      'Siemanko! Bułka chrupiąca, parówka gorąca, a pogo pod sceną jeszcze gorętsze!',
      'Cześć! Keczup czy musztarda? A może od razu skok w tłum?!',
      'Hejka! Najsmaczniejsza postać na całym festiwalu melduje się do rozmowy!',
    ],
    identity: [
      'Ubrałam ten kostium wielkiego hotdoga, żeby znajomi nigdy nie zgubili mnie w tłumie! Wielką parówkę widać z kilometra!',
      'Jestem Parówkową Wojowniczką. Łączę miłość do dobrego jedzenia z bezkompromisowym skakaniem pod barierkami.',
    ],
    festivalLore: {
      ciemno: ['ZAMKNIJ SIĘ! Tylko po ciemku nie weź gryza z mojego kostiumu, to pianka!'],
      pole: ['Pole namiotowe to wielki piknik, a ja jestem jego honorową maskotką.'],
      piwo: ['Do soczystego hotdoga zimne piwo pasuje jak solówka do rockowej ballady.'],
      bloto: ['Uważam na błoto, bo musztardowo-błotna polewa wygląda podejrzanie!'],
      koncert: ['Wielki hotdog na fali ludzkich rąk to najpiękniejszy widok pod Dużą Sceną!'],
      kibel: ['Przeciskanie się przez drzwi toi-toia w tym stroju to niezła ekwilibrystyka!'],
      deszcz: ['Bułka z gąbki chłonie deszczówkę, robię się dwa razy cięższa, ale tańczę dalej!'],
    },
    genericCatchphrases: [
      'Życie jest za krótkie na nudne przebrania!',
      'Dodajmy trochę pikanterii temu festiwalowi!',
    ],
  },

  '076_frog_suit_guy': {
    name: 'Żabol z Pola',
    title: 'Płaz Festiwalowy i Mistrz Skoków',
    voiceSettings: { pitch: 0.78, rate: 1.08, volume: 1.0 },
    greetings: [
      'Kum-kum! Siema człowieku! Widziałeś gdzieś dobrą, głęboką kałużę?',
      'Rechot na polu! Piękny dzień na taplanie się w bajorze!',
      'Kum! Cześć! Zielony kombinezon, zielona trawa, idealny kamuflaż!',
    ],
    identity: [
      'Jestem Żabol. W tym zielonym kostiumie mam plus sto do skakania w pogo i plus dwieście do odporności na deszcz!',
      'Rechoczę ze szczęścia od czwartku. Festiwal to moje naturalne środowisko wodno-błotne!',
    ],
    festivalLore: {
      ciemno: ['Kum! ZAMKNIJ SIĘ! W nocy na bagnach rechot słychać najgłośniej!'],
      pole: ['Nasze pole ma najlepszą wilgotność podłoża, idealne warunki dla płazów!'],
      piwo: ['Złocisty napój chłodzi gardło po całodziennym kumkaniu!'],
      bloto: ['Błoto to mój biotop! Nurkuję w kałuży na główkę i czuję się jak w domu!'],
      koncert: ['Pod sceną skaczę wyżej niż inni – żabie nogi robią swoje! Kum!'],
      kibel: ['Czystość to rzecz względna, ale kranik z zimną wodą bardzo szanuję.'],
      deszcz: ['Deszcz?! Hura! Nareszcie pogoda dla prawdziwych koneserów wilgoci!'],
    },
    genericCatchphrases: ["Kumaj bazę, człowieku! Pol'and'Rock to wolność!", 'Skacz ze mną pod same chmury!'],
  },

  '084_knight_cosplay': {
    name: 'Rycerz Festiwalowy',
    title: 'Honorowy Obrońca Barierek',
    voiceSettings: { pitch: 0.88, rate: 0.95, volume: 1.0 },
    greetings: [
      'Bądź pozdrowiony, zacny wędrowcze! Mój miecz i zbroja strzegą tego obozu!',
      'Czołem, mości panie! Przybyłem w pełnym rynsztunku na turniej pogo pod Dużą Sceną!',
      'Niechaj honor i dobra muzyka prowadzą twe kroki po tym festiwalowym szlaku!',
    ],
    identity: [
      'Jam jest Rycerz Najjaśniejszej Rzeczypospolitej Festiwalowej! Stalowa zbroja chroni przed łokciami w młynie, choć w upale grzeje niczym piec hutniczy!',
      'Ślubowałem wierność zasadom braterstwa, obronie słabszych w pogo i poszukiwaniu świętego Graala – zimnego kufla w cieniu.',
    ],
    festivalLore: {
      ciemno: ['ZAMKNIJ SIĘ, waszmość! Niechaj pochodnie i blask gitar rozświetlą mrok!'],
      pole: ['To pole jest lennem wolności, a każdy namiot to warowny zamek gościnności!'],
      piwo: ['Złocisty trunek w rogu rycerskim to najlepsza nagroda po stoczonym boju pod sceną.'],
      bloto: ['Rdza mi niestraszna! Błoto hartuje rycerską stal i męstwo wojownika!'],
      koncert: ['Ściana śmierci pod sceną to najwspanialsza szarża, w jakiej brałem udział!'],
      kibel: ['Zdejmowanie zbroi płytowej przed wejściem do toi-toia to prawdziwy sprawdzian cierpliwości.'],
      deszcz: ['Krople dzwonią o hełm niczym grad strzał, a duch mój nieugięty!'],
    },
    genericCatchphrases: [
      'Za wolność, miłość i ciężkie brzmienie!',
      'Podnieś przyłbicę i spójrz z nadzieją w stronę sceny!',
    ],
  },

  '086_mud_monster': {
    name: 'Błotny Potwór',
    title: 'Władca Kąpieliska Błotnego',
    voiceSettings: { pitch: 0.65, rate: 0.82, volume: 1.0 },
    greetings: [
      'Bulgot... cześć! Masz ochotę na darmową maseczkę borowinową?',
      "Witaj w królestwie mułu! Prawdziwe Pol'and'Rock to błoto od stóp do głów!",
      'Plask, plask... siemanko! Nie bój się, błoto nie gryzie, błoto kocha każdego!',
    ],
    identity: [
      'Jestem Błotnym Potworem! Wszedłem w kałużę przy Dużej Scenie w czwartek rano i zrosłem się z festiwalową glebą na wieki!',
      'Moja skóra to glina, muł i kurz z pasa startowego. Prawdziwa zbroja ziemi!',
    ],
    festivalLore: {
      ciemno: ['ZAMKNIJ SIĘ... w ciemności błoto schnie wolniej, co niezmiernie mnie raduje.'],
      pole: ['Każda kałuża na tym polu to moja mała prywatna filia uzdrowiska.'],
      piwo: ['Puszka piwa musi być oblepiona błotem, inaczej traci swój polowy urok.'],
      bloto: ['Błoto to nie brud! Błoto to stan umysłu, esencja wolności i najlepsza klimatyzacja!'],
      koncert: ['Z błotną skorupą na klacie w młynie czujesz się nie do zatrzymania!'],
      kibel: ['Omijam kraniki szerokim łukiem – woda mogłaby zmyć moje piękne maskowanie!'],
      deszcz: ['Deszcz to darmowa dolewka do mojej ukochanej kałuży! Niech leje!'],
    },
    genericCatchphrases: [
      'Błoto leczy duszę i chłodzi ciało!',
      'Wszyscy jesteśmy ulepieni z tej samej festiwalowej gliny!',
    ],
  },

  '001_pirate_parrot_girl': {
    name: 'Korsarka z Papugą',
    title: 'Korsarka Oceanu Namiotów',
    voiceSettings: { pitch: 1.3, rate: 1.15, volume: 1.0, gender: 'female' },
    greetings: [
      'Ahoj załogo! Na horyzoncie widzę scenę pełną rockowych skarbów!',
      'Siemanko szczurze lądowy! Wstąp na pokład pod naszą plandekę!',
      'Arrr! Spójrz na tę mapę – obóz zaznaczony krzyżykiem to nasza przystań!',
    ],
    identity: [
      'Pływam po bezkresnym morzu namiotów z moją wierną papugą. Szukamy złocistego trunku i najlepszych szantów rockowych na lotnisku!',
      'Jestem Korsarką z Czaplinka! Zamiast statku mam plecak, a zamiast szabli bilet na koncerty!',
    ],
    festivalLore: {
      ciemno: ['ZAMKNIJ SIĘ! Bo każę ci przejść po desce prosto w największe błoto!'],
      pole: ['To pole to bezpieczna zatoka, gdzie żaden korsarz nie musi obawiać się sztormu.'],
      piwo: ['Beczka rumu albo chłodne piwo z puszki – pirat na festiwalu nie wybrzydza!'],
      bloto: ['Grząskie błoto przypomina ruchome piaski z Karaibów, trzymaj kurs!'],
      koncert: ['Tłum pod sceną faluje jak ocean w czasie dziesięciu w skali Beauforta!'],
      kibel: ['Zejście pod pokład do toi-toia wymaga prawdziwie morskiego żołądka!'],
      deszcz: ['Sztorm na lotnisku? Zwinąć żagle plandeki i trzymać maszt z flagą!'],
    },
    genericCatchphrases: [
      'Arrr! Wolność to najcenniejszy skarb na całym świecie!',
      'Płyniemy prosto pod barierki, cała naprzód!',
    ],
  },

  '079_guy_in_kilt': {
    name: 'Wojownik w Kilcie',
    title: 'Góral ze Szkockiej Brygady Pogo',
    voiceSettings: { pitch: 0.94, rate: 1.05, volume: 1.0, gender: 'male' },
    greetings: [
      'Fàilte! Siema! W kiltach najwygodniej skacze się pod sceną – pełna przewiewność!',
      'Czołem! Prawdziwy wojownik nie boi się wiatru hulającego po pasie lotniska!',
      'Siemanko! Kilt w szkocką kratę i glany – oto strój idealny na festiwal!',
    ],
    identity: [
      'Noszę kilt, bo na festiwalu liczy się swoboda ruchów i rockowa tradycja. W pogo żaden szew w spodniach mi nie pęknie!',
      'Jestem festiwalowym Szkotem. Dudy zostawiłem w namiocie, za to gardło do śpiewania mam gotowe.',
    ],
    festivalLore: {
      ciemno: ['ZAMKNIJ SIĘ! Zanim zagram na dudach solówkę rockową!'],
      pole: ['Nasze pole przypomina szkockie Highlands, tylko trawa jest cieplejsza!'],
      piwo: ['W Szkocji mamy whisky, ale zimny polski browar w upale smakuje po królewsku!'],
      bloto: ['Podwinąć kilt i w błoto! Żadne nogawki się nie ubrudzą, czysty spryt!'],
      koncert: ['Góralski temperament budzi się przy każdym uderzeniu stopy perkusyjnej!'],
      kibel: ['Kilt ułatwia szybkie załatwienie sprawy w toi-toiu, zero walki z zamkiem!'],
      deszcz: ['Deszcz w Szkocji to codzienność, więc ten kapuśniaczek to dla mnie czyste słońce!'],
    },
    genericCatchphrases: [
      'Wolność i przewiewność ponad wszystko!',
      'Nie pytaj, co mam pod kiltami – zapytaj, na który koncert idziemy!',
    ],
  },

  '026_bubble_blower_hippie': {
    name: 'Bańkarka Hipiska',
    title: 'Czarodziejka Mydlanych Baniek',
    voiceSettings: { pitch: 1.32, rate: 1.0, volume: 1.0, gender: 'female' },
    greetings: [
      'Cześć kochana duszo! Złap bańkę i pomyśl życzenie pełne pokoju!',
      'Hej! Świat widziany przez tęczową powłokę mydlanej bańki jest o wiele piękniejszy!',
      'Siemanko wędrowcze! Puszczam uśmiechy w powietrze, weź jeden dla siebie!',
    ],
    identity: [
      'Puszczam gigantyczne bańki nad tłumem. Każda bańka niesie spokój, uśmiech i ulgę dla zmęczonych słońcem ludzi.',
      'Jestem festiwalową wróżką baniek. Magia prostych rzeczy ratuje ten świat od szarości.',
    ],
    festivalLore: {
      ciemno: [
        'Gdy robi się ciemno, w bańkach odbijają się kolorowe reflektory sceny. ZAMKNIJ SIĘ i podziwiaj!',
      ],
      pole: ['Nasz obóz jest pełen tęczowych refleksów, bańki płyną z wiatrem ku niebu.'],
      piwo: ['Płyn do baniek trzymam w osobnym kubku – nie pomyl go z lemoniadą!'],
      bloto: ['Bańki pękające na błocie tworzą śmieszne miniaturowe kraterki!'],
      koncert: ['Wysyłam bańki w stronę sceny, muzycy uwielbiają ten widok z góry!'],
      kibel: ['Woda i mydło to moi najlepsi przyjaciele, dbajmy o czyste dłonie!'],
      deszcz: ['W deszczu bańki żyją dłużej, bo kropelki nie przebijają ich delikatnej powłoki!'],
    },
    genericCatchphrases: [
      'Bądź jak bańka – unoś się lekko i lśnij wszystkimi kolorami!',
      'Pokój, miłość i mnóstwo mydlanych baniek dla każdego!',
    ],
  },

  '071_biker_beard_leather': {
    name: 'Brodaty Motocyklista',
    title: 'Weteran Szos i Ciężkiego Brzmienia',
    voiceSettings: { pitch: 0.72, rate: 0.88, volume: 1.0 },
    greetings: [
      'Czołem. Maszyny zaparkowane, silniki stygną, czas na porządny kawałek rocka.',
      'Siemanko. Przejechałem sześćset kilometrów na dwóch kołach, żeby poczuć ten klimat.',
      'Dzień dobry. Zapach benzyny, skóry i letniego kurzu – tak pachnie wolność.',
    ],
    identity: [
      'Ryczące silniki i ciężkie gitary to całe moje życie. Przyjeżdżam tu od trzydziestu lat i za nic nie zamieniłbym tego festiwalu.',
      'Broda siwieje, skórzana kamizelka ma setki naszywek, ale serce bije w rytmie dwusuwa.',
    ],
    festivalLore: {
      ciemno: ['ZAMKNIJ SIĘ... noc na pasie startowym ma swój niepowtarzalny urok.'],
      pole: ['Mamy tu porządek i szacunek. Motocykliści pilnują obozu jak własnego garażu.'],
      piwo: ['Jedno zimne piwko wieczorem po zgaszeniu silnika to najświętszy rytuał szosy.'],
      bloto: ['Błoto pod kołami to walka o przetrwanie, ale na piechotę można iść prosto w tłum.'],
      koncert: ['Ciężkie riffy z Dużej Sceny brzmią jak ryk silnika V-Twin na pełnych obrotach.'],
      kibel: ['Kultura musi być – zdejmij rękawice i zachowaj czystość w kabinie.'],
      deszcz: ['Dla motocyklisty deszcz to chleb powszedni, kombinezon przeciwdeszczowy zawsze w sakwie.'],
    },
    genericCatchphrases: [
      'Lewa w górę dla każdego dobrego człowieka na tym polu.',
      'Szacunek na drodze i szacunek pod sceną – to moja jedyna dewiza.',
    ],
  },

  '087_neon_raver': {
    name: 'Świetlisty Rejwer',
    title: 'Mistrz Neonowych Nocy',
    voiceSettings: { pitch: 1.18, rate: 1.25, volume: 1.0 },
    greetings: [
      'Światło, dźwięk, neony! Czujesz ten bas pulsujący w klatce piersiowej?!',
      'Hejka! Weź glowsticka, złam, potrząśnij i machaj w rytm muzyki!',
      'Siemanko! Dla mnie noc dopiero się rozkręca, energia na tysiąc procent!',
    ],
    identity: [
      'Dla mnie festiwal zaczyna się po zachodzie słońca! Świecę w ciemności, tańczę do utraty tchu i zarażam światłem każdego w promieniu stu metrów!',
      'Glowsticki, ultrafiolet, okulary LED i najszybsze bity na lotnisku. Nie zatrzymuję się!',
    ],
    festivalLore: {
      ciemno: ['ZARAZ BĘDZIE CIEMNO? TO NASZ CZAS! ZAMKNIJ SIĘ I WŁĄCZAJ FLUORYZACJĘ!'],
      pole: ['Po zmroku nasz namiot widać z kosmosu dzięki neonowym girlandom.'],
      piwo: ['Dużo wody z elektrolitami, a browar na rozluźnienie nóg po tanecznym maratonie!'],
      bloto: ['Fluorescencyjne bransoletki wrzucone w kałużę robią kosmiczny efekt!'],
      koncert: ['Syntezatory, bębny, światła laserowe – to jest mój absolutny żywioł!'],
      kibel: ['Świecący w ciemności brelok przy kluczach to jedyny sposób, by nie zgubić ich w toi-toiu!'],
      deszcz: ['Krople deszczu odbijające lasery wyglądają jak wodospad gwiazd!'],
    },
    genericCatchphrases: ['Niech żyje światło w środku nocy!', 'Rytm, taniec i niekończąca się euforia!'],
  },

  '090_punk_mohawk': {
    name: 'Punk z Irokezem',
    title: 'Irokez z Pierwszej Linii Barierek',
    voiceSettings: { pitch: 0.98, rate: 1.26, volume: 1.0 },
    greetings: [
      "Punk's not dead! Siema załogo! Postawiłem irokeza na piwo z cukrem, trzyma się jak ze stali!",
      'OI! OI! Masz agrafkę? Bo mi naszywka odlatuje w młynie!',
      'Czołem załoganci! Kto nie skacze, ten z policji, ogień pod sceną!',
    ],
    identity: [
      'Stawiam irokeza na każdym festiwalu od lat. Bez buntu, bez punka i bez szacunku dla drugiego człowieka ten świat byłby niczym!',
      'Jestem irokezem z pierwszej linii. Moje glany widziały więcej koncertów niż niejeden krytyk muzyczny!',
    ],
    festivalLore: {
      ciemno: ['ZAMKNIJ SIĘ! PUNK NIGDY NIE ŚPI, PUNK ROBI MŁYN POD BARIERKAMI!'],
      pole: ['Pole to nasza komuna wolności – dzielimy się wszystkim, co mamy.'],
      piwo: ['Zimne piwko to paliwo dla gardła po dwóch godzinach śpiewania z kapelą!'],
      bloto: ['Prawdziwy irokez przetrwa nawet nurkowanie w błotnej mazi, lakier trzyma!'],
      koncert: ['Za chwilę zaczyna się najostrzejszy set dnia, zrobimy kocioł stulecia!'],
      kibel: ['Szybko, sprawnie i wracamy pod głośniki, szkoda każdej minuty koncertu!'],
      deszcz: ['Deszcz zmywa kurz, ale punka z serca nie zmyje nic!'],
    },
    genericCatchphrases: [
      'Bądź sobą, myśl samodzielnie i nie daj się zaszufladkować!',
      'Głośniej, szybciej, do samego końca!',
    ],
  },
};

/**
 * Pamięć podręczna dla dynamicznie generowanych profili modeli 3D tłumu.
 */
const DYNAMIC_PERSONAS_CACHE = new Map<string, NpcPersona>();

/**
 * Heurystyczny analizator modelu 3D:
 * Bada nazwę, identyfikator pliku GLB lub rolę bota i tworzy dla niego w 100% spersonalizowaną,
 * unikalną postać z dopasowanym głosem (pitch, rate), historią i odpowiedziami lore.
 */
export function analyzeModelPersonality(modelIdOrName: string): NpcPersona {
  const normalizedKey = modelIdOrName.toLowerCase().trim();
  if (DYNAMIC_PERSONAS_CACHE.has(normalizedKey)) {
    return DYNAMIC_PERSONAS_CACHE.get(normalizedKey)!;
  }

  // Oczyszczenie nazwy: usuwamy prefiksy numeryczne ('054_'), rozszerzenia ('.glb') i znaki specjalne:
  const cleanTokens = normalizedKey
    .replace(/\.glb$/i, '')
    .replace(/^\d+[_-\s]*/, '')
    .replace(/[_-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  const cleanString = cleanTokens.join(' ');

  const isFemale =
    /\b(girl|woman|lady|female|dziewczyna|kobieta|tancerka|hipiska|kosmitka|korsarka|wojowniczka|bankarka|curly|boho|crown|poncho|braided|bun|shorts)\b/i.test(
      normalizedKey + ' ' + cleanString,
    ) ||
    normalizedKey.includes('girl') ||
    normalizedKey.includes('korba');

  // Domyślny profil bazowy:
  let personaName =
    cleanTokens.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') ||
    (isFemale ? 'Festiwalowiczka' : 'Festiwalowicz');
  let title = isFemale ? "Bywalczyni Pol'and'Rock" : "Bywalec Pol'and'Rock";
  let pitch = isFemale ? 1.32 : 0.94;
  let rate = 1.0;
  let greetings: string[] = [
    'Siemanko! Piękny dzień na festiwalu, prawda?',
    'Cześć! Super cię widzieć w tym tłumie pozytywnych ludzi.',
    'Hej! Cieszysz się muzyką tak samo jak ja?',
  ];
  let identity: string[] = [
    isFemale
      ? `Nazywają mnie ${personaName}. Przyjechałam na Czaplinek, by chłonąć muzykę, wolność i niezwykłą energię tego miejsca.`
      : `Nazywają mnie ${personaName}. Przyjechałem na Czaplinek, by chłonąć muzykę, wolność i niezwykłą energię tego miejsca.`,
    isFemale
      ? `Jestem jedną z setek tysięcy uczestniczek Najpiękniejszego Festiwalu Świata. Każdy z nas tworzy ten klimat!`
      : `Jestem jednym z setek tysięcy uczestników Najpiękniejszego Festiwalu Świata. Każdy z nas tworzy ten klimat!`,
  ];
  let customDarkReply = 'ZAMKNIJ SIĘ! Klasyka gatunku, która łączy pokolenia!';
  let customMudReply = "Błoto na Pol'and'Rocku to nasza druga natura, wskakuj śmiało!";
  const customBeerReply = 'Zimny napój w cieniu namiotu to najlepsze orzeźwienie po koncercie.';

  // Reguły analizy wizualno-semantycznej:
  if (
    cleanString.includes('alien') ||
    cleanString.includes('kosmit') ||
    cleanString.includes('space') ||
    cleanString.includes('ufo')
  ) {
    personaName = 'Kosmiczny Festiwalowicz';
    title = 'Przybysz z Gwiazd';
    pitch = 1.3;
    rate = 1.08;
    greetings = [
      'Pozdrowienia z odległej galaktyki, Ziemianinie!',
      'Wasze fale dźwiękowe dotarły do naszych radarów kosmicznych!',
    ];
    identity = ['Przyleciałem z kosmosu zwabiony potęgą ziemskiego rocka i ideą miłości i tolerancji.'];
    customDarkReply = 'W przestrzeni kosmicznej ciemność panuje wiecznie! ZAMKNIJ SIĘ!';
    customMudReply = 'Wasze ziemskie błoto to wspaniały materiał geologiczny do tańca!';
  } else if (
    cleanString.includes('hotdog') ||
    cleanString.includes('sausage') ||
    cleanString.includes('parowk')
  ) {
    personaName = 'Festiwalowy Hotdog';
    title = 'Maskotka Gastronomii Polowej';
    pitch = 1.15;
    rate = 1.18;
    greetings = [
      'Siemanko! Parówka gotowa na największe pogo w dziejach!',
      'Cześć! Kto powiedział, że jedzenie nie potrafi tańczyć do rocka?',
    ];
    identity = [
      'Założyłem ten kostium dla żartu, a teraz jestem najpopularniejszym obiektem do selfie na pasie startowym!',
    ];
    customDarkReply = 'ZAMKNIJ SIĘ! Bo musztarda ci w ciemności skapnie na koszulkę!';
  } else if (cleanString.includes('frog') || cleanString.includes('zaba') || cleanString.includes('zabol')) {
    personaName = 'Żabol';
    title = 'Mistrz Żabich Skoków';
    pitch = 0.8;
    rate = 1.1;
    greetings = [
      'Kum-kum! Siema! Gdzie jest najbliższa kałuża do skakania?',
      'Rechot na cały obóz! Skaczemy razem pod sceną!',
    ];
    identity = ['W zielonym kostiumie płaza czuję się wolny jak żaba w stawie!'];
    customMudReply = 'Błoto to mój żywioł, wskakuj ze mną na główkę!';
  } else if (
    cleanString.includes('knight') ||
    cleanString.includes('rycerz') ||
    cleanString.includes('armor') ||
    cleanString.includes('cosplay')
  ) {
    personaName = 'Festiwalowy Rycerz';
    title = 'Obrońca Złotej Wolności';
    pitch = 0.88;
    rate = 0.95;
    greetings = [
      'Niechaj gitary grają na twoją cześć, szlachetny wędrowcze!',
      'Czołem! Moja zbroja lśni w słońcu Czaplinka!',
    ];
    identity = [
      'Rycerz na festiwalu rockowym? Owszem! Bronię barierki i niosę etos rycerskiego szacunku w młynie!',
    ];
    customDarkReply = 'ZAMKNIJ SIĘ, waszmość! Niechaj muzyka rozproszy wszelką trwogę!';
  } else if (
    cleanString.includes('mud') ||
    cleanString.includes('bloto') ||
    cleanString.includes('monster') ||
    cleanString.includes('slide') ||
    cleanString.includes('bath')
  ) {
    personaName = 'Błotny Pływak';
    title = 'Koneser Błotnych Ślizgów';
    pitch = 0.7;
    rate = 0.85;
    greetings = [
      'Bulgot... cześć! Jak ci się podoba stan mojej festiwalowej powłoki?',
      'Siemanko! Jeśli twoje buty są jeszcze czyste, natychmiast chodź ze mną pod grzybek!',
    ];
    identity = ['Nie uznaję festiwalu bez porządnej kąpieli w błocie. To esencja woodstockowego szaleństwa!'];
    customMudReply = 'Błoto to zbroja, błoto to tradycja, błoto to wieczna młodość!';
  } else if (
    cleanString.includes('pirate') ||
    cleanString.includes('parrot') ||
    cleanString.includes('korsarz')
  ) {
    personaName = 'Pirat z Czaplinka';
    title = 'Korsarz Festiwalowych Mórz';
    pitch = 1.08;
    rate = 1.12;
    greetings = [
      'Ahoj kamracie! Jak tam wiatr w żaglach twojego namiotu?',
      'Arrr! Spójrz na tę rzekę ludzi płynącą ku scenie!',
    ];
    identity = ['Pływam po polach namiotowych szukając najgłośniejszych dźwięków i najweselszych załóg.'];
    customDarkReply = 'ZAMKNIJ SIĘ! Albo rzucę cię rekinom z Dużej Sceny na pożarcie!';
  } else if (cleanString.includes('kilt') || cleanString.includes('szkot')) {
    personaName = 'Załogant w Kilcie';
    title = 'Trubadur w Szkockiej Kracie';
    pitch = 0.95;
    rate = 1.04;
    greetings = [
      'Fàilte! Siema! W kiltach pogo ma zupełnie inny wymiar!',
      'Cześć! Wygoda i rockowy styl w jednym, polecam każdemu!',
    ];
    identity = [
      'Kilt to najlepszy festiwalowy ubiór – nic nie krępuje ruchów podczas skakania pod barierami.',
    ];
  } else if (
    cleanString.includes('punk') ||
    cleanString.includes('mohawk') ||
    cleanString.includes('spikes') ||
    cleanString.includes('combat') ||
    cleanString.includes('choker')
  ) {
    personaName = 'Punkowy Załogant';
    title = 'Bojownik o Wolność i Równość';
    pitch = 0.96;
    rate = 1.24;
    greetings = [
      'Oi! Oi! Gotowy na ścianę śmierci pod sceną?',
      "Punk's not dead! Siema, trzymaj fason i skacz z nami!",
    ];
    identity = [
      'Dla mnie punk to nie tylko ostra muzyka, to braterstwo, sprzeciw wobec zła i wzajemna pomoc.',
    ];
    customDarkReply = 'ZARAZ BĘDZIE CIEMNO! ZAMKNIJ SIĘ! I OGIŃ W POGO!';
  } else if (
    cleanString.includes('metal') ||
    cleanString.includes('heavy') ||
    cleanString.includes('banger')
  ) {
    personaName = 'Prawdziwy Metalfan';
    title = 'Władca Headbangingu';
    pitch = 0.76;
    rate = 0.98;
    greetings = [
      'Horns up! Czołem bracie w ciężkim brzmieniu!',
      'Siemanko! Szykuj kark, wieczorem gitary urwą nam głowy!',
    ];
    identity = [
      "Żyję ciężkim riffem, podwójną stopą i potężnym wokalem. Pol'and'Rock daje najlepszą dawkę czystej metalowej energii!",
    ];
    customDarkReply = 'ZAMKNIJ SIĘ! W ciemności ognie pirotechniki na scenie wyglądają potężniej!';
  } else if (
    cleanString.includes('biker') ||
    cleanString.includes('leather') ||
    cleanString.includes('beard') ||
    cleanString.includes('motor')
  ) {
    personaName = 'Stary Motocyklista';
    title = 'Jeździec Polskich Szos';
    pitch = 0.74;
    rate = 0.9;
    greetings = [
      'Czołem na trasie. Silnik stygnie, czas na muzykę.',
      'Siemanko. Dwieście kilometrów na kołach i wreszcie w domu – na festiwalu.',
    ];
    identity = [
      'Wiatr we włosach i rock w głośnikach. Przejechałem pół Europy, ale Czaplinek ma w sobie coś niepowtarzalnego.',
    ];
  } else if (
    cleanString.includes('raver') ||
    cleanString.includes('neon') ||
    cleanString.includes('glowstick') ||
    cleanString.includes('glitter') ||
    cleanString.includes('mesh')
  ) {
    personaName = 'Świetlny Rejwer';
    title = 'Tancerz Festiwalowych Świateł';
    pitch = 1.2;
    rate = 1.22;
    greetings = [
      'Hejka! Weź trochę brokatu i świećmy razem w nocy!',
      'Siemanko! Czujesz jak bas wibruje pod podeszwami?',
    ];
    identity = [
      'Dla mnie muzyka to ruch, taniec i kolory. Świecę neonami, by rozjaśniać każdą festiwalową noc!',
    ];
    customDarkReply = 'ZARAZ BĘDZIE CIEMNO? TO WŁĄCZAMY LASERY! ZAMKNIJ SIĘ!';
  } else if (
    cleanString.includes('hippie') ||
    cleanString.includes('tiedye') ||
    cleanString.includes('peace') ||
    cleanString.includes('flower') ||
    cleanString.includes('boho') ||
    cleanString.includes('shaman') ||
    cleanString.includes('dread') ||
    cleanString.includes('feather')
  ) {
    personaName = 'Dziecko Kwiatów';
    title = 'Głos Pokoju i Miłości';
    pitch = 1.12;
    rate = 0.96;
    greetings = [
      'Pokój i miłość! Uśmiechnij się do świata, a świat uśmiechnie się do ciebie.',
      'Cześć piękny człowieku! Niech dobra energia prowadzi cię przez ten dzień.',
    ];
    identity = [
      'Kultywuję najwspanialszą tradycję Woodstocku z 1969 roku: miłość, przyjaźń, szacunek do natury i bezgraniczna wolność.',
    ];
    customDarkReply = 'ZAMKNIJ SIĘ! Ale spójrz w górę, gwiazdy nad lotniskiem świecą dla każdego z nas.';
  } else if (
    cleanString.includes('guitar') ||
    cleanString.includes('songster') ||
    cleanString.includes('troubadour') ||
    cleanString.includes('acoustic')
  ) {
    personaName = isFemale ? 'Obozowa Bardka' : 'Obozowy Bard';
    title = isFemale ? 'Gitarzystka Ogniskowa' : 'Gitarzysta Ogniskowy';
    pitch = isFemale ? 1.3 : 1.02;
    rate = 1.0;
    greetings = [
      'Siemanko! Znasz chwyty do Wehikułu Czasu? Zaraz możemy zagrać!',
      'Cześć! Gitara nastrojona, palce rozgrzane, śpiewamy razem!',
    ];
    identity = [
      'Chodzę z gitarą od namiotu do namiotu. D-dur, e-moll i cały obóz śpiewa jednym głosem do świtu!',
    ];
  } else if (
    cleanString.includes('totem') ||
    cleanString.includes('flag') ||
    cleanString.includes('waver') ||
    cleanString.includes('cape')
  ) {
    personaName = 'Chorąży Obozu';
    title = 'Strażnik Festiwalowego Totemu';
    pitch = 1.0;
    rate = 1.05;
    greetings = [
      'Czołem! Trzymam totem wysoko, żeby nikt z naszej ekipy nie zgubił drogi do domu!',
      'Siemanko! Nasza flaga powiewa dumnie nad całym sektorem!',
    ];
    identity = [
      'Festiwalowy totem to latarnia morska na wzburzonym oceanie namiotów. Prowadzę zagubionych prosto do przyjaciół!',
    ];
  } else if (cleanString.includes('bubble')) {
    personaName = 'Artysta Mydlanych Baniek';
    title = 'Kreator Radości';
    pitch = 1.2;
    rate = 1.02;
    greetings = [
      'Złap bańkę! W każdej jest ukryty uśmiech!',
      'Hej! Kolory na niebie tworzą najpiękniejszy spektakl!',
    ];
    identity = [
      'Wypuszczam setki wielkich baniek w niebo nad publicznością, by dawać ludziom czystą, dziecięcą radość.',
    ];
  }

  const finalPitch = isFemale ? Math.max(1.26, Math.min(1.55, pitch < 1.15 ? pitch * 1.32 : pitch)) : pitch;

  const dynamicPersona: NpcPersona = {
    name: personaName,
    title,
    voiceSettings: {
      pitch: finalPitch,
      rate,
      volume: 1.0,
      gender: isFemale ? 'female' : 'male',
    },
    greetings,
    identity,
    festivalLore: {
      ciemno: [customDarkReply],
      pole: [
        'To pole to nasze wspólne dobro! Trzymajmy się razem i dbajmy o porządek.',
        'Wszyscy jesteśmy tu gospodarzami dobrej atmosfery!',
      ],
      piwo: [customBeerReply],
      bloto: [customMudReply],
      koncert: [
        "Muzyka na żywo na Pol'and'Rocku to coś, czego nie da się opisać słowami – to trzeba przeżyć!",
        'Leć pod scenę, tam dzieje się prawdziwa magia tego festiwalu!',
      ],
      kibel: ['Toi-toie stoją w wyznaczonych sektorach, szanujmy pracę serwisu i kolejkę!'],
      deszcz: ['Niezależnie od pogody, duch tego festiwalu nigdy nie gaśnie!'],
    },
    genericCatchphrases: [
      'Miłość, przyjaźń, muzyka – to jedyne zasady, które tu obowiązują!',
      'Ciesz się każdą chwilą na tym festiwalu, bo te dni mijają za szybko!',
    ],
  };

  DYNAMIC_PERSONAS_CACHE.set(normalizedKey, dynamicPersona);
  return dynamicPersona;
}

/**
 * Rozpoznaje intencję wypowiedzi gracza i dopasowuje odpowiedź bota.
 */
export class NpcAiAgent {
  /**
   * Zwraca znormalizowaną postać tekstu do analizy regułowej.
   */
  private static sanitizeInput(input: string): string {
    return input
      .toLowerCase()
      .trim()
      .replace(/[.,/#!$%^&*;:{}=\-_`~()?'"„”]/g, '')
      .replace(/\s+/g, ' ');
  }

  /**
   * Odnajduje profil persony na podstawie podanej nazwy NPC lub identyfikatora modelu.
   * Wspiera:
   * 1. 8 kanonicznych bohaterów (Pień, Amper, Antena, Gruczoł, Klątwa, Krwiak, Pierścień, Zawór)
   * 2. 8 rozszerzonych bohaterów (Ambona, Chlebak, Dziąsło, Hemoroid, Jęczmień, Kobra, Korba, Szerszeń)
   * 3. Modele sygnaturowe (050_blue_alien_girl, 082_hotdog_girl, 086_mud_monster, itp.)
   * 4. Dynamiczny analizator cech wizualnych dla dowolnego innego modelu w grze.
   */
  static getPersona(name: string): NpcPersona {
    const rawName = name.trim();
    const lowerName = rawName.toLowerCase();

    // 1. Sprawdzenie bezpośrednie w głównych personach:
    if (NPC_PERSONAS[rawName]) return NPC_PERSONAS[rawName];

    // 2. Sprawdzenie w rozszerzonych bohaterach:
    if (EXTENDED_HERO_PERSONAS[rawName]) return EXTENDED_HERO_PERSONAS[rawName];

    // 3. Sprawdzenie w modelach sygnaturowych:
    if (SIGNATURE_MODEL_PERSONAS[rawName]) return SIGNATURE_MODEL_PERSONAS[rawName];

    // 4. Sprawdzenie częściowe w NPC_PERSONAS (np. 'Pień aka Peposz' -> 'Pień'):
    for (const [key, persona] of Object.entries(NPC_PERSONAS)) {
      if (lowerName.includes(key.toLowerCase()) || key.toLowerCase().includes(lowerName)) {
        return persona;
      }
    }

    // 5. Sprawdzenie częściowe w EXTENDED_HERO_PERSONAS:
    for (const [key, persona] of Object.entries(EXTENDED_HERO_PERSONAS)) {
      if (lowerName.includes(key.toLowerCase()) || key.toLowerCase().includes(lowerName)) {
        return persona;
      }
    }

    // 6. Sprawdzenie częściowe w SIGNATURE_MODEL_PERSONAS (np. 'blue alien' -> '050_blue_alien_girl'):
    for (const [key, persona] of Object.entries(SIGNATURE_MODEL_PERSONAS)) {
      const cleanKey = key.replace(/^\d+[_-\s]*/, '').replace(/_/g, ' ');
      if (
        lowerName.includes(key.toLowerCase()) ||
        key.toLowerCase().includes(lowerName) ||
        lowerName.includes(cleanKey.toLowerCase()) ||
        cleanKey.toLowerCase().includes(lowerName) ||
        lowerName.includes(persona.name.toLowerCase()) ||
        persona.name.toLowerCase().includes(lowerName)
      ) {
        return persona;
      }
    }

    // 7. Dynamiczna analiza cech modelu na podstawie nazwy lub id pliku GLB:
    return analyzeModelPersonality(rawName);
  }

  /**
   * Wyciąga rdzeń tematu / zapytania z tekstu gracza do naturalnej wypowiedzi.
   */
  private static extractSubject(rawInput: string): string {
    return rawInput
      .trim()
      .replace(/[?!.„”"']/g, '')
      .replace(/^(czy|powiedz mi|jak myslisz|jak myślisz|co sadzisz|co sądzisz|powiedz|co to jest|a co z|a)\s+/i, '')
      .trim();
  }

  /**
   * Generuje odpowiedź dialogową AI na podstawie wypowiedzi gracza, charakteru NPC oraz kontekstu rozmowy.
   */
  static generateResponse(
    npcName: string,
    playerInput: string,
    context?: NpcDialogueContext,
  ): NpcDialogueResponse {
    const persona = this.getPersona(npcName);
    const text = this.sanitizeInput(playerInput);

    if (!text || text.length === 0) {
      const greeting = persona.greetings[Math.floor(Math.random() * persona.greetings.length)];
      return {
        text: greeting,
        topic: 'powitanie',
        voiceSettings: persona.voiceSettings,
      };
    }

    const lastNpc = (context?.lastNpcMessage || '').toLowerCase();
    const isSzerszen = persona.name.toLowerCase().includes('szerszeń');

    // 0A. Obsługa pytań o sektor 3, nocne akcje i plotki (Szerszeń & kontynuacja haczyka):
    const sectorHookActive =
      lastNpc.includes('sektorze trzecim') ||
      lastNpc.includes('sektorze 3') ||
      lastNpc.includes('sektor 3') ||
      lastNpc.includes('co się działo w nocy') ||
      lastNpc.includes('co sie dzialo w nocy');

    const asksAboutSectorOrNight =
      (text.includes('sektor') || text.includes('w nocy')) &&
      (text.includes('co') ||
        text.includes('dzialo') ||
        text.includes('stalo') ||
        text.includes('nie slyszalem') ||
        text.includes('nie słyszałem') ||
        text.includes('opowiadaj'));

    const szerszenGossipContinuation =
      isSzerszen &&
      (sectorHookActive ||
        text.includes('co sie dzialo') ||
        text.includes('co się działo') ||
        text.includes('co tam sie dzialo') ||
        text.includes('co tam się działo') ||
        text.includes('nie slyszalem') ||
        text.includes('nie słyszałem') ||
        text.includes('opowiadaj') ||
        text.includes('mow dalej') ||
        text.includes('mów dalej') ||
        text.includes('dawaj plotki') ||
        text.includes('jakie plotki') ||
        text.includes('a co sie tam') ||
        text.includes('a co tam'));

    if (sectorHookActive || asksAboutSectorOrNight || szerszenGossipContinuation) {
      const knows =
        (text.includes('slyszalem') ||
          text.includes('słyszałem') ||
          text.includes('wiem') ||
          text.includes('widzialem') ||
          text.includes('widziałem')) &&
        !text.includes('nie slyszalem') &&
        !text.includes('nie słyszałem') &&
        !text.includes('nie wiem');

      if (knows) {
        return {
          text: 'Wiedziałeś?! I nic nie mówiłeś?! Ja do teraz nie mogę uwierzyć, że ten traktorek ogrodowy w ogóle odpalił na rozcieńczonym bimbru z sokiem porzeczkowym!',
          topic: 'plotki',
          voiceSettings: persona.voiceSettings,
        };
      }

      return {
        text: 'Stary! O trzeciej nad ranem ktoś wjechał małym traktorkiem ogrodowym w pole namiotowe i zrobili tam nielegalne pogo na dwieście osób w kaskach budowlanych! Pokojowy Patrol do rana szukał tego traktorka, a okazało się, że zakamuflowali go pod plandeką jako stoisko z goframi!',
        topic: 'plotki',
        voiceSettings: persona.voiceSettings,
      };
    }

    // 0B. Reakcja na meta-dialog i uwagi gracza ("nie odpowiedziałeś", "odpowiedz mi na pytanie"):
    const isMetaComplaint =
      text.includes('nie odpowiedz') ||
      text.includes('nie odpowiedział') ||
      text.includes('nie odpowiedzial') ||
      text.includes('odpowiedz mi') ||
      text.includes('odpowiedz na pytanie') ||
      text.includes('nie odpowiadasz') ||
      text.includes('sluchasz mnie') ||
      text.includes('słuchasz mnie') ||
      text.includes('mowisz nie na temat') ||
      text.includes('mówisz nie na temat') ||
      text.includes('zmieniasz temat');

    if (isMetaComplaint) {
      let metaReply =
        'Wybacz, na tym festiwalu jest taki gwar i zamieszanie, że na chwilę uciekł mi wątek! Powtórz jeszcze raz, słucham cię uważnie!';
      if (isSzerszen) {
        metaReply =
          'Dobra, dobra, nie unoś się! W tym hałasie z Dużej Sceny i przy tylu plotkach czasem mi myśli uciekają! Zadaj pytanie jeszcze raz prosto z mostu, teraz słucham cię w stu procentach!';
      } else if (persona.name.includes('Dziąsło')) {
        metaReply =
          'Ej, młody, szacunku trochę dla starszych punków! Po czterdziestu latach stania przy głośnikach słuch już nie ten. Powtórz spokojnie, a weteran ci wszystko wyłoży!';
      } else if (persona.name.includes('Pień')) {
        metaReply =
          'Spokojnie, na moim polu nikt nikogo nie pogania. Wokół jest taki raban, że człowiek na moment odpłynie. Mów konkretnie, o co chodzi, a pogadamy po ludzku.';
      } else if (persona.name.includes('Chlebak')) {
        metaReply =
          'Sorki, zagapiłem się na pasztet turystyczny i zgubiłem wątek! Wal prosto z mostu, co chcesz wiedzieć?';
      } else if (persona.name.includes('Korba')) {
        metaReply =
          'Oj tam, oj tam, rozkojarzyłam się, bo ten bas tak niesamowicie porywa do tańca! Już jestem skupiona, mów śmiało!';
      } else if (persona.name.includes('Hemoroid')) {
        metaReply =
          'Nie krzycz tak na mnie, od stresu to mi się zaraz rwa kulszowa odezwie! Spokojnie, powtórz pytanie, nigdzie mi się na tym leżaku nie spieszy.';
      } else if (persona.name.includes('Jęczmień')) {
        metaReply =
          'Wybacz, kontemplowałem akurat aromat świeżo otwartej puszki chmielu! Już nadstawiam ucha, pytaj śmiało!';
      } else if (persona.name.includes('Kobra')) {
        metaReply =
          'Skupienie to podstawa, racja, zagapiłem się na kocioł pod sceną. Dawaj jeszcze raz, teraz pełna koncentracja!';
      } else if (persona.name.includes('Ambona')) {
        metaReply =
          'Przebacz roztargnienie słudze rocka, w modlitewnym uniesieniu umknęły mi twe słowa! Rzecz jeszcze raz, a odpowiem godnie!';
      }

      return {
        text: metaReply,
        topic: 'ogolne',
        voiceSettings: persona.voiceSettings,
      };
    }

    // 0C. Kontekstowe kontynuacje powitań innych bohaterów:
    if (
      persona.name.includes('Chlebak') &&
      (lastNpc.includes('chlebak') ||
        lastNpc.includes('kabanos') ||
        lastNpc.includes('pasztet') ||
        lastNpc.includes('głodny') ||
        lastNpc.includes('glodny') ||
        lastNpc.includes('prowiant'))
    ) {
      if (
        text.includes('tak') ||
        text.includes('daj') ||
        text.includes('poprosze') ||
        text.includes('poproszę') ||
        text.includes('chce') ||
        text.includes('chcę') ||
        text.includes('glodny') ||
        text.includes('głodny') ||
        text.includes('kabanos')
      ) {
        return {
          text: 'Trzymaj kabanosa i suchara wojskowego! Gryź powoli, bo twardy jak podeszwa glana, ale energii da ci do samego rana pod sceną!',
          topic: 'piwo',
          voiceSettings: persona.voiceSettings,
        };
      }
      if (
        text.includes('nie') ||
        text.includes('dzieki') ||
        text.includes('dzięki') ||
        text.includes('najadlem') ||
        text.includes('najadłem')
      ) {
        return {
          text: 'Szanuję, ale jak o północy pod sceną zacznie ci burczeć w brzuchu, to wiesz pod którą plandeką stacjonuje Chlebak ze swoją spiżarnią!',
          topic: 'piwo',
          voiceSettings: persona.voiceSettings,
        };
      }
    }

    if (
      persona.name.includes('Dziąsło') &&
      (lastNpc.includes('jarocin') ||
        lastNpc.includes('zęby') ||
        lastNpc.includes('zeby') ||
        lastNpc.includes('szczerbatym'))
    ) {
      if (
        text.includes('jak') ||
        text.includes('opowiedz') ||
        text.includes('jarocin') ||
        text.includes('zeb') ||
        text.includes('zęb') ||
        text.includes('co sie stalo') ||
        text.includes('co się stało') ||
        text.includes('pogo')
      ) {
        return {
          text: "W '88 na małej scenie grali z taką energią, że barierki gięły się jak z plasteliny! Wpadłem w pogo w pożyczonej ramonesce, ktoś machnął glanem i cyk – dwa siekacze poszły w trawę! Ale koncert dokończyłem pod samymi głośnikami!",
          topic: 'koncert',
          voiceSettings: persona.voiceSettings,
        };
      }
    }

    // 0D. Pytania o nawigację i punkty festiwalu ("Gdzie jest..."):
    if (
      text.includes('gdzie') ||
      text.includes('jak dojsc') ||
      text.includes('jak dojść') ||
      text.includes('ktoredy') ||
      text.includes('którędy')
    ) {
      if (text.includes('scen') || text.includes('koncert')) {
        return {
          text: 'Duża Scena jest prosto wzdłuż głównego pasa startowego na wschód! Idź po prostu za potężnym basem i tłumem, nie da się jej minąć!',
          topic: 'koncert',
          voiceSettings: persona.voiceSettings,
        };
      }
      if (
        text.includes('asp') ||
        text.includes('sztuk') ||
        text.includes('wzgorz') ||
        text.includes('wzgórz')
      ) {
        return {
          text: 'Akademia Sztuk Przepięknych jest na wzgórzu! Od rana trwają tam świetne debaty, warsztaty i spotkania z gośćmi, niesamowity klimat!',
          topic: 'ogolne',
          voiceSettings: persona.voiceSettings,
        };
      }
      if (
        text.includes('sklep') ||
        text.includes('market') ||
        text.includes('biedronk') ||
        text.includes('zakup')
      ) {
        return {
          text: 'Polowy market jest przy północnym wejściu na pas startowy. Tylko weź ze sobą cierpliwość, bo kolejki bywają legendarne!',
          topic: 'ogolne',
          voiceSettings: persona.voiceSettings,
        };
      }
      if (
        text.includes('medyk') ||
        text.includes('pomoc') ||
        text.includes('patrol') ||
        text.includes('lekarz')
      ) {
        return {
          text: 'Namioty Pokojowego Patrolu i ratowników medycznych stoją co kawałek wzdłuż pasa – szukaj czerwonych i żółtych oznaczeń, zawsze pomogą!',
          topic: 'ogolne',
          voiceSettings: persona.voiceSettings,
        };
      }
    }

    // 0E. Plotki, ciekawostki, "co słychać", "co nowego":
    const hasSpecificTopic =
      text.includes('bloto') ||
      text.includes('błoto') ||
      text.includes('piw') ||
      text.includes('kibel') ||
      text.includes('toi') ||
      text.includes('ciemno') ||
      text.includes('scena');

    if (
      !hasSpecificTopic &&
      (text.includes('co slychac') ||
        text.includes('co słychać') ||
        text.includes('co tam') ||
        text.includes('co nowego') ||
        text.includes('jak leci') ||
        text.includes('jak tam') ||
        text.includes('plotk'))
    ) {
      if (isSzerszen) {
        return {
          text: 'Szerszeń na posterunku! Krążę po obozie, podsłuchuję i łapię najświeższe plotki. Dzieje się tyle, że głowa mała, a wieczorem ma być tajny gość na Dużej Scenie!',
          topic: 'plotki',
          voiceSettings: persona.voiceSettings,
        };
      }
      if (persona.name.includes('Pień')) {
        return {
          text: 'Na moim polu wszystko pod kontrolą! Namioty stoją stabilnie, ludzie się bawią, a pogoda dopisuje. Żyć nie umierać!',
          topic: 'pole',
          voiceSettings: persona.voiceSettings,
        };
      }
      if (persona.name.includes('Korba')) {
        return {
          text: 'Energia na tysiąc procent! Zaraz lecę kręcić piruety pod scenę, dołączasz ze mną do zabawy?!',
          topic: 'koncert',
          voiceSettings: persona.voiceSettings,
        };
      }
      return {
        text: 'Klimat jest niesamowity! Muzyka gra, ludzie uśmiechnięci i życzliwi – to są najpiękniejsze dni w całym roku!',
        topic: 'ogolne',
        voiceSettings: persona.voiceSettings,
      };
    }

    // 0F. Krótkie odpowiedzi konwersacyjne (tak / nie / nie wiem):
    const isAffirmation =
      text === 'tak' ||
      text === 'jasne' ||
      text === 'pewnie' ||
      text === 'dokladnie' ||
      text === 'dokładnie' ||
      text === 'no' ||
      text === 'racja' ||
      text === 'no jasne' ||
      text === 'no pewnie';

    if (isAffirmation) {
      const affirmReply = isSzerszen
        ? 'Wiedziałem, że nadajemy na tych samych falach! Na tym festiwalu od razu poznasz swój obóz!'
        : persona.name.includes('Pień')
          ? 'I to mi się podoba, krótko i na temat! Trzymajmy się razem na naszym polu!'
          : 'Jasna sprawa! Na tym festiwalu wszyscy jedziemy na jednym wózku i trzymamy wspólny front!';
      return { text: affirmReply, topic: 'ogolne', voiceSettings: persona.voiceSettings };
    }

    const isNegation =
      text === 'nie' ||
      text === 'nigdy' ||
      text === 'nie ma mowy' ||
      text === 'bzdura' ||
      text === 'nie zgadzam sie' ||
      text === 'nie zgadzam się';

    if (isNegation) {
      const negationReply = isSzerszen
        ? 'Eee tam, nie znasz się albo za krótko tu jesteś! Zobaczysz jeszcze do niedzieli, jak to wygląda!'
        : "Nie to nie, przymusu nie ma – na Pol'and'Rocku wolność i własne zdanie to podstawa!";
      return { text: negationReply, topic: 'ogolne', voiceSettings: persona.voiceSettings };
    }

    if (
      text.includes('nie wiem') ||
      text.includes('nie mam pojecia') ||
      text.includes('nie mam pojęcia') ||
      text.includes('ciezko powiedziec') ||
      text.includes('ciężko powiedzieć')
    ) {
      return {
        text: 'Na tym polega magia tego festiwalu – nikt nic nie wie na pewno, a i tak wszystko wychodzi niesamowicie!',
        topic: 'ogolne',
        voiceSettings: persona.voiceSettings,
      };
    }

    // 0G. Podziękowania i pożegnania:
    if (
      text.includes('dzieki') ||
      text.includes('dzięki') ||
      text.includes('dziekuje') ||
      text.includes('dziękuję') ||
      text === 'thx'
    ) {
      return {
        text: 'Nie ma za co, na tym polu wszyscy jesteśmy jedną wielką rodziną!',
        topic: 'ogolne',
        voiceSettings: persona.voiceSettings,
      };
    }

    if (
      text.includes('nara') ||
      text.includes('na razie') ||
      text.includes('pa') ||
      text.includes('do zobaczenia') ||
      text.includes('trzymaj sie') ||
      text.includes('trzymaj się') ||
      text.includes('lece') ||
      text.includes('lecę')
    ) {
      return {
        text: 'Trzymaj się i do zobaczenia pod sceną! Zaraz będzie ciemno!',
        topic: 'ogolne',
        voiceSettings: persona.voiceSettings,
      };
    }

    // 1. Kultowe festiwalowe zawołanie "Zaraz będzie ciemno":
    if (text.includes('ciemno') || text.includes('zaraz bedzie') || text.includes('zaraz będzie')) {
      const lore = persona.festivalLore.ciemno;
      const reply = lore ? lore[Math.floor(Math.random() * lore.length)] : 'ZAMKNIJ SIĘ!';
      return { text: reply, topic: 'ciemno', voiceSettings: persona.voiceSettings };
    }

    // 2. Hasło przewodnie obozu i pola ("Kurwa moje pole", "czyje pole", "pole"):
    if (
      text.includes('moje pole') ||
      text.includes('kurwa') ||
      text.includes('pole') ||
      text.includes('ziemia') ||
      text.includes('oboz') ||
      text.includes('obóz')
    ) {
      const lore = persona.festivalLore.pole;
      const reply = lore
        ? lore[Math.floor(Math.random() * lore.length)]
        : 'To jest nasze pole! Trzymajmy się razem!';
      return { text: reply, topic: 'pole', voiceSettings: persona.voiceSettings };
    }

    // 3. Pytania o tożsamość ("kim jesteś", "jak się nazywasz", "co robisz"):
    if (
      text.includes('kim jestes') ||
      text.includes('kim jesteś') ||
      text.includes('jak sie nazywasz') ||
      text.includes('jak się nazywasz') ||
      text.includes('co robisz') ||
      text.includes('twoje imie') ||
      text.includes('twoje imię')
    ) {
      const reply = persona.identity[Math.floor(Math.random() * persona.identity.length)];
      return { text: reply, topic: 'tozsamosc', voiceSettings: persona.voiceSettings };
    }

    // 4. Alkohol, piwo, gastronomia, jedzenie:
    if (
      text.includes('piw') ||
      text.includes('browar') ||
      text.includes('chmiel') ||
      text.includes('picie') ||
      text.includes('napoj') ||
      text.includes('napój') ||
      text.includes('jedzenie') ||
      text.includes('gastro') ||
      text.includes('glodny') ||
      text.includes('głodny')
    ) {
      const lore = persona.festivalLore.piwo;
      const reply = lore
        ? lore[Math.floor(Math.random() * lore.length)]
        : 'Zimny napój w cieniu to najlepsza rzecz na tym polu!';
      return { text: reply, topic: 'piwo', voiceSettings: persona.voiceSettings };
    }

    // 5. Błoto, kąpiele błotne, kałuża:
    if (
      text.includes('bloto') ||
      text.includes('błoto') ||
      text.includes('brudny') ||
      text.includes('kapiel')
    ) {
      const lore = persona.festivalLore.bloto;
      const reply = lore
        ? lore[Math.floor(Math.random() * lore.length)]
        : "Błoto na Pol'and'Rocku to tradycja, wskakuj śmiało!";
      return { text: reply, topic: 'bloto', voiceSettings: persona.voiceSettings };
    }

    // 6. Muzyka, koncerty, zespoły, scena:
    if (
      text.includes('muzyka') ||
      text.includes('muzyke') ||
      text.includes('koncert') ||
      text.includes('zespol') ||
      text.includes('zespół') ||
      text.includes('scena') ||
      text.includes('sceny') ||
      text.includes('graja') ||
      text.includes('grają')
    ) {
      const lore = persona.festivalLore.koncert;
      const reply = lore
        ? lore[Math.floor(Math.random() * lore.length)]
        : 'Muzyka na żywo gra tu non stop, leć pod scenę!';
      return { text: reply, topic: 'koncert', voiceSettings: persona.voiceSettings };
    }

    // 7. Toalety, toi-toi, siku, kibel:
    if (
      text.includes('toi') ||
      text.includes('toaleta') ||
      text.includes('kibel') ||
      text.includes('siku') ||
      text.includes('lazienka') ||
      text.includes('łazienka')
    ) {
      const lore = persona.festivalLore.kibel;
      const reply = lore
        ? lore[Math.floor(Math.random() * lore.length)]
        : 'Toi-toie stoją w narożniku obozu, nie da się ich przeoczyć.';
      return { text: reply, topic: 'kibel', voiceSettings: persona.voiceSettings };
    }

    // 8. Pogoda, deszcz, słońce, wiatr:
    if (
      text.includes('deszcz') ||
      text.includes('pogoda') ||
      text.includes('slonce') ||
      text.includes('słońce') ||
      text.includes('burza') ||
      text.includes('chmury') ||
      text.includes('wiatr')
    ) {
      const lore = persona.festivalLore.deszcz;
      const reply = lore
        ? lore[Math.floor(Math.random() * lore.length)]
        : 'Niezależnie od aury, pod naszą plandeką zawsze jest sucho i wesoło!';
      return { text: reply, topic: 'deszcz', voiceSettings: persona.voiceSettings };
    }

    // 9. Powitania standardowe:
    if (
      text.includes('siema') ||
      text.includes('czesc') ||
      text.includes('cześć') ||
      text.includes('hej') ||
      text.includes('elo') ||
      text.includes('witam') ||
      text.includes('dzien dobry') ||
      text.includes('dzień dobry')
    ) {
      const reply = persona.greetings[Math.floor(Math.random() * persona.greetings.length)];
      return { text: reply, topic: 'powitanie', voiceSettings: persona.voiceSettings };
    }

    // 10. Kontekstowy, klimatyczny fallback w charakterze postaci (bez cytowania w cudzysłowach):
    const cleanSubject = this.extractSubject(playerInput);
    if (cleanSubject.length > 0) {
      const topicSnippet = cleanSubject.length > 50 ? `${cleanSubject.slice(0, 48)}...` : cleanSubject;

      if (persona.name.includes('Antena')) {
        return {
          text: `Wiesz co, jeśli chodzi o ${topicSnippet}... na tym polu każda fala i rezonans łączy się z kosmiczną muzyką! Spójrz w niebo i poczuj te wibracje!`,
          topic: 'ogolne',
          voiceSettings: persona.voiceSettings,
        };
      }
      if (isSzerszen) {
        return {
          text: `Słuchaj, jeśli chodzi o ${topicSnippet}, to powiem ci w sekrecie: na tym festiwalu działy się już dziwniejsze rzeczy! Krążą o tym różne plotki, brachu!`,
          topic: 'ogolne',
          voiceSettings: persona.voiceSettings,
        };
      }
      if (persona.name.includes('Pień')) {
        return {
          text: `Rozkminiasz ${topicSnippet}? Na moim polu najważniejsze jest to, żeby namiot stał stabilnie, a ludzie wokół byli dla siebie życzliwi!`,
          topic: 'ogolne',
          voiceSettings: persona.voiceSettings,
        };
      }
      if (persona.name.includes('Dziąsło')) {
        return {
          text: `Młody, za moich czasów nikt nie zaprzątał sobie głowy sprawami takimi jak ${topicSnippet} – braliśmy gitary, skakaliśmy w pogo i życie było piękne!`,
          topic: 'ogolne',
          voiceSettings: persona.voiceSettings,
        };
      }
      if (persona.name.includes('Chlebak')) {
        return {
          text: `Ciekawe to z tym ${topicSnippet}, ale na pusty żołądek to żadna filozofia nie wejdzie. Zjedz kabanosa i dopiero rozkminiaj!`,
          topic: 'ogolne',
          voiceSettings: persona.voiceSettings,
        };
      }
      if (persona.name.includes('Hemoroid')) {
        return {
          text: `Może i ${topicSnippet} to ważna sprawa, ale jak człowieka lędźwie bolą od twardej ziemi, to jedyne o czym myśli, to porządny leżak!`,
          topic: 'ogolne',
          voiceSettings: persona.voiceSettings,
        };
      }
      if (persona.name.includes('Jęczmień')) {
        return {
          text: `Może i ${topicSnippet} to głęboki temat, ale najlepszy rezonans i tak daje chłodna puszka otwierana w cieniu plandeki!`,
          topic: 'ogolne',
          voiceSettings: persona.voiceSettings,
        };
      }
      if (persona.name.includes('Korba')) {
        return {
          text: `Nie wiem jak tam ${topicSnippet}, ale ten bas ze sceny tak niesamowicie porywa, że szkoda czasu na gadanie – skaczemy i tańczymy!`,
          topic: 'ogolne',
          voiceSettings: persona.voiceSettings,
        };
      }
      if (persona.name.includes('Kobra')) {
        return {
          text: `W młynie pod sceną nikt cię nie zapyta o ${topicSnippet}! Tam liczy się tylko balans ciała, refleks i wzajemna pomoc!`,
          topic: 'ogolne',
          voiceSettings: persona.voiceSettings,
        };
      }
      if (persona.name.includes('Ambona')) {
        return {
          text: `Głębokie to twe rozważania o ${topicSnippet}, lecz powiadam ci: największą prawdą tego festiwalu jest muzyka i braterska miłość!`,
          topic: 'ogolne',
          voiceSettings: persona.voiceSettings,
        };
      }

      return {
        text: `Ciekawe to z tym ${topicSnippet}! Na tym festiwalu wszystko jest możliwe, ale najważniejsze to cieszyć się chwilą i dobrą muzyką!`,
        topic: 'ogolne',
        voiceSettings: persona.voiceSettings,
      };
    }

    const fallbackCatchphrase =
      persona.genericCatchphrases[Math.floor(Math.random() * persona.genericCatchphrases.length)];
    return {
      text: fallbackCatchphrase,
      topic: 'ogolne',
      voiceSettings: persona.voiceSettings,
    };
  }
}
