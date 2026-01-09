/* TRIP LIBRARY (Database)
   -----------------------
   Structure: Region -> Categories -> Trips
   Format: { id: "UNIQUE_ID", label: "Display Name", data: "Text content..." }
*/

window.TRIP_LIBRARY = [
  {
    region: "⭐ Special Collections",
    categories: [
      {
        name: "🏆 Top 10 Global Tourist Destinations",
        items: [
          { 
            id: "GLOBAL_TOP_10", 
            label: "The World's Most Visited (Mixed)", 
            data: `# 🏆 Top 10 Global Tourist Landmarks
# Note: This is a hypothetical "World Tour"
Eiffel Tower, Paris, France START
Colosseum, Rome, Italy
Statue of Liberty, New York, USA
Machu Picchu, Peru
Taj Mahal, Agra, India
Pyramids of Giza, Egypt
Great Wall of China (Mutianyu), Beijing
Sydney Opera House, Australia
Christ the Redeemer, Rio de Janeiro, Brazil
Burj Khalifa, Dubai, UAE` 
          }
        ]
      }
    ]
  },
  {
    region: "🇪🇺 Europe",
    categories: [
      {
        name: "🚗 Top 10 Driving Tours",
        items: [
          { id: "FRANCE_DRIVE", label: "France (Grand Tour)", data: `# 🇫🇷 France Grand Tour\nParis, France START\nRouen, Normandy\nMont Saint-Michel, Normandy\nBordeaux, France\nToulouse, France\nCarcassonne, France\nMarseille, France\nNice, France\nLyon, France\nStrasbourg, France` },
          { id: "ITALY_DRIVE", label: "Italy (Bella Italia)", data: `# 🇮🇹 Italy Bella Italia\nMilan, Italy START\nVenice, Italy\nBologna, Italy\nFlorence, Italy\nPisa, Italy\nRome, Italy\nNaples, Italy\nBari, Italy\nPalermo, Sicily\nGenoa, Italy` },
          { id: "SPAIN_DRIVE", label: "Spain (Fiesta Route)", data: `# 🇪🇸 Spain Fiesta Route\nMadrid, Spain START\nToledo, Spain\nValencia, Spain\nBarcelona, Spain\nZaragoza, Spain\nBilbao, Spain\nSantiago de Compostela, Spain\nSeville, Spain\nGranada, Spain\nMalaga, Spain` },
          { id: "GERMANY_DRIVE", label: "Germany (Autobahn)", data: `# 🇩🇪 Germany Autobahn\nBerlin, Germany START\nHamburg, Germany\nCologne Cathedral, Germany\nFrankfurt, Germany\nHeidelberg, Germany\nStuttgart, Germany\nMunich, Germany\nNeuschwanstein Castle, Germany\nNuremberg, Germany\nDresden, Germany` },
          { id: "UK_DRIVE", label: "UK (Royal Route)", data: `# 🇬🇧 UK Royal Route\nLondon, UK START\nOxford, UK\nBath, UK\nStonehenge, UK\nCardiff, Wales\nLiverpool, UK\nManchester, UK\nYork, UK\nEdinburgh, Scotland\nInverness, Scotland` },
          { id: "ICELAND_DRIVE", label: "Iceland (Ring Road)", data: `# 🇮🇸 Iceland Ring Road\nReykjavik, Iceland START\nVik, Iceland\nHofn, Iceland\nEgilsstadir, Iceland\nHusavik, Iceland\nAkureyri, Iceland\nSnaefellsnes Peninsula, Iceland\nGolden Circle, Iceland` },
          { id: "NORWAY_DRIVE", label: "Norway (Fjords)", data: `# 🇳🇴 Norway Fjords\nOslo, Norway START\nKristiansand, Norway\nStavanger, Norway\nBergen, Norway\nFlam, Norway\nGeirangerfjord, Norway\nAlesund, Norway\nTrondheim, Norway\nLofoten Islands, Norway\nTromso, Norway` },
          { id: "SWISS_DRIVE", label: "Switzerland (Alps)", data: `# 🇨🇭 Switzerland Alps\nZurich, Switzerland START\nLucerne, Switzerland\nInterlaken, Switzerland\nBern, Switzerland\nLausanne, Switzerland\nGeneva, Switzerland\nZermatt, Switzerland\nLugano, Switzerland\nSt. Moritz, Switzerland\nVaduz, Liechtenstein` },
          { id: "GREECE_DRIVE", label: "Greece (Ancient)", data: `# 🇬🇷 Greece Ancient Route\nAthens, Greece START\nDelphi, Greece\nMeteora, Greece\nThessaloniki, Greece\nIoannina, Greece\nPatras, Greece\nOlympia, Greece\nSparta, Greece\nNafplio, Greece\nCorinth, Greece` },
          { id: "SLOVENIA_DRIVE", label: "Slovenia (Full Loop)", data: `# 🇸🇮 Slovenia Full Loop\nLjubljana, Slovenia START\nLake Bled, Slovenia\nKranjska Gora, Slovenia\nBovec, Slovenia\nPostojna Cave, Slovenia\nPiran, Slovenia\nLipica Stud Farm, Slovenia\nMaribor, Slovenia\nPtuj, Slovenia\nVelika Planina, Slovenia` }
        ]
      },
      {
        name: "🚶 All 27 EU Capitals (Walking)",
        items: [
          { id: "VIENNA", label: "🇦🇹 Vienna", data: `# 🇦🇹 Vienna Walking\nSt. Stephen's Cathedral, Vienna\nHofburg Palace, Vienna\nSchönbrunn Palace, Vienna\nBelvedere Palace, Vienna\nPrater, Vienna\nNaschmarkt, Vienna` },
          { id: "BRUSSELS", label: "🇧🇪 Brussels", data: `# 🇧🇪 Brussels Walking\nGrand Place, Brussels\nManneken Pis, Brussels\nAtomium, Brussels\nRoyal Palace of Brussels\nParc du Cinquantenaire, Brussels` },
          { id: "SOFIA", label: "🇧🇬 Sofia", data: `# 🇧🇬 Sofia Walking\nAlexander Nevsky Cathedral, Sofia\nVitosha Boulevard, Sofia\nNational Palace of Culture, Sofia\nBoyana Church, Sofia` },
          { id: "ZAGREB", label: "🇭🇷 Zagreb", data: `# 🇭🇷 Zagreb Walking\nBan Jelačić Square, Zagreb\nZagreb Cathedral\nSt. Mark's Church, Zagreb\nMuseum of Broken Relationships, Zagreb` },
          { id: "NICOSIA", label: "🇨🇾 Nicosia", data: `# 🇨🇾 Nicosia Walking\nLedra Street, Nicosia\nBuyuk Han, Nicosia\nSelimiye Camii, Nicosia\nCyprus Museum, Nicosia` },
          { id: "PRAGUE", label: "🇨🇿 Prague", data: `# 🇨🇿 Prague Walking\nCharles Bridge, Prague\nPrague Castle\nOld Town Square, Prague\nDancing House, Prague` },
          { id: "COPENHAGEN", label: "🇩🇰 Copenhagen", data: `# 🇩🇰 Copenhagen Walking\nNyhavn, Copenhagen\nThe Little Mermaid, Copenhagen\nTivoli Gardens, Copenhagen\nAmalienborg, Copenhagen` },
          { id: "TALLINN", label: "🇪🇪 Tallinn", data: `# 🇪🇪 Tallinn Walking\nTallinn Old Town\nToompea Castle, Tallinn\nAlexander Nevsky Cathedral, Tallinn\nKadriorg Park, Tallinn` },
          { id: "HELSINKI", label: "🇫🇮 Helsinki", data: `# 🇫🇮 Helsinki Walking\nHelsinki Cathedral\nSuomenlinna, Helsinki\nTemppeliaukio Church, Helsinki\nMarket Square, Helsinki` },
          { id: "PARIS", label: "🇫🇷 Paris", data: `# 🇫🇷 Paris Walking\nEiffel Tower, Paris\nLouvre Museum, Paris\nNotre Dame Cathedral, Paris\nArc de Triomphe, Paris\nSacré-Cœur, Paris` },
          { id: "BERLIN", label: "🇩🇪 Berlin", data: `# 🇩🇪 Berlin Walking\nBrandenburg Gate, Berlin\nReichstag Building, Berlin\nBerlin Wall Memorial\nCheckpoint Charlie, Berlin` },
          { id: "ATHENS", label: "🇬🇷 Athens", data: `# 🇬🇷 Athens Walking\nAcropolis of Athens\nParthenon, Athens\nPlaka, Athens\nSyntagma Square, Athens` },
          { id: "BUDAPEST", label: "🇭🇺 Budapest", data: `# 🇭🇺 Budapest Walking\nHungarian Parliament, Budapest\nBuda Castle, Budapest\nFisherman's Bastion, Budapest\nSzéchenyi Thermal Bath, Budapest` },
          { id: "DUBLIN", label: "🇮🇪 Dublin", data: `# 🇮🇪 Dublin Walking\nTemple Bar, Dublin\nTrinity College Dublin\nGuinness Storehouse, Dublin\nDublin Castle` },
          { id: "ROME", label: "🇮🇹 Rome", data: `# 🇮🇹 Rome Walking\nColosseum, Rome\nPantheon, Rome\nTrevi Fountain, Rome\nSpanish Steps, Rome\nSt. Peter's Basilica, Vatican City` },
          { id: "RIGA", label: "🇱🇻 Riga", data: `# 🇱🇻 Riga Walking\nHouse of the Blackheads, Riga\nRiga Central Market\nSt. Peter's Church, Riga\nFreedom Monument, Riga` },
          { id: "VILNIUS", label: "🇱🇹 Vilnius", data: `# 🇱🇹 Vilnius Walking\nGediminas' Tower, Vilnius\nVilnius Cathedral\nGate of Dawn, Vilnius\nUzupis, Vilnius` },
          { id: "LUXEMBOURG", label: "🇱🇺 Luxembourg", data: `# 🇱🇺 Luxembourg Walking\nLe Chemin de la Corniche, Luxembourg\nCasemates du Bock, Luxembourg\nGrand Ducal Palace, Luxembourg\nNotre-Dame Cathedral, Luxembourg` },
          { id: "VALLETTA", label: "🇲🇹 Valletta", data: `# 🇲🇹 Valletta Walking\nSt. John's Co-Cathedral, Valletta\nUpper Barrakka Gardens, Valletta\nGrandmaster's Palace, Valletta\nFort St Elmo, Valletta` },
          { id: "AMSTERDAM", label: "🇳🇱 Amsterdam", data: `# 🇳🇱 Amsterdam Walking\nRijksmuseum, Amsterdam\nAnne Frank House, Amsterdam\nVondelpark, Amsterdam\nDam Square, Amsterdam` },
          { id: "WARSAW", label: "🇵🇱 Warsaw", data: `# 🇵🇱 Warsaw Walking\nOld Town Market Place, Warsaw\nRoyal Castle, Warsaw\nPalace of Culture and Science, Warsaw\nŁazienki Park, Warsaw` },
          { id: "LISBON", label: "🇵🇹 Lisbon", data: `# 🇵🇹 Lisbon Walking\nBelém Tower, Lisbon\nJerónimos Monastery, Lisbon\nPraça do Comércio, Lisbon\nCastelo de S. Jorge, Lisbon` },
          { id: "BUCHAREST", label: "🇷🇴 Bucharest", data: `# 🇷🇴 Bucharest Walking\nPalace of Parliament, Bucharest\nRomanian Athenaeum, Bucharest\nOld Town, Bucharest\nHerastrau Park, Bucharest` },
          { id: "BRATISLAVA", label: "🇸🇰 Bratislava", data: `# 🇸🇰 Bratislava Walking\nBratislava Castle\nSt. Martin's Cathedral, Bratislava\nMichael's Gate, Bratislava\nBlue Church, Bratislava` },
          { id: "LJUBLJANA", label: "🇸🇮 Ljubljana", data: `# 🇸🇮 Ljubljana Walking\nPrešernov trg, Ljubljana\nLjubljana Castle\nDragon Bridge, Ljubljana\nTivoli Park, Ljubljana\nMetelkova Art Center, Ljubljana` },
          { id: "MADRID", label: "🇪🇸 Madrid", data: `# 🇪🇸 Madrid Walking\nRoyal Palace of Madrid\nPlaza Mayor, Madrid\nRetiro Park, Madrid\nPrado Museum, Madrid` },
          { id: "STOCKHOLM", label: "🇸🇪 Stockholm", data: `# 🇸🇪 Stockholm Walking\nGamla Stan, Stockholm\nVasa Museum, Stockholm\nSkansen, Stockholm\nStockholm Palace` }
        ]
      },
      {
        name: "🇪🇺 Extreme / Full Region",
        items: [
          { id: "EUROPE_NORTH", label: "EU Capitals (North/West - 13)", data: `# 🇪🇺 EU Capitals (North/West - 13 Stops)\nDublin, Ireland START\nHelsinki, Finland\nStockholm, Sweden\nTallinn, Estonia\nRiga, Latvia\nVilnius, Lithuania\nCopenhagen, Denmark\nBerlin, Germany\nWarsaw, Poland\nAmsterdam, Netherlands\nBrussels, Belgium\nLuxembourg City, Luxembourg\nParis, France` },
          { id: "EUROPE_SOUTH", label: "EU Capitals (South/East - 14)", data: `# 🇪🇺 EU Capitals (South/East - 14 Stops)\nLisbon, Portugal START\nMadrid, Spain\nRome, Italy\nValletta, Malta\nAthens, Greece\nNicosia, Cyprus\nSofia, Bulgaria\nBucharest, Romania\nBudapest, Hungary\nVienna, Austria\nBratislava, Slovakia\nPrague, Czechia\nLjubljana, Slovenia\nZagreb, Croatia` },
          { id: "COMPLEX_EU", label: "💀 THE GAUNTLET (All Caps + Stops)", data: `# 🇪🇺💀 THE GAUNTLET (Capitals + Stops)\n# Warning: This is a massive route!\nVienna, Austria\nHofburg Palace, Vienna\nBrussels, Belgium\nGrand Place, Brussels\nSofia, Bulgaria\nAlexander Nevsky Cathedral, Sofia\nZagreb, Croatia\nBan Jelačić Square, Zagreb\nNicosia, Cyprus\nPrague, Czechia\nCharles Bridge, Prague\nCopenhagen, Denmark\nNyhavn, Copenhagen\nTallinn, Estonia\nHelsinki, Finland\nParis, France\nEiffel Tower, Paris\nBerlin, Germany\nBrandenburg Gate, Berlin\nAthens, Greece\nAcropolis of Athens\nBudapest, Hungary\nHungarian Parliament, Budapest\nDublin, Ireland\nTemple Bar, Dublin\nRome, Italy\nColosseum, Rome\nRiga, Latvia\nVilnius, Lithuania\nLuxembourg City, Luxembourg\nValletta, Malta\nAmsterdam, Netherlands\nRijksmuseum, Amsterdam\nWarsaw, Poland\nOld Town, Warsaw\nLisbon, Portugal\nBelém Tower, Lisbon\nBucharest, Romania\nBratislava, Slovakia\nLjubljana, Slovenia\nLjubljana Castle\nMadrid, Spain\nRoyal Palace, Madrid\nStockholm, Sweden\nGamla Stan, Stockholm` }
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
          { id: "NA_DRIVE", label: "Namibia Desert", data: `# 🇳🇦 Namibia Desert\nWindhoek START\nEtosha National Park\nDamaraland\nSwakopmund\nWalvis Bay\nSossusvlei (Dunes)\nFish River Canyon\nLuderitz` },
          { id: "BW_DRIVE", label: "Botswana Delta", data: `# 🇧🇼 Botswana Delta\nGaborone START\nFrancistown\nMaun\nOkavango Delta\nMoremi Game Reserve\nChobe National Park\nKasane` },
          { id: "TN_DRIVE", label: "Tunisia History", data: `# 🇹🇳 Tunisia History\nTunis START\nCarthage\nSidi Bou Said\nHammamet\nSousse\nEl Jem (Amphitheatre)\nKairouan\nTozeur` },
          { id: "MU_DRIVE", label: "Mauritius Island", data: `# 🇲🇺 Mauritius Island\nPort Louis START\nPamplemousses Garden\nGrand Baie\nIle aux Cerfs\nBlue Bay\nChamarel (7 Colored Earth)\nLe Morne Brabant` },
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
          { id: "ID_DRIVE", label: "Indonesia (Bali Loop)", data: `# 🇮🇩 Indonesia (Bali Loop)\nDenpasar START\nUbud\nTegallalang Rice Terrace\nKintamani (Mt Batur)\nBesakih Temple\nCandi Dasa\nNusa Dua\nUluwatu Temple\nKuta` },
          { id: "IN_DRIVE", label: "India Golden Triangle+", data: `# 🇮🇳 India Golden Triangle+\nNew Delhi START\nAgra (Taj Mahal)\nJaipur\nJodhpur\nUdaipur\nPushkar\nRanthambore National Park\nVaranasi` },
          { id: "CN_DRIVE", label: "China Classics", data: `# 🇨🇳 China Classics\nBeijing START\nGreat Wall of China (Mutianyu)\nXi'an (Terracotta Warriors)\nChengdu (Pandas)\nZhangjiajie\nGuilin\nYangshuo\nShanghai` },
          { id: "AE_DRIVE", label: "UAE Highlights", data: `# 🇦🇪 UAE Highlights\nDubai START\nBurj Khalifa\nPalm Jumeirah\nSharjah\nAjman\nRas Al Khaimah\nFujairah\nAl Ain\nAbu Dhabi (Grand Mosque)` },
          { id: "TR_DRIVE", label: "Turkey Grand Tour", data: `# 🇹🇷 Turkey Grand Tour\nIstanbul START\nBursa\nEphesus\nPamukkale\nBodrum\nFethiye\nAntalya\nKonya\nCappadocia` },
          { id: "KR_DRIVE", label: "South Korea Loop", data: `# 🇰🇷 South Korea Loop\nSeoul START\nSuwon\nSokcho (Seoraksan)\nAndong\nGyeongju\nBusan\nGeoje\nJeonju` },
          { id: "SG_DRIVE", label: "Singapore City Run", data: `# 🇸🇬 Singapore City Run\nMarina Bay Sands START\nGardens by the Bay\nChinatown, Singapore\nLittle India, Singapore\nOrchard Road\nSingapore Botanic Gardens\nSentosa Island` },
          { id: "TOKYO", label: "Tokyo Highlights (Metro)", data: `# 🇯🇵 Tokyo Highlights (Metro)\nShinjuku Station, Tokyo START\nShibuya Crossing, Tokyo\nSenso-ji, Tokyo\nMeiji Jingu, Tokyo\nTokyo Tower\nAkihabara, Tokyo\nTsukiji Outer Market, Tokyo` }
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
          { id: "US_WEST_DRIVE", label: "USA West Coast", data: `# 🇺🇸 USA West Coast\nSeattle, WA START\nPortland, OR\nRedwood National Park, CA\nSan Francisco, CA\nYosemite National Park, CA\nMonterey, CA\nSanta Barbara, CA\nLos Angeles, CA\nSan Diego, CA\nLas Vegas, NV` },
          { id: "US_EAST_DRIVE", label: "USA East Coast", data: `# 🇺🇸 USA East Coast\nBoston, MA START\nNew York City, NY\nPhiladelphia, PA\nWashington DC\nShenandoah National Park, VA\nMyrtle Beach, SC\nCharleston, SC\nSavannah, GA\nOrlando, FL\nMiami, FL` },
          { id: "CA_WEST_DRIVE", label: "Canada Rockies", data: `# 🇨🇦 Canada Rockies\nVancouver, BC START\nWhistler, BC\nKamloops, BC\nJasper National Park, AB\nLake Louise, AB\nBanff, AB\nCalgary, AB` },
          { id: "CA_EAST_DRIVE", label: "Canada Cities", data: `# 🇨🇦 Canada Cities\nToronto, ON START\nNiagara Falls, ON\nOttawa, ON\nMontreal, QC\nQuebec City, QC\nMont Tremblant, QC\nKingston, ON` },
          { id: "MX_DRIVE", label: "Mexico Heritage", data: `# 🇲🇽 Mexico Heritage\nMexico City START\nTeotihuacan\nPuebla\nOaxaca\nSan Cristobal de las Casas\nPalenque\nMerida\nChichen Itza\nCancun` },
          { id: "CR_DRIVE", label: "Costa Rica Eco", data: `# 🇨🇷 Costa Rica Eco\nSan Jose, Costa Rica START\nTortuguero\nArenal Volcano\nMonteverde Cloud Forest\nTamarindo\nManuel Antonio National Park\nCorcovado National Park` },
          { id: "PA_DRIVE", label: "Panama Crossings", data: `# 🇵🇦 Panama Crossings\nPanama City START\nPanama Canal\nEl Valle de Anton\nChitre\nBoquete\nBocas del Toro\nPortobelo` },
          { id: "JM_DRIVE", label: "Jamaica Vibes", data: `# 🇯🇲 Jamaica Vibes\nMontego Bay START\nNegril\nTreasure Beach\nKingston\nBlue Mountains\nPort Antonio\nOcho Rios` },
          { id: "CU_DRIVE", label: "Cuba Classic", data: `# 🇨🇺 Cuba Classic\nHavana START\nViñales\nCienfuegos\nTrinidad, Cuba\nSanta Clara\nVaradero\nMatanzas` },
          { id: "GT_DRIVE", label: "Guatemala Mayan", data: `# 🇬🇹 Guatemala Mayan\nGuatemala City START\nAntigua Guatemala\nLake Atitlan\nChichicastenango\nCoban\nSemuc Champey\nFlores, Guatemala\nTikal National Park` },
          { id: "NY", label: "NYC Manhattan (Walking)", data: `# 🇺🇸 New York Manhattan (Walking)\nTimes Square, New York START\nCentral Park, New York\nEmpire State Building, New York\nBrooklyn Bridge, New York\nStatue of Liberty, New York\n9/11 Memorial, New York` }
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
          { id: "PE_DRIVE", label: "Peru Incas", data: `# 🇵🇪 Peru Incas\nLima, Peru START\nParacas, Peru\nHuacachina, Peru\nNazca Lines, Peru\nArequipa, Peru\nPuno (Lake Titicaca), Peru\nCusco, Peru\nSacred Valley, Peru\nMachu Picchu, Peru` },
          { id: "BR_DRIVE", label: "Brazil Coast", data: `# 🇧🇷 Brazil Coast\nRio de Janeiro START\nParaty\nSao Paulo\nCuritiba\nFlorianopolis\nPorto Alegre\nIguazu Falls` },
          { id: "AR_DRIVE", label: "Argentina North-South", data: `# 🇦🇷 Argentina North-South\nBuenos Aires START\nRosario\nCordoba, Argentina\nMendoza, Argentina\nBariloche\nEl Calafate\nUshuaia` },
          { id: "CL_DRIVE", label: "Chile Long Road", data: `# 🇨🇱 Chile Long Road\nSantiago, Chile START\nValparaiso\nLa Serena\nSan Pedro de Atacama\nPucon\nPuerto Montt\nTorres del Paine` },
          { id: "CO_DRIVE", label: "Colombia Colors", data: `# 🇨🇴 Colombia Colors\nBogota START\nVilla de Leyva\nSalento (Cocora Valley)\nMedellin\nGuatape\nCartagena\nTayrona National Park` },
          { id: "EC_DRIVE", label: "Ecuador Andes", data: `# 🇪🇨 Ecuador Andes\nQuito START\nOtavalo\nCotopaxi\nQuilotoa Loop\nBaños\nRiobamba\nCuenca, Ecuador` },
          { id: "BO_DRIVE", label: "Bolivia Highs", data: `# 🇧🇴 Bolivia Highs\nLa Paz, Bolivia START\nCopacabana, Bolivia\nCoroico\nOruro\nUyuni (Salt Flats)\nPotosi\nSucre` },
          { id: "UY_DRIVE", label: "Uruguay Coast", data: `# 🇺🇾 Uruguay Coast\nMontevideo START\nPiriapolis\nPunta del Este\nJose Ignacio\nLa Paloma\nPunta del Diablo` },
          { id: "PY_DRIVE", label: "Paraguay Missions", data: `# 🇵🇾 Paraguay Missions\nAsuncion START\nEncarnacion\nJesuit Missions of La Santisima Trinidad de Parana\nCiudad del Este\nYbycui` },
          { id: "PATAGONIA_DRIVE", label: "Patagonia Wild", data: `# 🏔️ Patagonia Wild\nBariloche, Argentina START\nEl Bolson\nCarretera Austral, Chile\nEl Chalten\nEl Calafate (Perito Moreno)\nPuerto Natales\nTorres del Paine\nUshuaia` }
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
          { id: "AU_EAST_DRIVE", label: "Australia East Coast", data: `# 🇦🇺 Australia East Coast\nSydney START\nBlue Mountains\nNewcastle, NSW\nPort Macquarie\nByron Bay\nGold Coast\nBrisbane\nNoosa\nFraser Island\nCairns` },
          { id: "AU_SOUTH_DRIVE", label: "Australia Ocean Rd", data: `# 🇦🇺 Australia Ocean Rd\nMelbourne START\nGeelong\nTorquay\nApollo Bay\nTwelve Apostles\nWarrnambool\nMount Gambier\nAdelaide` },
          { id: "NZ_NORTH_DRIVE", label: "NZ North Island", data: `# 🇳🇿 NZ North Island\nAuckland START\nCoromandel\nHobbiton Movie Set\nRotorua\nTaupo\nTongariro National Park\nNapier\nWellington` },
          { id: "NZ_SOUTH_DRIVE", label: "NZ South Island", data: `# 🇳🇿 NZ South Island\nChristchurch START\nLake Tekapo\nMount Cook\nWanaka\nQueenstown\nTe Anau\nMilford Sound\nFranz Josef Glacier` },
          { id: "FJ_DRIVE", label: "Fiji Viti Levu", data: `# 🇫🇯 Fiji Viti Levu\nNadi START\nSigatoka Sand Dunes\nCoral Coast, Fiji\nPacific Harbour\nSuva\nRakiraki\nLautoka` }
        ]
      }
    ]
  }
];