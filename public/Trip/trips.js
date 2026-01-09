/* TRIP LIBRARY
  Structure:
  - Region (Europe, Asia...)
    - Category (Driving, Walking...)
      - Trip (ID, Name, Data)
*/

window.TRIP_LIBRARY = [
  {
    region: "🇪🇺 Europe",
    categories: [
      {
        name: "🚗 Top 10 Driving Tours",
        items: [
          { id: "FRANCE_DRIVE", label: "France (Grand Tour)", data: `# 🇫🇷 France Grand Tour\nParis START\nRouen (Normandy)\nMont Saint-Michel\nBordeaux\nToulouse\nCarcassonne\nMarseille\nNice\nLyon\nStrasbourg` },
          { id: "ITALY_DRIVE", label: "Italy (Bella Italia)", data: `# 🇮🇹 Italy Bella Italia\nMilan START\nVenice\nBologna\nFlorence\nPisa\nRome\nNaples\nBari\nPalermo\nGenoa` },
          { id: "SPAIN_DRIVE", label: "Spain (Fiesta Route)", data: `# 🇪🇸 Spain Fiesta Route\nMadrid START\nToledo\nValencia\nBarcelona\nZaragoza\nBilbao\nSantiago de Compostela\nSeville\nGranada\nMalaga` },
          { id: "GERMANY_DRIVE", label: "Germany (Autobahn)", data: `# 🇩🇪 Germany Autobahn\nBerlin START\nHamburg\nCologne\nFrankfurt\nHeidelberg\nStuttgart\nMunich\nNeuschwanstein Castle\nNuremberg\nDresden` },
          { id: "UK_DRIVE", label: "UK (Royal Route)", data: `# 🇬🇧 UK Royal Route\nLondon START\nOxford\nBath\nStonehenge\nCardiff\nLiverpool\nManchester\nYork\nEdinburgh\nInverness` },
          { id: "ICELAND_DRIVE", label: "Iceland (Ring Road)", data: `# 🇮🇸 Iceland Ring Road\nReykjavik START\nVik\nHofn\nEgilsstadir\nHusavik\nAkureyri\nSnaefellsnes Peninsula\nGolden Circle` },
          { id: "NORWAY_DRIVE", label: "Norway (Fjords)", data: `# 🇳🇴 Norway Fjords\nOslo START\nKristiansand\nStavanger\nBergen\nFlam\nGeirangerfjord\nAlesund\nTrondheim\nLofoten Islands\nTromso` },
          { id: "SWISS_DRIVE", label: "Switzerland (Alps)", data: `# 🇨🇭 Switzerland Alps\nZurich START\nLucerne\nInterlaken\nBern\nLausanne\nGeneva\nZermatt\nLugano\nSt. Moritz\nLiechtenstein` },
          { id: "GREECE_DRIVE", label: "Greece (Ancient)", data: `# 🇬🇷 Greece Ancient Route\nAthens START\nDelphi\nMeteora\nThessaloniki\nIoannina\nPatras\nOlympia\nSparta\nNafplio\nCorinth` },
          { id: "SLOVENIA_DRIVE", label: "Slovenia (Full Loop)", data: `# 🇸🇮 Slovenia Full Loop\nLjubljana START\nLake Bled\nKranjska Gora\nBovec\nPostojna Cave\nPiran\nLipica\nMaribor\nPtuj\nVelika Planina` },
          { id: "COMPLEX_EU", label: "💀 THE GAUNTLET (Extreme)", data: `# 🇪🇺💀 THE GAUNTLET (Capitals + Stops)\n# Warning: This is a massive route!\nVienna, Austria\nHofburg Palace, Vienna\nBrussels, Belgium\nGrand Place, Brussels\nSofia, Bulgaria\nAlexander Nevsky Cathedral, Sofia\nZagreb, Croatia\nBan Jelačić Square, Zagreb\nNicosia, Cyprus\nPrague, Czechia\nCharles Bridge, Prague\nCopenhagen, Denmark\nNyhavn, Copenhagen\nTallinn, Estonia\nHelsinki, Finland\nParis, France\nEiffel Tower, Paris\nBerlin, Germany\nBrandenburg Gate, Berlin\nAthens, Greece\nAcropolis of Athens\nBudapest, Hungary\nHungarian Parliament, Budapest\nDublin, Ireland\nTemple Bar, Dublin\nRome, Italy\nColosseum, Rome\nRiga, Latvia\nVilnius, Lithuania\nLuxembourg City, Luxembourg\nValletta, Malta\nAmsterdam, Netherlands\nRijksmuseum, Amsterdam\nWarsaw, Poland\nOld Town, Warsaw\nLisbon, Portugal\nBelém Tower, Lisbon\nBucharest, Romania\nBratislava, Slovakia\nLjubljana, Slovenia\nLjubljana Castle\nMadrid, Spain\nRoyal Palace, Madrid\nStockholm, Sweden\nGamla Stan, Stockholm` }
        ]
      },
      {
        name: "🚶 All 27 EU Capitals (Walking)",
        items: [
          { id: "VIENNA", label: "🇦🇹 Vienna", data: `# 🇦🇹 Vienna Walking\nSt. Stephen's Cathedral\nHofburg Palace\nSchönbrunn Palace\nBelvedere Palace\nPrater\nNaschmarkt` },
          { id: "BRUSSELS", label: "🇧🇪 Brussels", data: `# 🇧🇪 Brussels Walking\nGrand Place\nManneken Pis\nAtomium\nRoyal Palace\nParc du Cinquantenaire` },
          { id: "SOFIA", label: "🇧🇬 Sofia", data: `# 🇧🇬 Sofia Walking\nAlexander Nevsky Cathedral\nVitosha Boulevard\nNational Palace of Culture\nBoyana Church` },
          { id: "ZAGREB", label: "🇭🇷 Zagreb", data: `# 🇭🇷 Zagreb Walking\nBan Jelačić Square\nZagreb Cathedral\nSt. Mark's Church\nMuseum of Broken Relationships` },
          { id: "NICOSIA", label: "🇨🇾 Nicosia", data: `# 🇨🇾 Nicosia Walking\nLedra Street\nBuyuk Han\nSelimiye Camii\nCyprus Museum` },
          { id: "PRAGUE", label: "🇨🇿 Prague", data: `# 🇨🇿 Prague Walking\nCharles Bridge\nPrague Castle\nOld Town Square\nDancing House` },
          { id: "COPENHAGEN", label: "🇩🇰 Copenhagen", data: `# 🇩🇰 Copenhagen Walking\nNyhavn\nThe Little Mermaid\nTivoli Gardens\nAmalienborg` },
          { id: "TALLINN", label: "🇪🇪 Tallinn", data: `# 🇪🇪 Tallinn Walking\nTallinn Old Town\nToompea Castle\nAlexander Nevsky Cathedral\nKadriorg Park` },
          { id: "HELSINKI", label: "🇫🇮 Helsinki", data: `# 🇫🇮 Helsinki Walking\nHelsinki Cathedral\nSuomenlinna\nTemppeliaukio Church\nMarket Square` },
          { id: "PARIS", label: "🇫🇷 Paris", data: `# 🇫🇷 Paris Walking\nEiffel Tower\nLouvre Museum\nNotre Dame\nArc de Triomphe\nSacré-Cœur` },
          { id: "BERLIN", label: "🇩🇪 Berlin", data: `# 🇩🇪 Berlin Walking\nBrandenburg Gate\nReichstag\nBerlin Wall Memorial\nCheckpoint Charlie` },
          { id: "ATHENS", label: "🇬🇷 Athens", data: `# 🇬🇷 Athens Walking\nAcropolis\nParthenon\nPlaka\nSyntagma Square` },
          { id: "BUDAPEST", label: "🇭🇺 Budapest", data: `# 🇭🇺 Budapest Walking\nParliament Building\nBuda Castle\nFisherman's Bastion\nSzéchenyi Thermal Bath` },
          { id: "DUBLIN", label: "🇮🇪 Dublin", data: `# 🇮🇪 Dublin Walking\nTemple Bar\nTrinity College\nGuinness Storehouse\nDublin Castle` },
          { id: "ROME", label: "🇮🇹 Rome", data: `# 🇮🇹 Rome Walking\nColosseum\nPantheon\nTrevi Fountain\nSpanish Steps\nVatican City` },
          { id: "RIGA", label: "🇱🇻 Riga", data: `# 🇱🇻 Riga Walking\nHouse of the Blackheads\nRiga Central Market\nSt. Peter's Church\nFreedom Monument` },
          { id: "VILNIUS", label: "🇱🇹 Vilnius", data: `# 🇱🇹 Vilnius Walking\nGediminas' Tower\nVilnius Cathedral\nGate of Dawn\nUzupis` },
          { id: "LUXEMBOURG", label: "🇱🇺 Luxembourg", data: `# 🇱🇺 Luxembourg Walking\nLe Chemin de la Corniche\nCasemates du Bock\nGrand Ducal Palace\nNotre-Dame Cathedral` },
          { id: "VALLETTA", label: "🇲🇹 Valletta", data: `# 🇲🇹 Valletta Walking\nSt. John's Co-Cathedral\nUpper Barrakka Gardens\nGrandmaster's Palace\nFort St Elmo` },
          { id: "AMSTERDAM", label: "🇳🇱 Amsterdam", data: `# 🇳🇱 Amsterdam Walking\nRijksmuseum\nAnne Frank House\nVondelpark\nDam Square` },
          { id: "WARSAW", label: "🇵🇱 Warsaw", data: `# 🇵🇱 Warsaw Walking\nOld Town Market Place\nRoyal Castle\nPalace of Culture and Science\nŁazienki Park` },
          { id: "LISBON", label: "🇵🇹 Lisbon", data: `# 🇵🇹 Lisbon Walking\nBelém Tower\nJerónimos Monastery\nPraça do Comércio\nCastelo de S. Jorge` },
          { id: "BUCHAREST", label: "🇷🇴 Bucharest", data: `# 🇷🇴 Bucharest Walking\nPalace of Parliament\nRomanian Athenaeum\nOld Town\nHerastrau Park` },
          { id: "BRATISLAVA", label: "🇸🇰 Bratislava", data: `# 🇸🇰 Bratislava Walking\nBratislava Castle\nSt. Martin's Cathedral\nMichael's Gate\nBlue Church` },
          { id: "LJUBLJANA", label: "🇸🇮 Ljubljana", data: `# 🇸🇮 Ljubljana Walking\nPrešernov trg\nLjubljana Castle\nDragon Bridge\nTivoli Park` },
          { id: "MADRID", label: "🇪🇸 Madrid", data: `# 🇪🇸 Madrid Walking\nRoyal Palace\nPlaza Mayor\nRetiro Park\nPrado Museum` },
          { id: "STOCKHOLM", label: "🇸🇪 Stockholm", data: `# 🇸🇪 Stockholm Walking\nGamla Stan\nVasa Museum\nSkansen\nStockholm Palace` }
        ]
      }
    ]
  },
  {
    region: "🌍 Africa",
    categories: [
      {
        name: "🚗 Top 10 Driving/Safari",
        items: [
          { id: "ZA_DRIVE", label: "South Africa Highlights", data: `# 🇿🇦 South Africa Highlights\nCape Town START\nTable Mountain\nCape of Good Hope\nStellenbosch\nGarden Route\nKnysna\nDurban\nKruger National Park\nJohannesburg` },
          { id: "EG_DRIVE", label: "Egypt Ancients", data: `# 🇪🇬 Egypt Ancients\nCairo START\nGiza Pyramids\nAlexandria\nLuxor\nValley of the Kings\nAswan\nAbu Simbel\nHurghada\nSharm El Sheikh` },
          { id: "MA_DRIVE", label: "Morocco Imperial", data: `# 🇲🇦 Morocco Imperial\nCasablanca START\nRabat\nChefchaouen\nFes\nMeknes\nMerzouga (Sahara)\nOuarzazate\nMarrakech\nEssaouira` },
          { id: "KE_DRIVE", label: "Kenya Safari", data: `# 🇰🇪 Kenya Safari\nNairobi START\nMaasai Mara\nLake Nakuru\nMount Kenya\nAmboseli National Park\nTsavo East\nMombasa\nDiani Beach` },
          { id: "TZ_DRIVE", label: "Tanzania Wild", data: `# 🇹🇿 Tanzania Wild\nArusha START\nTarangire\nNgorongoro Crater\nSerengeti National Park\nLake Manyara\nMount Kilimanjaro Base\nDar es Salaam\nZanzibar` },
          { id: "NA_DRIVE", label: "Namibia Desert", data: `# 🇳🇦 Namibia Desert\nWindhoek START\nEtosha National Park\nDamaraland\nSwakopmund\nWalvis Bay\nSossusvlei\nFish River Canyon\nLuderitz` },
          { id: "BW_DRIVE", label: "Botswana Delta", data: `# 🇧🇼 Botswana Delta\nGaborone START\nFrancistown\nMaun\nOkavango Delta\nMoremi Game Reserve\nChobe National Park\nKasane` },
          { id: "TN_DRIVE", label: "Tunisia History", data: `# 🇹🇳 Tunisia History\nTunis START\nCarthage\nSidi Bou Said\nHammamet\nSousse\nEl Jem\nKairouan\nTozeur` },
          { id: "MU_DRIVE", label: "Mauritius Island", data: `# 🇲🇺 Mauritius Island\nPort Louis START\nPamplemousses Garden\nGrand Baie\nIle aux Cerfs\nBlue Bay\nChamarel\nLe Morne Brabant` },
          { id: "SC_DRIVE", label: "Seychelles Paradise", data: `# 🇸🇨 Seychelles Paradise\nVictoria (Mahe) START\nBeau Vallon\nMorne Seychellois\nPraslin Island\nVallee de Mai\nLa Digue\nAnse Source d'Argent` }
        ]
      }
    ]
  },
  {
    region: "🌏 Asia",
    categories: [
      {
        name: "🚗 Top 10 Driving/Train",
        items: [
          { id: "JP_DRIVE", label: "Japan Golden Route", data: `# 🇯🇵 Japan Golden Route\nTokyo START\nNikko\nHakone (Mt Fuji)\nTakayama\nKyoto\nNara\nOsaka\nHimeji\nHiroshima` },
          { id: "TH_DRIVE", label: "Thailand Explore", data: `# 🇹🇭 Thailand Explore\nBangkok START\nAyutthaya\nKanchanaburi\nSukhothai\nChiang Mai\nPai\nChiang Rai\nPhuket\nKrabi` },
          { id: "VN_DRIVE", label: "Vietnam Cross-Country", data: `# 🇻🇳 Vietnam Cross-Country\nHanoi START\nHa Long Bay\nSapa\nNinh Binh\nHue\nDa Nang\nHoi An\nNha Trang\nHo Chi Minh City` },
          { id: "ID_DRIVE", label: "Indonesia (Bali Loop)", data: `# 🇮🇩 Indonesia (Bali Loop)\nDenpasar START\nUbud\nTegallalang Rice Terrace\nKintamani\nBesakih Temple\nCandi Dasa\nNusa Dua\nUluwatu Temple\nKuta` },
          { id: "IN_DRIVE", label: "India Golden Triangle+", data: `# 🇮🇳 India Golden Triangle+\nNew Delhi START\nAgra (Taj Mahal)\nJaipur\nJodhpur\nUdaipur\nPushkar\nRanthambore National Park\nVaranasi` },
          { id: "CN_DRIVE", label: "China Classics", data: `# 🇨🇳 China Classics\nBeijing START\nGreat Wall (Mutianyu)\nXi'an\nChengdu (Pandas)\nZhangjiajie\nGuilin\nYangshuo\nShanghai` },
          { id: "AE_DRIVE", label: "UAE Highlights", data: `# 🇦🇪 UAE Highlights\nDubai START\nBurj Khalifa\nPalm Jumeirah\nSharjah\nAjman\nRas Al Khaimah\nFujairah\nAl Ain\nAbu Dhabi` },
          { id: "TR_DRIVE", label: "Turkey Grand Tour", data: `# 🇹🇷 Turkey Grand Tour\nIstanbul START\nBursa\nEphesus\nPamukkale\nBodrum\nFethiye\nAntalya\nKonya\nCappadocia` },
          { id: "KR_DRIVE", label: "South Korea Loop", data: `# 🇰🇷 South Korea Loop\nSeoul START\nSuwon\nSokcho\nAndong\nGyeongju\nBusan\nGeoje\nJeonju` },
          { id: "SG_DRIVE", label: "Singapore City Run", data: `# 🇸🇬 Singapore City Run\nMarina Bay Sands START\nGardens by the Bay\nChinatown\nLittle India\nOrchard Road\nBotanic Gardens\nSentosa Island` },
          { id: "TOKYO", label: "Tokyo Highlights (Metro)", data: `# 🇯🇵 Tokyo Highlights (Metro)\nShinjuku Station START\nShibuya Crossing\nSenso-ji\nMeiji Jingu\nTokyo Tower\nAkihabara\nTsukiji Outer Market` }
        ]
      }
    ]
  },
  {
    region: "🌎 North America",
    categories: [
      {
        name: "🚗 Top 10 Regions",
        items: [
          { id: "US_WEST_DRIVE", label: "USA West Coast", data: `# 🇺🇸 USA West Coast\nSeattle START\nPortland\nRedwood National Park\nSan Francisco\nYosemite\nMonterey\nSanta Barbara\nLos Angeles\nSan Diego\nLas Vegas` },
          { id: "US_EAST_DRIVE", label: "USA East Coast", data: `# 🇺🇸 USA East Coast\nBoston START\nNew York City\nPhiladelphia\nWashington DC\nShenandoah National Park\nMyrtle Beach\nCharleston\nSavannah\nOrlando\nMiami` },
          { id: "CA_WEST_DRIVE", label: "Canada Rockies", data: `# 🇨🇦 Canada Rockies\nVancouver START\nWhistler\nKamloops\nJasper National Park\nLake Louise\nBanff\nCalgary` },
          { id: "CA_EAST_DRIVE", label: "Canada Cities", data: `# 🇨🇦 Canada Cities\nToronto START\nNiagara Falls\nOttawa\nMontreal\nQuebec City\nMont Tremblant\nKingston` },
          { id: "MX_DRIVE", label: "Mexico Heritage", data: `# 🇲🇽 Mexico Heritage\nMexico City START\nTeotihuacan\nPuebla\nOaxaca\nSan Cristobal de las Casas\nPalenque\nMerida\nChichen Itza\nCancun` },
          { id: "CR_DRIVE", label: "Costa Rica Eco", data: `# 🇨🇷 Costa Rica Eco\nSan Jose START\nTortuguero\nArenal Volcano\nMonteverde\nTamarindo\nManuel Antonio\nCorcovado` },
          { id: "PA_DRIVE", label: "Panama Crossings", data: `# 🇵🇦 Panama Crossings\nPanama City START\nPanama Canal\nEl Valle de Anton\nChitre\nBoquete\nBocas del Toro\nPortobelo` },
          { id: "JM_DRIVE", label: "Jamaica Vibes", data: `# 🇯🇲 Jamaica Vibes\nMontego Bay START\nNegril\nTreasure Beach\nKingston\nBlue Mountains\nPort Antonio\nOcho Rios` },
          { id: "CU_DRIVE", label: "Cuba Classic", data: `# 🇨🇺 Cuba Classic\nHavana START\nViñales\nCienfuegos\nTrinidad\nSanta Clara\nVaradero\nMatanzas` },
          { id: "GT_DRIVE", label: "Guatemala Mayan", data: `# 🇬🇹 Guatemala Mayan\nGuatemala City START\nAntigua\nLake Atitlan\nChichicastenango\nCoban\nSemuc Champey\nFlores\nTikal` },
          { id: "NY", label: "NYC Manhattan (Walking)", data: `# 🇺🇸 New York Manhattan (Walking)\nTimes Square START\nCentral Park\nEmpire State Building\nBrooklyn Bridge\nStatue of Liberty\n9/11 Memorial` }
        ]
      }
    ]
  },
  {
    region: "🌎 South America",
    categories: [
      {
        name: "🚗 Top 10 Tours",
        items: [
          { id: "PE_DRIVE", label: "Peru Incas", data: `# 🇵🇪 Peru Incas\nLima START\nParacas\nHuacachina\nNazca Lines\nArequipa\nPuno\nCusco\nSacred Valley\nMachu Picchu` },
          { id: "BR_DRIVE", label: "Brazil Coast", data: `# 🇧🇷 Brazil Coast\nRio de Janeiro START\nParaty\nSao Paulo\nCuritiba\nFlorianopolis\nPorto Alegre\nIguazu Falls` },
          { id: "AR_DRIVE", label: "Argentina North-South", data: `# 🇦🇷 Argentina North-South\nBuenos Aires START\nRosario\nCordoba\nMendoza\nBariloche\nEl Calafate\nUshuaia` },
          { id: "CL_DRIVE", label: "Chile Long Road", data: `# 🇨🇱 Chile Long Road\nSantiago START\nValparaiso\nLa Serena\nSan Pedro de Atacama\nPucon\nPuerto Montt\nTorres del Paine` },
          { id: "CO_DRIVE", label: "Colombia Colors", data: `# 🇨🇴 Colombia Colors\nBogota START\nVilla de Leyva\nSalento\nMedellin\nGuatape\nCartagena\nTayrona National Park` },
          { id: "EC_DRIVE", label: "Ecuador Andes", data: `# 🇪🇨 Ecuador Andes\nQuito START\nOtavalo\nCotopaxi\nQuilotoa Loop\nBaños\nRiobamba\nCuenca` },
          { id: "BO_DRIVE", label: "Bolivia Highs", data: `# 🇧🇴 Bolivia Highs\nLa Paz START\nCopacabana\nCoroico\nOruro\nUyuni (Salt Flats)\nPotosi\nSucre` },
          { id: "UY_DRIVE", label: "Uruguay Coast", data: `# 🇺🇾 Uruguay Coast\nMontevideo START\nPiriapolis\nPunta del Este\nJose Ignacio\nLa Paloma\nPunta del Diablo` },
          { id: "PY_DRIVE", label: "Paraguay Missions", data: `# 🇵🇾 Paraguay Missions\nAsuncion START\nEncarnacion\nJesuit Missions\nCiudad del Este\nYbycui` },
          { id: "PATAGONIA_DRIVE", label: "Patagonia Wild", data: `# 🏔️ Patagonia Wild\nBariloche START\nEl Bolson\nCarretera Austral\nEl Chalten\nEl Calafate\nPuerto Natales\nTorres del Paine\nUshuaia` }
        ]
      }
    ]
  },
  {
    region: "🌏 Oceania",
    categories: [
      {
        name: "🚗 Top 5 Tours",
        items: [
          { id: "AU_EAST_DRIVE", label: "Australia East Coast", data: `# 🇦🇺 Australia East Coast\nSydney START\nBlue Mountains\nNewcastle\nPort Macquarie\nByron Bay\nGold Coast\nBrisbane\nNoosa\nFraser Island\nCairns` },
          { id: "AU_SOUTH_DRIVE", label: "Australia Ocean Rd", data: `# 🇦🇺 Australia Ocean Rd\nMelbourne START\nGeelong\nTorquay\nApollo Bay\nTwelve Apostles\nWarrnambool\nMount Gambier\nAdelaide` },
          { id: "NZ_NORTH_DRIVE", label: "NZ North Island", data: `# 🇳🇿 NZ North Island\nAuckland START\nCoromandel\nHobbiton\nRotorua\nTaupo\nTongariro\nNapier\nWellington` },
          { id: "NZ_SOUTH_DRIVE", label: "NZ South Island", data: `# 🇳🇿 NZ South Island\nChristchurch START\nLake Tekapo\nMount Cook\nWanaka\nQueenstown\nTe Anau\nMilford Sound\nFranz Josef Glacier` },
          { id: "FJ_DRIVE", label: "Fiji Viti Levu", data: `# 🇫🇯 Fiji Viti Levu\nNadi START\nSigatoka\nCoral Coast\nPacific Harbour\nSuva\nRakiraki\nLautoka` }
        ]
      }
    ]
  }
];