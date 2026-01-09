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
          },
          {
            id: "EIFFEL_FULL",
            label: "🇫🇷 Eiffel Tower & Around (Paris)",
            data: `# 🇫🇷 Paris: Eiffel Tower District
# A classic Parisian day out
Trocadéro Gardens, Paris START
Eiffel Tower, Paris
Champ de Mars, Paris
Seine River Cruise Dock (Bateaux Parisiens), Paris
Musée du Quai Branly, Paris
Pont Alexandre III, Paris
Invalides (Napoleon's Tomb), Paris
Rue Cler (Market Street), Paris`
          },
          {
            id: "COLOSSEUM_FULL",
            label: "🇮🇹 Colosseum & Ancient Rome",
            data: `# 🇮🇹 Rome: Ancient City
# The heart of the Roman Empire
Colosseum, Rome START
Arch of Constantine, Rome
Roman Forum, Rome
Palatine Hill, Rome
Capitoline Museums, Rome
Piazza Venezia (Altar of the Fatherland), Rome
Trajan's Market, Rome
Pantheon, Rome`
          },
          {
            id: "LIBERTY_FULL",
            label: "🇺🇸 Statue of Liberty & Lower Manhattan",
            data: `# 🇺🇸 NYC: Liberty & Financial District
# Ferries and Skyscrapers
Battery Park, New York START
Statue of Liberty National Monument
Ellis Island National Museum of Immigration
Charging Bull (Wall Street), New York
New York Stock Exchange, New York
Federal Hall, New York
9/11 Memorial & Museum, New York
One World Observatory, New York`
          },
          {
            id: "MACHU_FULL",
            label: "🇵🇪 Machu Picchu & Sacred Valley",
            data: `# 🇵🇪 Peru: The Inca Trail (Express)
# From Cusco to the Citadel
Cusco Main Square (Plaza de Armas) START
Sacsayhuaman, Cusco
Pisac Ruins, Sacred Valley
Ollantaytambo Ruins, Sacred Valley
Aguas Calientes (Machu Picchu Pueblo)
Machu Picchu Citadel
Huayna Picchu (Mountain Peak)
Sun Gate (Inti Punku), Machu Picchu`
          },
          {
            id: "TAJ_FULL",
            label: "🇮🇳 Taj Mahal & Agra Fort",
            data: `# 🇮🇳 Agra: Mughal Heritage
# The symbol of love and power
Taj Mahal, Agra START
Agra Fort, Agra
Mehtab Bagh (Moonlight Garden), Agra
Itmad-ud-Daulah (Baby Taj), Agra
Tomb of Akbar the Great, Sikandra
Kinari Bazar (Old Market), Agra`
          },
          {
            id: "GIZA_FULL",
            label: "🇪🇬 Pyramids of Giza & Sphinx",
            data: `# 🇪🇬 Cairo: Ancient Wonders
# The Giza Plateau
Great Pyramid of Giza (Khufu) START
Pyramid of Khafre
Pyramid of Menkaure
Great Sphinx of Giza
Valley Temple of Khafre
Grand Egyptian Museum (Giza)
Khan el-Khalili Market, Cairo`
          },
          {
            id: "WALL_FULL",
            label: "🇨🇳 Great Wall (Mutianyu) & Beijing",
            data: `# 🇨🇳 Beijing: The Great Wall
# A day trip to the wall + city highlights
Mutianyu Great Wall, Beijing START
Ming Tombs (Sacred Way), Beijing
Summer Palace, Beijing
Forbidden City, Beijing
Tiananmen Square, Beijing
Jingshan Park (View of Forbidden City), Beijing
Temple of Heaven, Beijing`
          },
          {
            id: "SYDNEY_FULL",
            label: "🇦🇺 Sydney Opera House & Harbour",
            data: `# 🇦🇺 Sydney: The Harbour Loop
# Iconic Aussie Views
Sydney Opera House START
Royal Botanic Garden Sydney
Mrs Macquarie's Chair, Sydney
The Rocks, Sydney
Sydney Harbour Bridge Pylon Lookout
Darling Harbour, Sydney
Queen Victoria Building, Sydney
Sydney Tower Eye`
          },
          {
            id: "RIO_FULL",
            label: "🇧🇷 Christ the Redeemer & Rio",
            data: `# 🇧🇷 Rio de Janeiro: Icons
# From the mountain to the sea
Christ the Redeemer (Corcovado), Rio de Janeiro START
Sugarloaf Mountain (Pão de Açúcar), Rio de Janeiro
Copacabana Beach, Rio de Janeiro
Ipanema Beach, Rio de Janeiro
Selarón Steps (Escadaria Selarón), Rio de Janeiro
Metropolitan Cathedral of Saint Sebastian, Rio de Janeiro
Maracanã Stadium, Rio de Janeiro`
          },
          {
            id: "DUBAI_FULL",
            label: "🇦🇪 Burj Khalifa & Downtown Dubai",
            data: `# 🇦🇪 Dubai: Downtown Luxury
# The tallest building and biggest mall
Burj Khalifa, Dubai START
The Dubai Mall
Dubai Aquarium & Underwater Zoo
The Dubai Fountain
Souk Al Bahar, Dubai
Dubai Opera
Sky Views Observatory, Dubai
Museum of the Future, Dubai`
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
          { id: "ZA_DRIVE", label: "South Africa Highlights", data: `# 🇿🇦 South Africa Highlights\nCape Town, South Africa START\nTable Mountain, South Africa\nCape of Good Hope, South Africa\nStellenbosch, South Africa\nKnysna, South Africa\nDurban, South Africa\nKruger National Park, South Africa\nJohannesburg, South Africa` },
          { id: "EG_DRIVE", label: "Egypt Ancients", data: `# 🇪🇬 Egypt Ancients\nCairo, Egypt START\nGiza Pyramids, Egypt\nAlexandria, Egypt\nLuxor, Egypt\nValley of the Kings, Egypt\nAswan, Egypt\nAbu Simbel, Egypt\nHurghada, Egypt\nSharm El Sheikh, Egypt` },
          { id: "MA_DRIVE", label: "Morocco Imperial", data: `# 🇲🇦 Morocco Imperial\nCasablanca, Morocco START\nRabat, Morocco\nChefchaouen, Morocco\nFes, Morocco\nMeknes, Morocco\nMerzouga (Sahara), Morocco\nOuarzazate, Morocco\nMarrakech, Morocco\nEssaouira, Morocco` },
          { id: "KE_DRIVE", label: "Kenya Safari", data: `# 🇰🇪 Kenya Safari\nNairobi, Kenya START\nMaasai Mara, Kenya\nLake Nakuru, Kenya\nMount Kenya, Kenya\nAmboseli National Park, Kenya\nTsavo East, Kenya\nMombasa, Kenya\nDiani Beach, Kenya` },
          { id: "TZ_DRIVE", label: "Tanzania Wild", data: `# 🇹🇿 Tanzania Wild\nArusha, Tanzania START\nTarangire, Tanzania\nNgorongoro Crater, Tanzania\nSerengeti National Park, Tanzania\nLake Manyara, Tanzania\nMount Kilimanjaro Base, Tanzania\nDar es Salaam, Tanzania\nZanzibar, Tanzania` },
          { id: "NA_DRIVE", label: "Namibia Desert", data: `# 🇳🇦 Namibia Desert\nWindhoek, Namibia START\nEtosha National Park, Namibia\nDamaraland, Namibia\nSwakopmund, Namibia\nWalvis Bay, Namibia\nSossusvlei, Namibia\nFish River Canyon, Namibia\nLuderitz, Namibia` },
          { id: "BW_DRIVE", label: "Botswana Delta", data: `# 🇧🇼 Botswana Delta\nGaborone, Botswana START\nFrancistown, Botswana\nMaun, Botswana\nOkavango Delta, Botswana\nMoremi Game Reserve, Botswana\nChobe National Park, Botswana\nKasane, Botswana` },
          { id: "TN_DRIVE", label: "Tunisia History", data: `# 🇹🇳 Tunisia History\nTunis, Tunisia START\nCarthage, Tunisia\nSidi Bou Said, Tunisia\nHammamet, Tunisia\nSousse, Tunisia\nEl Jem, Tunisia\nKairouan, Tunisia\nTozeur, Tunisia` },
          { id: "MU_DRIVE", label: "Mauritius Island", data: `# 🇲🇺 Mauritius Island\nPort Louis, Mauritius START\nPamplemousses Garden, Mauritius\nGrand Baie, Mauritius\nIle aux Cerfs, Mauritius\nBlue Bay, Mauritius\nChamarel, Mauritius\nLe Morne Brabant, Mauritius` },
          { id: "SC_DRIVE", label: "Seychelles Paradise", data: `# 🇸🇨 Seychelles Paradise\nVictoria, Mahe, Seychelles START\nBeau Vallon, Seychelles\nMorne Seychellois, Seychelles\nPraslin Island, Seychelles\nVallee de Mai, Seychelles\nLa Digue, Seychelles\nAnse Source d'Argent, Seychelles` }
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
          { id: "JP_DRIVE", label: "Japan Golden Route", data: `# 🇯🇵 Japan Golden Route\nTokyo, Japan START\nNikko, Japan\nHakone (Mt Fuji), Japan\nTakayama, Japan\nKyoto, Japan\nNara, Japan\nOsaka, Japan\nHimeji, Japan\nHiroshima, Japan` },
          { id: "TH_DRIVE", label: "Thailand Explore", data: `# 🇹🇭 Thailand Explore\nBangkok, Thailand START\nAyutthaya, Thailand\nKanchanaburi, Thailand\nSukhothai, Thailand\nChiang Mai, Thailand\nPai, Thailand\nChiang Rai, Thailand\nPhuket, Thailand\nKrabi, Thailand` },
          { id: "VN_DRIVE", label: "Vietnam Cross-Country", data: `# 🇻🇳 Vietnam Cross-Country\nHanoi, Vietnam START\nHa Long Bay, Vietnam\nSapa, Vietnam\nNinh Binh, Vietnam\nHue, Vietnam\nDa Nang, Vietnam\nHoi An, Vietnam\nNha Trang, Vietnam\nHo Chi Minh City, Vietnam` },
          { id: "ID_DRIVE", label: "Indonesia (Bali Loop)", data: `# 🇮🇩 Indonesia (Bali Loop)\nDenpasar, Bali START\nUbud, Bali\nTegallalang Rice Terrace, Bali\nKintamani, Bali\nBesakih Temple, Bali\nCandi Dasa, Bali\nNusa Dua, Bali\nUluwatu Temple, Bali\nKuta, Bali` },
          { id: "IN_DRIVE", label: "India Golden Triangle+", data: `# 🇮🇳 India Golden Triangle+\nNew Delhi, India START\nAgra (Taj Mahal), India\nJaipur, India\nJodhpur, India\nUdaipur, India\nPushkar, India\nRanthambore National Park, India\nVaranasi, India` },
          { id: "CN_DRIVE", label: "China Classics", data: `# 🇨🇳 China Classics\nBeijing, China START\nGreat Wall of China (Mutianyu), China\nXi'an, China\nChengdu, China\nZhangjiajie, China\nGuilin, China\nYangshuo, China\nShanghai, China` },
          { id: "AE_DRIVE", label: "UAE Highlights", data: `# 🇦🇪 UAE Highlights\nDubai, UAE START\nBurj Khalifa, Dubai\nPalm Jumeirah, Dubai\nSharjah, UAE\nAjman, UAE\nRas Al Khaimah, UAE\nFujairah, UAE\nAl Ain, UAE\nAbu Dhabi, UAE` },
          { id: "TR_DRIVE", label: "Turkey Grand Tour", data: `# 🇹🇷 Turkey Grand Tour\nIstanbul, Turkey START\nBursa, Turkey\nEphesus, Turkey\nPamukkale, Turkey\nBodrum, Turkey\nFethiye, Turkey\nAntalya, Turkey\nKonya, Turkey\nCappadocia, Turkey` },
          { id: "KR_DRIVE", label: "South Korea Loop", data: `# 🇰🇷 South Korea Loop\nSeoul, South Korea START\nSuwon, South Korea\nSokcho, South Korea\nAndong, South Korea\nGyeongju, South Korea\nBusan, South Korea\nGeoje, South Korea\nJeonju, South Korea` },
          { id: "SG_DRIVE", label: "Singapore City Run", data: `# 🇸🇬 Singapore City Run\nMarina Bay Sands, Singapore START\nGardens by the Bay, Singapore\nChinatown, Singapore\nLittle India, Singapore\nOrchard Road, Singapore\nSingapore Botanic Gardens\nSentosa Island, Singapore` },
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
          { id: "MX_DRIVE", label: "Mexico Heritage", data: `# 🇲🇽 Mexico Heritage\nMexico City, Mexico START\nTeotihuacan, Mexico\nPuebla, Mexico\nOaxaca, Mexico\nSan Cristobal de las Casas, Mexico\nPalenque, Mexico\nMerida, Mexico\nChichen Itza, Mexico\nCancun, Mexico` },
          { id: "CR_DRIVE", label: "Costa Rica Eco", data: `# 🇨🇷 Costa Rica Eco\nSan Jose, Costa Rica START\nTortuguero, Costa Rica\nArenal Volcano, Costa Rica\nMonteverde, Costa Rica\nTamarindo, Costa Rica\nManuel Antonio, Costa Rica\nCorcovado, Costa Rica` },
          { id: "PA_DRIVE", label: "Panama Crossings", data: `# 🇵🇦 Panama Crossings\nPanama City, Panama START\nPanama Canal, Panama\nEl Valle de Anton, Panama\nChitre, Panama\nBoquete, Panama\nBocas del Toro, Panama\nPortobelo, Panama` },
          { id: "JM_DRIVE", label: "Jamaica Vibes", data: `# 🇯🇲 Jamaica Vibes\nMontego Bay, Jamaica START\nNegril, Jamaica\nTreasure Beach, Jamaica\nKingston, Jamaica\nBlue Mountains, Jamaica\nPort Antonio, Jamaica\nOcho Rios, Jamaica` },
          { id: "CU_DRIVE", label: "Cuba Classic", data: `# 🇨🇺 Cuba Classic\nHavana, Cuba START\nViñales, Cuba\nCienfuegos, Cuba\nTrinidad, Cuba\nSanta Clara, Cuba\nVaradero, Cuba\nMatanzas, Cuba` },
          { id: "GT_DRIVE", label: "Guatemala Mayan", data: `# 🇬🇹 Guatemala Mayan\nGuatemala City, Guatemala START\nAntigua, Guatemala\nLake Atitlan, Guatemala\nChichicastenango, Guatemala\nCoban, Guatemala\nSemuc Champey, Guatemala\nFlores, Guatemala\nTikal, Guatemala` },
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
          { id: "PE_DRIVE", label: "Peru Incas", data: `# 🇵🇪 Peru Incas\nLima, Peru START\nParacas, Peru\nHuacachina, Peru\nNazca Lines, Peru\nArequipa, Peru\nPuno, Peru\nCusco, Peru\nSacred Valley, Peru\nMachu Picchu, Peru` },
          { id: "BR_DRIVE", label: "Brazil Coast", data: `# 🇧🇷 Brazil Coast\nRio de Janeiro, Brazil START\nParaty, Brazil\nSao Paulo, Brazil\nCuritiba, Brazil\nFlorianopolis, Brazil\nPorto Alegre, Brazil\nIguazu Falls, Brazil` },
          { id: "AR_DRIVE", label: "Argentina North-South", data: `# 🇦🇷 Argentina North-South\nBuenos Aires, Argentina START\nRosario, Argentina\nCordoba, Argentina\nMendoza, Argentina\nBariloche, Argentina\nEl Calafate, Argentina\nUshuaia, Argentina` },
          { id: "CL_DRIVE", label: "Chile Long Road", data: `# 🇨🇱 Chile Long Road\nSantiago, Chile START\nValparaiso, Chile\nLa Serena, Chile\nSan Pedro de Atacama, Chile\nPucon, Chile\nPuerto Montt, Chile\nTorres del Paine, Chile` },
          { id: "CO_DRIVE", label: "Colombia Colors", data: `# 🇨🇴 Colombia Colors\nBogota, Colombia START\nVilla de Leyva, Colombia\nSalento, Colombia\nMedellin, Colombia\nGuatape, Colombia\nCartagena, Colombia\nTayrona National Park, Colombia` },
          { id: "EC_DRIVE", label: "Ecuador Andes", data: `# 🇪🇨 Ecuador Andes\nQuito, Ecuador START\nOtavalo, Ecuador\nCotopaxi, Ecuador\nQuilotoa Loop, Ecuador\nBaños, Ecuador\nRiobamba, Ecuador\nCuenca, Ecuador` },
          { id: "BO_DRIVE", label: "Bolivia Highs", data: `# 🇧🇴 Bolivia Highs\nLa Paz, Bolivia START\nCopacabana, Bolivia\nCoroico, Bolivia\nOruro, Bolivia\nUyuni (Salt Flats), Bolivia\nPotosi, Bolivia\nSucre, Bolivia` },
          { id: "UY_DRIVE", label: "Uruguay Coast", data: `# 🇺🇾 Uruguay Coast\nMontevideo, Uruguay START\nPiriapolis, Uruguay\nPunta del Este, Uruguay\nJose Ignacio, Uruguay\nLa Paloma, Uruguay\nPunta del Diablo, Uruguay` },
          { id: "PY_DRIVE", label: "Paraguay Missions", data: `# 🇵🇾 Paraguay Missions\nAsuncion, Paraguay START\nEncarnacion, Paraguay\nJesuit Missions (Trinidad), Paraguay\nCiudad del Este, Paraguay\nYbycui, Paraguay` },
          { id: "PATAGONIA_DRIVE", label: "Patagonia Wild", data: `# 🏔️ Patagonia Wild\nBariloche, Argentina START\nEl Bolson, Argentina\nCarretera Austral, Chile\nEl Chalten, Argentina\nEl Calafate, Argentina\nPuerto Natales, Chile\nTorres del Paine, Chile\nUshuaia, Argentina` }
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
          { id: "AU_EAST_DRIVE", label: "Australia East Coast", data: `# 🇦🇺 Australia East Coast\nSydney, Australia START\nBlue Mountains, Australia\nNewcastle, NSW, Australia\nPort Macquarie, Australia\nByron Bay, Australia\nGold Coast, Australia\nBrisbane, Australia\nNoosa, Australia\nFraser Island, Australia\nCairns, Australia` },
          { id: "AU_SOUTH_DRIVE", label: "Australia Ocean Rd", data: `# 🇦🇺 Australia Ocean Rd\nMelbourne, Australia START\nGeelong, Australia\nTorquay, Australia\nApollo Bay, Australia\nTwelve Apostles, Australia\nWarrnambool, Australia\nMount Gambier, Australia\nAdelaide, Australia` },
          { id: "NZ_NORTH_DRIVE", label: "NZ North Island", data: `# 🇳🇿 NZ North Island\nAuckland, New Zealand START\nCoromandel, New Zealand\nHobbiton, New Zealand\nRotorua, New Zealand\nTaupo, New Zealand\nTongariro National Park, New Zealand\nNapier, New Zealand\nWellington, New Zealand` },
          { id: "NZ_SOUTH_DRIVE", label: "NZ South Island", data: `# 🇳🇿 NZ South Island\nChristchurch, New Zealand START\nLake Tekapo, New Zealand\nMount Cook, New Zealand\nWanaka, New Zealand\nQueenstown, New Zealand\nTe Anau, New Zealand\nMilford Sound, New Zealand\nFranz Josef Glacier, New Zealand` },
          { id: "FJ_DRIVE", label: "Fiji Viti Levu", data: `# 🇫🇯 Fiji Viti Levu\nNadi, Fiji START\nSigatoka Sand Dunes, Fiji\nCoral Coast, Fiji\nPacific Harbour, Fiji\nSuva, Fiji\nRakiraki, Fiji\nLautoka, Fiji` }
        ]
      }
    ]
  }
];