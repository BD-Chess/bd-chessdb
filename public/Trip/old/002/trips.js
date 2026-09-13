/* TRIP LIBRARY (Database)
   -----------------------
   Structure: Region -> Categories -> Trips
   Format: { id: "UNIQUE_ID", label: "Display Name", data: "Text content..." }
   Updated: Organized Regions (North America, Central America, Caribbean separated).
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
Eiffel Tower, Paris | 48.8584, 2.2945 START
Colosseum, Rome | 41.8902, 12.4922
Statue of Liberty, NYC | 40.6892, -74.0445
Machu Picchu, Peru | -13.1631, -72.5450
Taj Mahal, India | 27.1751, 78.0421
Pyramids of Giza, Egypt | 29.9792, 31.1342
Great Wall (Mutianyu), China | 40.4319, 116.5704
Sydney Opera House, Australia | -33.8568, 151.2153
Christ the Redeemer, Brazil | -22.9519, -43.2105
Burj Khalifa, Dubai | 25.1972, 55.2744` 
          },
          {
            id: "EIFFEL_FULL",
            label: "🇫🇷 Eiffel Tower & Around (Paris)",
            data: `# 🇫🇷 Paris: Eiffel Tower District
# A classic Parisian day out
Trocadéro Gardens | 48.8616, 2.2893 START
Eiffel Tower | 48.8584, 2.2945
Champ de Mars | 48.8556, 2.2986
Seine Cruise Dock | 48.8633, 2.2878
Musée du Quai Branly | 48.8609, 2.2975
Pont Alexandre III | 48.8639, 2.3136
Invalides (Napoleon's Tomb) | 48.8561, 2.3127
Rue Cler Market | 48.8576, 2.3060`
          },
          {
            id: "COLOSSEUM_FULL",
            label: "🇮🇹 Colosseum & Ancient Rome",
            data: `# 🇮🇹 Rome: Ancient City
# The heart of the Roman Empire
Colosseum | 41.8902, 12.4922 START
Arch of Constantine | 41.8898, 12.4906
Roman Forum | 41.8925, 12.4853
Palatine Hill | 41.8894, 12.4874
Capitoline Museums | 41.8931, 12.4824
Piazza Venezia | 41.8962, 12.4828
Trajan's Market | 41.8956, 12.4862
Pantheon | 41.8986, 12.4769`
          },
          {
            id: "LIBERTY_FULL",
            label: "🇺🇸 Statue of Liberty & Lower Manhattan",
            data: `# 🇺🇸 NYC: Liberty & Financial District
# Ferries and Skyscrapers
Battery Park | 40.7033, -74.0170 START
Statue of Liberty | 40.6892, -74.0445
Ellis Island Museum | 40.6995, -74.0396
Charging Bull | 40.7056, -74.0134
NY Stock Exchange | 40.7069, -74.0113
Federal Hall | 40.7074, -74.0102
9/11 Memorial | 40.7115, -74.0132
One World Observatory | 40.7127, -74.0134`
          },
          {
            id: "MACHU_FULL",
            label: "🇵🇪 Machu Picchu & Sacred Valley",
            data: `# 🇵🇪 Peru: The Inca Trail (Express)
# From Cusco to the Citadel
Cusco Plaza de Armas | -13.5168, -71.9788 START
Sacsayhuaman | -13.5099, -71.9817
Pisac Ruins | -13.4032, -71.8436
Ollantaytambo Ruins | -13.2562, -72.2636
Aguas Calientes | -13.1547, -72.5255
Machu Picchu Citadel | -13.1631, -72.5450
Huayna Picchu | -13.1561, -72.5456
Sun Gate (Inti Punku) | -13.1645, -72.5366`
          },
          {
            id: "TAJ_FULL",
            label: "🇮🇳 Taj Mahal & Agra Fort",
            data: `# 🇮🇳 Agra: Mughal Heritage
# The symbol of love and power
Taj Mahal | 27.1751, 78.0421 START
Agra Fort | 27.1795, 78.0211
Mehtab Bagh | 27.1800, 78.0420
Itmad-ud-Daulah | 27.1929, 78.0310
Tomb of Akbar | 27.2205, 77.9505
Kinari Bazar | 27.1843, 78.0163`
          },
          {
            id: "GIZA_FULL",
            label: "🇪🇬 Pyramids of Giza & Sphinx",
            data: `# 🇪🇬 Cairo: Ancient Wonders
# The Giza Plateau
Great Pyramid (Khufu) | 29.9792, 31.1342 START
Pyramid of Khafre | 29.9760, 31.1308
Pyramid of Menkaure | 29.9725, 31.1283
Great Sphinx | 29.9753, 31.1376
Valley Temple | 29.9749, 31.1384
Grand Egyptian Museum | 29.9947, 31.1195
Khan el-Khalili Market | 30.0477, 31.2623`
          },
          {
            id: "WALL_FULL",
            label: "🇨🇳 Great Wall (Mutianyu) & Beijing",
            data: `# 🇨🇳 Beijing: The Great Wall
# A day trip to the wall + city highlights
Mutianyu Great Wall | 40.4319, 116.5704 START
Ming Tombs | 40.2526, 116.2235
Summer Palace | 39.9999, 116.2755
Forbidden City | 39.9163, 116.3972
Tiananmen Square | 39.9055, 116.3976
Jingshan Park | 39.9252, 116.3965
Temple of Heaven | 39.8822, 116.4068`
          },
          {
            id: "SYDNEY_FULL",
            label: "🇦🇺 Sydney Opera House & Harbour",
            data: `# 🇦🇺 Sydney: The Harbour Loop
# Iconic Aussie Views
Sydney Opera House | -33.8568, 151.2153 START
Royal Botanic Garden | -33.8642, 151.2166
Mrs Macquarie's Chair | -33.8598, 151.2226
The Rocks | -33.8599, 151.2091
Harbour Bridge Pylon | -33.8549, 151.2105
Darling Harbour | -33.8749, 151.2009
Queen Victoria Building | -33.8718, 151.2067
Sydney Tower Eye | -33.8705, 151.2088`
          },
          {
            id: "RIO_FULL",
            label: "🇧🇷 Christ the Redeemer & Rio",
            data: `# 🇧🇷 Rio de Janeiro: Icons
# From the mountain to the sea
Christ the Redeemer | -22.9519, -43.2105 START
Sugarloaf Mountain | -22.9496, -43.1547
Copacabana Beach | -22.9694, -43.1868
Ipanema Beach | -22.9843, -43.2033
Selarón Steps | -22.9154, -43.1793
Metropolitan Cathedral | -22.9103, -43.1797
Maracanã Stadium | -22.9121, -43.2302`
          },
          {
            id: "DUBAI_FULL",
            label: "🇦🇪 Burj Khalifa & Downtown Dubai",
            data: `# 🇦🇪 Dubai: Downtown Luxury
# The tallest building and biggest mall
Burj Khalifa | 25.1972, 55.2744 START
Dubai Mall | 25.1988, 55.2796
Dubai Aquarium | 25.1974, 55.2785
Dubai Fountain | 25.1963, 55.2754
Souk Al Bahar | 25.1953, 55.2764
Dubai Opera | 25.1950, 55.2721
Sky Views Observatory | 25.1996, 55.2715
Museum of the Future | 25.2191, 55.2818`
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
          { id: "FRANCE_DRIVE", label: "France (Grand Tour)", data: `# 🇫🇷 France Grand Tour\nParis | 48.8566, 2.3522 START\nRouen | 49.4432, 1.0999\nMont Saint-Michel | 48.6360, -1.5115\nBordeaux | 44.8378, -0.5792\nToulouse | 43.6047, 1.4442\nCarcassonne | 43.2128, 2.3531\nMarseille | 43.2965, 5.3698\nNice | 43.7102, 7.2620\nLyon | 45.7640, 4.8357\nStrasbourg | 48.5734, 7.7521` },
          { id: "ITALY_DRIVE", label: "Italy (Bella Italia)", data: `# 🇮🇹 Italy Bella Italia\nMilan | 45.4642, 9.1900 START\nVenice | 45.4408, 12.3155\nBologna | 44.4949, 11.3426\nFlorence | 43.7696, 11.2558\nPisa | 43.7228, 10.4017\nRome | 41.9028, 12.4964\nNaples | 40.8518, 14.2681\nBari | 41.1171, 16.8719\nPalermo | 38.1157, 13.3615\nGenoa | 44.4056, 8.9463` },
          { id: "SPAIN_DRIVE", label: "Spain (Fiesta Route)", data: `# 🇪🇸 Spain Fiesta Route\nMadrid | 40.4168, -3.7038 START\nToledo | 39.8628, -4.0273\nValencia | 39.4699, -0.3763\nBarcelona | 41.3851, 2.1734\nZaragoza | 41.6488, -0.8891\nBilbao | 43.2630, -2.9350\nSantiago de Compostela | 42.8782, -8.5448\nSeville | 37.3891, -5.9845\nGranada | 37.1773, -3.5986\nMalaga | 36.7213, -4.4214` },
          { id: "GERMANY_DRIVE", label: "Germany (Autobahn)", data: `# 🇩🇪 Germany Autobahn\nBerlin | 52.5200, 13.4050 START\nHamburg | 53.5511, 9.9937\nCologne Cathedral | 50.9413, 6.9583\nFrankfurt | 50.1109, 8.6821\nHeidelberg | 49.3988, 8.6724\nStuttgart | 48.7758, 9.1829\nMunich | 48.1351, 11.5820\nNeuschwanstein Castle | 47.5576, 10.7498\nNuremberg | 49.4521, 11.0767\nDresden | 51.0504, 13.7373` },
          { id: "UK_DRIVE", label: "UK (Royal Route)", data: `# 🇬🇧 UK Royal Route\nLondon | 51.5074, -0.1278 START\nOxford | 51.7520, -1.2577\nBath | 51.3758, -2.3599\nStonehenge | 51.1789, -1.8262\nCardiff | 51.4816, -3.1791\nLiverpool | 53.4084, -2.9916\nManchester | 53.4808, -2.2426\nYork | 53.9591, -1.0815\nEdinburgh | 55.9533, -3.1883\nInverness | 57.4778, -4.2247` },
          { id: "ICELAND_DRIVE", label: "Iceland (Ring Road)", data: `# 🇮🇸 Iceland Ring Road\nReykjavik | 64.1265, -21.8174 START\nVik | 63.4194, -19.0060\nHofn | 64.2497, -15.2020\nEgilsstadir | 65.2669, -14.3948\nHusavik | 66.0450, -17.3383\nAkureyri | 65.6835, -18.0878\nSnaefellsnes | 64.8656, -23.1979\nGolden Circle | 64.2559, -21.1295` },
          { id: "NORWAY_DRIVE", label: "Norway (Fjords)", data: `# 🇳🇴 Norway Fjords\nOslo | 59.9139, 10.7522 START\nKristiansand | 58.1467, 7.9956\nStavanger | 58.9690, 5.7331\nBergen | 60.3913, 5.3221\nFlam | 60.8608, 7.1118\nGeirangerfjord | 62.1008, 7.2059\nAlesund | 62.4722, 6.1495\nTrondheim | 63.4305, 10.3951\nLofoten Islands | 68.2086, 13.5553\nTromso | 69.6492, 18.9553` },
          { id: "SWISS_DRIVE", label: "Switzerland (Alps)", data: `# 🇨🇭 Switzerland Alps\nZurich | 47.3769, 8.5417 START\nLucerne | 47.0502, 8.3093\nInterlaken | 46.6863, 7.8632\nBern | 46.9480, 7.4474\nLausanne | 46.5197, 6.6323\nGeneva | 46.2044, 6.1432\nZermatt | 46.0207, 7.7491\nLugano | 46.0037, 8.9511\nSt. Moritz | 46.4908, 9.8355\nVaduz | 47.1410, 9.5209` },
          { id: "GREECE_DRIVE", label: "Greece (Ancient)", data: `# 🇬🇷 Greece Ancient Route\nAthens | 37.9838, 23.7275 START\nDelphi | 38.4800, 22.5012\nMeteora | 39.7126, 21.6310\nThessaloniki | 40.6401, 22.9444\nIoannina | 39.6650, 20.8537\nPatras | 38.2466, 21.7346\nOlympia | 37.6384, 21.6297\nSparta | 37.0745, 22.4303\nNafplio | 37.5667, 22.7963\nCorinth | 37.9382, 22.9298` },
          { id: "SLOVENIA_DRIVE", label: "Slovenia (Full Loop)", data: `# 🇸🇮 Slovenia Full Loop\nLjubljana | 46.0569, 14.5058 START\nLake Bled | 46.3683, 14.0938\nKranjska Gora | 46.4845, 13.7857\nBovec | 46.3376, 13.5517\nPostojna Cave | 45.7820, 14.2038\nPiran | 45.5283, 13.5682\nLipica Stud Farm | 45.6666, 13.8824\nMaribor | 46.5547, 15.6459\nPtuj | 46.4201, 15.8698\nVelika Planina | 46.2945, 14.6548` }
        ]
      },
      {
        name: "🚶 All 27 EU Capitals (Walking)",
        items: [
          { id: "VIENNA", label: "🇦🇹 Vienna", data: `# 🇦🇹 Vienna Walking Tour\nSt. Stephen's Cathedral | 48.2085, 16.3738 START\nHofburg Palace | 48.2065, 16.3651\nSchönbrunn Palace | 48.1848, 16.3122\nBelvedere Palace | 48.1915, 16.3809\nPrater (Giant Ferris Wheel) | 48.2173, 16.3976\nNaschmarkt | 48.1983, 16.3619\nVienna Opera House | 48.2030, 16.3691\nRathaus (City Hall) | 48.2109, 16.3571\nMuseumsquartier | 48.2037, 16.3589\nKarlskirche | 48.1982, 16.3713` },
          { id: "BRUSSELS", label: "🇧🇪 Brussels", data: `# 🇧🇪 Brussels Walking Tour\nGrand Place | 50.8467, 4.3524 START\nManneken Pis | 50.8450, 4.3499\nAtomium | 50.8949, 4.3415\nRoyal Palace of Brussels | 50.8422, 4.3629\nParc du Cinquantenaire | 50.8407, 4.3945\nMagritte Museum | 50.8424, 4.3582\nMont des Arts | 50.8433, 4.3578\nSt. Michael Cathedral | 50.8477, 4.3601\nRoyal Gallery of Saint Hubert | 50.8475, 4.3546\nEuropean Parliament | 50.8371, 4.3737` },
          { id: "SOFIA", label: "🇧🇬 Sofia", data: `# 🇧🇬 Sofia Walking Tour\nAlexander Nevsky Cathedral | 42.6958, 23.3328 START\nVitosha Boulevard | 42.6908, 23.3213\nNational Palace of Culture | 42.6853, 23.3190\nBoyana Church | 42.6449, 23.2662\nSaint Sofia Church | 42.6965, 23.3314\nSofia Synagogue | 42.7003, 23.3211\nIvan Vazov National Theatre | 42.6943, 23.3262\nRotunda of St. George | 42.6969, 23.3228\nRegional History Museum | 42.6994, 23.3235\nEagles' Bridge | 42.6912, 23.3375` },
          { id: "ZAGREB", label: "🇭🇷 Zagreb", data: `# 🇭🇷 Zagreb Walking Tour\nBan Jelačić Square | 45.8131, 15.9775 START\nZagreb Cathedral | 45.8144, 15.9796\nSt. Mark's Church | 45.8162, 15.9738\nMuseum of Broken Relationships | 45.8150, 15.9742\nLotrščak Tower | 45.8145, 15.9733\nTkalčićeva Street | 45.8159, 15.9763\nDolac Market | 45.8137, 15.9771\nCroatian National Theatre | 45.8115, 15.9691\nZrinjevac Park | 45.8105, 15.9782\nMaksimir Park | 45.8236, 16.0210` },
          { id: "NICOSIA", label: "🇨🇾 Nicosia", data: `# 🇨🇾 Nicosia Walking Tour\nLedra Street | 35.1724, 33.3608 START\nBuyuk Han | 35.1764, 33.3617\nSelimiye Camii | 35.1766, 33.3644\nCyprus Museum | 35.1718, 33.3559\nFamagusta Gate | 35.1746, 33.3712\nShacolas Tower Observatory | 35.1720, 33.3614\nArchbishop's Palace | 35.1735, 33.3664\nLeventis Municipal Museum | 35.1706, 33.3606\nOmeriye Hamam | 35.1715, 33.3653\nVenetian Walls | 35.1691, 33.3598` },
          { id: "PRAGUE", label: "🇨🇿 Prague", data: `# 🇨🇿 Prague Walking Tour\nCharles Bridge | 50.0865, 14.4114 START\nPrague Castle | 50.0911, 14.4016\nOld Town Square | 50.0875, 14.4213\nDancing House | 50.0755, 14.4141\nSt. Vitus Cathedral | 50.0909, 14.4005\nWenceslas Square | 50.0811, 14.4279\nPetrin Tower | 50.0835, 14.3951\nNational Museum | 50.0791, 14.4304\nVyšehrad Fortress | 50.0645, 14.4196\nLennon Wall | 50.0862, 14.4068` },
          { id: "COPENHAGEN", label: "🇩🇰 Copenhagen", data: `# 🇩🇰 Copenhagen Walking Tour\nNyhavn | 55.6795, 12.5910 START\nThe Little Mermaid | 55.6929, 12.5993\nTivoli Gardens | 55.6737, 12.5681\nAmalienborg Palace | 55.6841, 12.5931\nRosenborg Castle | 55.6858, 12.5775\nChristiansborg Palace | 55.6761, 12.5804\nStrøget Shopping Mile | 55.6785, 12.5719\nRound Tower | 55.6814, 12.5757\nMarble Church | 55.6852, 12.5896\nTorvehallerne Market | 55.6837, 12.5694` },
          { id: "TALLINN", label: "🇪🇪 Tallinn", data: `# 🇪🇪 Tallinn Walking Tour\nTallinn Old Town Square | 59.4370, 24.7450 START\nToompea Castle | 59.4357, 24.7371\nAlexander Nevsky Cathedral | 59.4359, 24.7390\nKadriorg Park | 59.4390, 24.7909\nSt. Olaf's Church | 59.4413, 24.7477\nKiek in de Kök Tower | 59.4346, 24.7408\nViru Gate | 59.4366, 24.7503\nSeaplane Harbour Museum | 59.4513, 24.7392\nTelliskivi Creative City | 59.4402, 24.7291\nTallinn TV Tower | 59.4711, 24.8875` },
          { id: "HELSINKI", label: "🇫🇮 Helsinki", data: `# 🇫🇮 Helsinki Walking Tour\nHelsinki Cathedral | 60.1704, 24.9522 START\nSuomenlinna Fortress | 60.1468, 24.9902\nTemppeliaukio Church (Rock Church) | 60.1730, 24.9252\nMarket Square | 60.1676, 24.9534\nUspenski Cathedral | 60.1687, 24.9599\nSibelius Monument | 60.1821, 24.9134\nEsplanadi Park | 60.1675, 24.9472\nKiasma Museum | 60.1718, 24.9372\nSeurasaari Open-Air Museum | 60.1825, 24.8845\nKamppi Chapel | 60.1703, 24.9358` },
          { id: "PARIS", label: "🇫🇷 Paris", data: `# 🇫🇷 Paris Walking Tour\nEiffel Tower | 48.8584, 2.2945 START\nLouvre Museum | 48.8606, 2.3376\nNotre Dame Cathedral | 48.8529, 2.3500\nArc de Triomphe | 48.8738, 2.2950\nSacré-Cœur Basilica | 48.8867, 2.3431\nMusée d'Orsay | 48.8599, 2.3265\nSainte-Chapelle | 48.8554, 2.3450\nPalais Garnier | 48.8719, 2.3316\nLuxembourg Gardens | 48.8462, 2.3371\nPlace de la Concorde | 48.8656, 2.3212` },
          { id: "BERLIN", label: "🇩🇪 Berlin", data: `# 🇩🇪 Berlin Walking Tour\nBrandenburg Gate | 52.5163, 13.3777 START\nReichstag Building | 52.5186, 13.3761\nBerlin Wall Memorial | 52.5350, 13.3900\nCheckpoint Charlie | 52.5074, 13.3904\nMuseum Island | 52.5169, 13.4010\nAlexanderplatz TV Tower | 52.5208, 13.4094\nEast Side Gallery | 52.5050, 13.4397\nMemorial to the Murdered Jews | 52.5139, 13.3787\nPotsdamer Platz | 52.5096, 13.3759\nCharlottenburg Palace | 52.5205, 13.2958` },
          { id: "ATHENS", label: "🇬🇷 Athens", data: `# 🇬🇷 Athens Walking Tour\nAcropolis of Athens | 37.9715, 23.7257 START\nParthenon | 37.9715, 23.7266\nPlaka District | 37.9719, 23.7300\nSyntagma Square | 37.9755, 23.7348\nTemple of Olympian Zeus | 37.9693, 23.7331\nAncient Agora | 37.9750, 23.7224\nPanathenaic Stadium | 37.9685, 23.7411\nMonastiraki Square | 37.9760, 23.7255\nNational Archaeological Museum | 37.9891, 23.7324\nMount Lycabettus | 37.9819, 23.7431` },
          { id: "BUDAPEST", label: "🇭🇺 Budapest", data: `# 🇭🇺 Budapest Walking Tour\nHungarian Parliament | 47.5071, 19.0456 START\nBuda Castle | 47.4962, 19.0396\nFisherman's Bastion | 47.5020, 19.0349\nSzéchenyi Thermal Bath | 47.5189, 19.0823\nSt. Stephen's Basilica | 47.5008, 19.0539\nChain Bridge | 47.4984, 19.0432\nHeroes' Square | 47.5149, 19.0777\nCentral Market Hall | 47.4871, 19.0585\nMatthias Church | 47.5019, 19.0343\nGellért Hill Citadel | 47.4868, 19.0483` },
          { id: "DUBLIN", label: "🇮🇪 Dublin", data: `# 🇮🇪 Dublin Walking Tour\nTemple Bar | 53.3454, -6.2641 START\nTrinity College | 53.3438, -6.2546\nGuinness Storehouse | 53.3419, -6.2867\nDublin Castle | 53.3429, -6.2674\nSt. Patrick's Cathedral | 53.3395, -6.2715\nSt. Stephen's Green | 53.3382, -6.2591\nKilmainham Gaol | 53.3418, -6.3098\nGrafton Street | 53.3408, -6.2606\nHa'penny Bridge | 53.3463, -6.2631\nPhoenix Park | 53.3559, -6.3298` },
          { id: "ROME", label: "🇮🇹 Rome", data: `# 🇮🇹 Rome Walking Tour\nColosseum | 41.8902, 12.4922 START\nPantheon | 41.8986, 12.4769\nTrevi Fountain | 41.9009, 12.4833\nSpanish Steps | 41.9057, 12.4823\nSt. Peter's Basilica (Vatican) | 41.9022, 12.4539\nRoman Forum | 41.8925, 12.4853\nPiazza Navona | 41.8992, 12.4731\nCastel Sant'Angelo | 41.9031, 12.4663\nVilla Borghese | 41.9129, 12.4852\nTrastevere District | 41.8891, 12.4691` },
          { id: "RIGA", label: "🇱🇻 Riga", data: `# 🇱🇻 Riga Walking Tour\nHouse of the Blackheads | 56.9472, 24.1068 START\nRiga Central Market | 56.9442, 24.1166\nSt. Peter's Church | 56.9476, 24.1093\nFreedom Monument | 56.9515, 24.1132\nRiga Cathedral | 56.9493, 24.1044\nThree Brothers | 56.9504, 24.1046\nArt Nouveau District | 56.9596, 24.1077\nSwedish Gate | 56.9512, 24.1058\nLatvian National Opera | 56.9497, 24.1137\nPowder Tower | 56.9510, 24.1086` },
          { id: "VILNIUS", label: "🇱🇹 Vilnius", data: `# 🇱🇹 Vilnius Walking Tour\nGediminas' Tower | 54.6871, 25.2908 START\nVilnius Cathedral | 54.6858, 25.2878\nGate of Dawn | 54.6744, 25.2895\nUzupis Republic | 54.6806, 25.2968\nSt. Anne's Church | 54.6832, 25.2929\nVilnius University | 54.6828, 25.2869\nMuseum of Occupations (KGB) | 54.6879, 25.2704\nThree Crosses | 54.6868, 25.2974\nBernardine Garden | 54.6841, 25.2954\nHales Market | 54.6738, 25.2855` },
          { id: "LUXEMBOURG", label: "🇱🇺 Luxembourg", data: `# 🇱🇺 Luxembourg Walking Tour\nLe Chemin de la Corniche | 49.6108, 6.1352 START\nCasemates du Bock | 49.6119, 6.1358\nGrand Ducal Palace | 49.6109, 6.1328\nNotre-Dame Cathedral | 49.6096, 6.1315\nAdolphe Bridge | 49.6083, 6.1273\nPlace Guillaume II | 49.6103, 6.1296\nNeumünster Abbey | 49.6106, 6.1378\nPfaffenthal Lift | 49.6133, 6.1314\nMUDAM Museum | 49.6201, 6.1408\nPlace d'Armes | 49.6111, 6.1297` },
          { id: "VALLETTA", label: "🇲🇹 Valletta", data: `# 🇲🇹 Valletta Walking Tour\nSt. John's Co-Cathedral | 35.8976, 14.5126 START\nUpper Barrakka Gardens | 35.8950, 14.5126\nGrandmaster's Palace | 35.8986, 14.5147\nFort St Elmo | 35.9015, 14.5186\nCasa Rocca Piccola | 35.8997, 14.5152\nLower Barrakka Gardens | 35.8983, 14.5178\nTriton Fountain | 35.8958, 14.5083\nNational Museum of Archaeology | 35.8974, 14.5108\nSaluting Battery | 35.8948, 14.5128\nVictoria Gate | 35.8961, 14.5144` },
          { id: "AMSTERDAM", label: "🇳🇱 Amsterdam", data: `# 🇳🇱 Amsterdam Walking Tour\nRijksmuseum | 52.3600, 4.8852 START\nAnne Frank House | 52.3752, 4.8840\nVondelpark | 52.3580, 4.8686\nDam Square | 52.3731, 4.8922\nVan Gogh Museum | 52.3584, 4.8811\nJordaan District | 52.3725, 4.8787\nHeineken Experience | 52.3579, 4.8917\nRed Light District (De Wallen) | 52.3723, 4.8980\nBloemenmarkt | 52.3668, 4.8910\nRoyal Palace Amsterdam | 52.3732, 4.8913` },
          { id: "WARSAW", label: "🇵🇱 Warsaw", data: `# 🇵🇱 Warsaw Walking Tour\nOld Town Market Place | 52.2499, 21.0123 START\nRoyal Castle | 52.2480, 21.0152\nPalace of Culture and Science | 52.2318, 21.0060\nŁazienki Park | 52.2154, 21.0354\nWarsaw Uprising Museum | 52.2323, 20.9806\nNowy Świat Street | 52.2334, 21.0195\nPOLIN Museum | 52.2494, 20.9937\nCopernicus Science Centre | 52.2418, 21.0286\nSaxon Garden | 52.2405, 21.0098\nBarbican | 52.2514, 21.0108` },
          { id: "LISBON", label: "🇵🇹 Lisbon", data: `# 🇵🇹 Lisbon Walking Tour\nBelém Tower | 38.6916, -9.2160 START\nJerónimos Monastery | 38.6978, -9.2067\nPraça do Comércio | 38.7075, -9.1364\nCastelo de S. Jorge | 38.7139, -9.1335\nSanta Justa Lift | 38.7121, -9.1394\nAlfama District | 38.7118, -9.1293\nRossio Square | 38.7138, -9.1394\nTime Out Market | 38.7071, -9.1458\nLxFactory | 38.7032, -9.1788\nMonument to the Discoveries | 38.6936, -9.2057` },
          { id: "BUCHAREST", label: "🇷🇴 Bucharest", data: `# 🇷🇴 Bucharest Walking Tour\nPalace of Parliament | 44.4275, 26.0874 START\nRomanian Athenaeum | 44.4413, 26.0972\nOld Town (Lipscani) | 44.4326, 26.1030\nHerastrau Park | 44.4715, 26.0845\nVillage Museum | 44.4719, 26.0772\nStavropoleos Monastery | 44.4319, 26.0984\nRevolution Square | 44.4394, 26.0974\nCismigiu Gardens | 44.4367, 26.0911\nArcul de Triumf | 44.4673, 26.0781\nNational Museum of Art | 44.4395, 26.0959` },
          { id: "BRATISLAVA", label: "🇸🇰 Bratislava", data: `# 🇸🇰 Bratislava Walking Tour\nBratislava Castle | 48.1422, 17.1002 START\nSt. Martin's Cathedral | 48.1406, 17.1051\nMichael's Gate | 48.1451, 17.1068\nBlue Church | 48.1435, 17.1169\nOld Town Hall | 48.1435, 17.1089\nUFO Observation Deck | 48.1366, 17.1046\nPrimate's Palace | 48.1444, 17.1095\nGrassalkovich Palace | 48.1492, 17.1077\nSlavín War Memorial | 48.1539, 17.0997\nCumil (Man at Work Statue) | 48.1430, 17.1081` },
          { id: "LJUBLJANA", label: "🇸🇮 Ljubljana", data: `# 🇸🇮 Ljubljana Walking Tour\nPrešernov trg | 46.0514, 14.5061 START\nTriple Bridge | 46.0510, 14.5062\nCentral Market | 46.0511, 14.5085\nDragon Bridge | 46.0520, 14.5104\nLjubljana Castle | 46.0489, 14.5089\nTown Hall | 46.0498, 14.5069\nCobblers' Bridge | 46.0484, 14.5055\nCongress Square | 46.0501, 14.5034\nTivoli Park | 46.0562, 14.4965\nMetelkova Art Center | 46.0567, 14.5173` },
          { id: "MADRID", label: "🇪🇸 Madrid", data: `# 🇪🇸 Madrid Walking Tour\nRoyal Palace of Madrid | 40.4180, -3.7143 START\nPlaza Mayor | 40.4154, -3.7074\nRetiro Park | 40.4153, -3.6845\nPrado Museum | 40.4138, -3.6921\nPuerta del Sol | 40.4169, -3.7035\nGran Vía | 40.4203, -3.7058\nReina Sofía Museum | 40.4082, -3.6944\nTemple of Debod | 40.4240, -3.7176\nMercado de San Miguel | 40.4156, -3.7089\nCibeles Fountain | 40.4194, -3.6931` },
          { id: "STOCKHOLM", label: "🇸🇪 Stockholm", data: `# 🇸🇪 Stockholm Walking Tour\nGamla Stan | 59.3251, 18.0708 START\nVasa Museum | 59.3280, 18.0914\nSkansen Open-Air Museum | 59.3248, 18.1011\nStockholm Palace | 59.3268, 18.0717\nABBA The Museum | 59.3249, 18.0965\nCity Hall (Stadshus) | 59.3275, 18.0544\nDrottningholm Palace | 59.3217, 17.8868\nFotografiska | 59.3177, 18.0858\nNobel Prize Museum | 59.3253, 18.0709\nDjurgården | 59.3264, 18.1064` }
        ]
      },
      {
        name: "🇪🇺 Extreme / Full Region",
        items: [
          { id: "EUROPE_NORTH", label: "EU Capitals (North/West - 13)", data: `# 🇪🇺 EU Capitals (North/West - 13 Stops)\nDublin | 53.3498, -6.2603 START\nHelsinki | 60.1695, 24.9354\nStockholm | 59.3293, 18.0686\nTallinn | 59.4370, 24.7535\nRiga | 56.9496, 24.1052\nVilnius | 54.6872, 25.2797\nCopenhagen | 55.6761, 12.5683\nBerlin | 52.5200, 13.4050\nWarsaw | 52.2297, 21.0122\nAmsterdam | 52.3676, 4.9041\nBrussels | 50.8503, 4.3517\nLuxembourg City | 49.6116, 6.1319\nParis | 48.8566, 2.3522` },
          { id: "EUROPE_SOUTH", label: "EU Capitals (South/East - 14)", data: `# 🇪🇺 EU Capitals (South/East - 14 Stops)\nLisbon | 38.7223, -9.1393 START\nMadrid | 40.4168, -3.7038\nRome | 41.9028, 12.4964\nValletta | 35.8992, 14.5141\nAthens | 37.9838, 23.7275\nNicosia | 35.1856, 33.3823\nSofia | 42.6977, 23.3219\nBucharest | 44.4268, 26.1025\nBudapest | 47.4979, 19.0402\nVienna | 48.2082, 16.3738\nBratislava | 48.1486, 17.1077\nPrague | 50.0755, 14.4378\nLjubljana | 46.0569, 14.5058\nZagreb | 45.8150, 15.9819` },
          { id: "COMPLEX_EU", label: "💀 THE GAUNTLET (All Caps + Stops)", data: `# 🇪🇺💀 THE GAUNTLET (Capitals + Stops)\n# Warning: This is a massive route!\nVienna | 48.2082, 16.3738\nHofburg Palace | 48.2065, 16.3651\nBrussels | 50.8503, 4.3517\nGrand Place | 50.8467, 4.3524\nSofia | 42.6977, 23.3219\nAlexander Nevsky Cathedral | 42.6958, 23.3328\nZagreb | 45.8150, 15.9819\nBan Jelačić Square | 45.8131, 15.9775\nNicosia | 35.1856, 33.3823\nPrague | 50.0755, 14.4378\nCharles Bridge | 50.0865, 14.4114\nCopenhagen | 55.6761, 12.5683\nNyhavn | 55.6795, 12.5910\nTallinn | 59.4370, 24.7535\nHelsinki | 60.1695, 24.9354\nParis | 48.8566, 2.3522\nEiffel Tower | 48.8584, 2.2945\nBerlin | 52.5200, 13.4050\nBrandenburg Gate | 52.5163, 13.3777\nAthens | 37.9838, 23.7275\nAcropolis | 37.9715, 23.7257\nBudapest | 47.4979, 19.0402\nHungarian Parliament | 47.5071, 19.0456\nDublin | 53.3498, -6.2603\nTemple Bar | 53.3454, -6.2641\nRome | 41.9028, 12.4964\nColosseum | 41.8902, 12.4922\nRiga | 56.9496, 24.1052\nVilnius | 54.6872, 25.2797\nLuxembourg City | 49.6116, 6.1319\nValletta | 35.8992, 14.5141\nAmsterdam | 52.3676, 4.9041\nRijksmuseum | 52.3600, 4.8852\nWarsaw | 52.2297, 21.0122\nOld Town | 52.2499, 21.0123\nLisbon | 38.7223, -9.1393\nBelém Tower | 38.6916, -9.2160\nBucharest | 44.4268, 26.1025\nBratislava | 48.1486, 17.1077\nLjubljana | 46.0569, 14.5058\nLjubljana Castle | 46.0489, 14.5089\nMadrid | 40.4168, -3.7038\nRoyal Palace | 40.4180, -3.7143\nStockholm | 59.3293, 18.0686\nGamla Stan | 59.3251, 18.0708` }
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
          { id: "ZA_DRIVE", label: "South Africa Highlights", data: `# 🇿🇦 South Africa Highlights\nCape Town, South Africa START\nTable Mountain, South Africa\nCape of Good Hope, South Africa\nStellenbosch, South Africa\nGarden Route, South Africa\nKnysna, South Africa\nDurban, South Africa\nKruger National Park, South Africa\nJohannesburg, South Africa` },
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
    region: "🌎 Americas (North & Central)",
    categories: [
      {
        name: "🚗 North America (Major)",
        items: [
          { id: "US_WEST_DRIVE", label: "USA West Coast", data: `# 🇺🇸 USA West Coast\nSeattle, WA START\nPortland, OR\nRedwood National Park, CA\nSan Francisco, CA\nYosemite National Park, CA\nMonterey, CA\nSanta Barbara, CA\nLos Angeles, CA\nSan Diego, CA\nLas Vegas, NV` },
          { id: "US_EAST_DRIVE", label: "USA East Coast", data: `# 🇺🇸 USA East Coast\nBoston, MA START\nNew York City, NY\nPhiladelphia, PA\nWashington DC\nShenandoah National Park, VA\nMyrtle Beach, SC\nCharleston, SC\nSavannah, GA\nOrlando, FL\nMiami, FL` },
          { id: "CA_WEST_DRIVE", label: "Canada Rockies", data: `# 🇨🇦 Canada Rockies\nVancouver, BC START\nWhistler, BC\nKamloops, BC\nJasper National Park, AB\nLake Louise, AB\nBanff, AB\nCalgary, AB` },
          { id: "CA_EAST_DRIVE", label: "Canada Cities", data: `# 🇨🇦 Canada Cities\nToronto, ON START\nNiagara Falls, ON\nOttawa, ON\nMontreal, QC\nQuebec City, QC\nMont Tremblant, QC\nKingston, ON` },
          { id: "MX_DRIVE", label: "Mexico Heritage", data: `# 🇲🇽 Mexico Heritage\nMexico City, Mexico START\nTeotihuacan, Mexico\nPuebla, Mexico\nOaxaca, Mexico\nSan Cristobal de las Casas, Mexico\nPalenque, Mexico\nMerida, Mexico\nChichen Itza, Mexico\nCancun, Mexico` },
          { id: "NY", label: "NYC Manhattan (Walking)", data: `# 🇺🇸 New York Manhattan (Walking)\nTimes Square, New York START\nCentral Park, New York\nEmpire State Building, New York\nBrooklyn Bridge, New York\nStatue of Liberty, New York\n9/11 Memorial, New York` }
        ]
      },
      {
        name: "🌴 Central America",
        items: [
          { id: "CR_DRIVE", label: "Costa Rica Eco", data: `# 🇨🇷 Costa Rica Eco\nSan Jose, Costa Rica START\nTortuguero, Costa Rica\nArenal Volcano, Costa Rica\nMonteverde, Costa Rica\nTamarindo, Costa Rica\nManuel Antonio, Costa Rica\nCorcovado, Costa Rica` },
          { id: "PA_DRIVE", label: "Panama Crossings", data: `# 🇵🇦 Panama Crossings\nPanama City, Panama START\nPanama Canal, Panama\nEl Valle de Anton, Panama\nChitre, Panama\nBoquete, Panama\nBocas del Toro, Panama\nPortobelo, Panama` },
          { id: "GT_DRIVE", label: "Guatemala Mayan", data: `# 🇬🇹 Guatemala Mayan\nGuatemala City, Guatemala START\nAntigua, Guatemala\nLake Atitlan, Guatemala\nChichicastenango, Guatemala\nCoban, Guatemala\nSemuc Champey, Guatemala\nFlores, Guatemala\nTikal, Guatemala` }
        ]
      },
      {
        name: "🏖️ The Caribbean",
        items: [
          { id: "JM_DRIVE", label: "Jamaica Vibes", data: `# 🇯🇲 Jamaica Vibes\nMontego Bay, Jamaica START\nNegril, Jamaica\nTreasure Beach, Jamaica\nKingston, Jamaica\nBlue Mountains, Jamaica\nPort Antonio, Jamaica\nOcho Rios, Jamaica` },
          { id: "CU_DRIVE", label: "Cuba Classic", data: `# 🇨🇺 Cuba Classic\nHavana, Cuba START\nViñales, Cuba\nCienfuegos, Cuba\nTrinidad, Cuba\nSanta Clara, Cuba\nVaradero, Cuba\nMatanzas, Cuba` }
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