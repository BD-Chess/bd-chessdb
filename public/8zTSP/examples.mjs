export const defaultExampleId = "si6035_gurs_20261115";
export const exampleGroups = [
  {
    "id": "europe",
    "names": {
      "en": "Europe",
      "sl": "Evropa"
    }
  },
  {
    "id": "americas",
    "names": {
      "en": "Americas",
      "sl": "Amerika"
    }
  },
  {
    "id": "asia",
    "names": {
      "en": "Asia",
      "sl": "Azija"
    }
  },
  {
    "id": "africa",
    "names": {
      "en": "Africa",
      "sl": "Afrika"
    }
  },
  {
    "id": "oceania",
    "names": {
      "en": "Oceania",
      "sl": "Oceanija"
    }
  },
  {
    "id": "eurasia",
    "names": {
      "en": "Europe and Asia",
      "sl": "Evropa in Azija"
    }
  },
  {
    "id": "hard",
    "names": {
      "en": "Hard instances",
      "sl": "Težki primeri"
    }
  },
  {
    "id": "random",
    "names": {
      "en": "Random",
      "sl": "Naključni"
    }
  }
];
export const examples = [
  {
    "id": "si6035_gurs_20261115",
    "gapStatus": {
      "maximumPercent": "0.007",
      "asOf": "2026-11-17",
      "proofRunning": true,
      "tourLength": 8728254,
      "tourSource": "BD × AI Lab",
      "tourDate": "2026-11-16",
      "lowerBound": 8727698,
      "boundSource": "Concorde",
      "boundAsOf": "2026-11-17 16:17"
    },
    "label": "Slovenija · vsa naselja (6.035)",
    "cities": 6035,
    "path": "./examples/si6035_gurs_20261115.tsp",
    "sha256": "5f8e7fffff3b51a97f21d99331205e01d46bf40ccda84127e6ce3848eb9de3b8",
    "bytes": 111167,
    "source": "https://podatki.gov.si/dataset/register-prostorskih-enot",
    "credit": "Geodetska uprava Republike Slovenije · RPE Naselja · prevzem 2026-11-15",
    "licence": "CC BY 4.0",
    "licenceUrl": "https://creativecommons.org/licenses/by/4.0/",
    "provenance": "./examples/si6035_gurs_20261115_provenance.json",
    "names": {
      "en": "Slovenia · all settlements",
      "sl": "Slovenija · vsa naselja"
    },
    "group": "europe",
    "descriptions": {
      "en": "Derived settlement centroids, rounded D96/TM metres; straight-line distances, not roads.",
      "sl": "Izpeljana središča naselij, zaokroženi metri D96/TM; zračne razdalje, ne ceste."
    },
    "unit": "m"
  },
  {
    "id": "wi29",
    "label": "Western Sahara · 29",
    "names": {
      "en": "Western Sahara",
      "sl": "Zahodna Sahara"
    },
    "group": "africa",
    "unit": null,
    "path": "./examples/wi29.tsp",
    "cities": 29,
    "sha256": "412a7aed609f2586ee53746b750f1ad6244a44ce0ad9f8d017a8987ae0664ce8",
    "bytes": 944,
    "source": "https://www.math.uwaterloo.ca/tsp/world/summary.html",
    "dataSource": "https://www.math.uwaterloo.ca/tsp/world/wi29.tsp",
    "credit": "National TSP collection, University of Waterloo",
    "referenceDate": "2022-07-31",
    "optimum": 27603
  },
  {
    "id": "dj38",
    "label": "Djibouti · 38",
    "names": {
      "en": "Djibouti",
      "sl": "Džibuti"
    },
    "group": "africa",
    "unit": null,
    "path": "./examples/dj38.tsp",
    "cities": 38,
    "sha256": "abdd86fd061acef713a571750a8f290cef804fe6b61eb768f8623be7ad8038bd",
    "bytes": 1465,
    "source": "https://www.math.uwaterloo.ca/tsp/world/summary.html",
    "dataSource": "https://www.math.uwaterloo.ca/tsp/world/dj38.tsp",
    "credit": "National TSP collection, University of Waterloo",
    "referenceDate": "2022-07-31",
    "optimum": 6656
  },
  {
    "id": "Tnm52",
    "names": {
      "en": "Tnm52",
      "sl": "Tnm52"
    },
    "group": "hard",
    "collection": "hougardy-zhong",
    "collectionNames": {
      "en": "Hougardy and Zhong",
      "sl": "Hougardy in Zhong"
    },
    "unit": null,
    "path": "./examples/hard/Tnm52.tsp",
    "cities": 52,
    "sha256": "9addb480e9dcbef025e79eaab66788da309fd01e5a903f4d41ed3228a0ff32f3",
    "bytes": 900,
    "optimum": 551609,
    "proof": {
      "averageSeconds": 12,
      "solver": "Concorde",
      "machine": "Xeon 2.2 GHz",
      "subtourLpRatio": 1.1207,
      "measuredBy": "Hougardy and Zhong (2021)"
    },
    "source": "https://doi.org/10.1007/s12532-020-00184-5",
    "credit": "Hougardy and Zhong (2021), Mathematical Programming Computation 13, 51-74",
    "licence": "CC BY 4.0",
    "licenceUrl": "https://creativecommons.org/licenses/by/4.0/",
    "links": [
      {
        "href": "https://doi.org/10.60507/FK2/ESZ1QZ",
        "text": {
          "en": "data set doi:10.60507/FK2/ESZ1QZ",
          "sl": "zbirka podatkov doi:10.60507/FK2/ESZ1QZ"
        }
      }
    ],
    "dataSource": "https://www.or.uni-bonn.de/~hougardy/HardTSPInstances.html"
  },
  {
    "id": "Tnm76",
    "names": {
      "en": "Tnm76",
      "sl": "Tnm76"
    },
    "group": "hard",
    "collection": "hougardy-zhong",
    "collectionNames": {
      "en": "Hougardy and Zhong",
      "sl": "Hougardy in Zhong"
    },
    "unit": null,
    "path": "./examples/hard/Tnm76.tsp",
    "cities": 76,
    "sha256": "0bb9f7a6741c7041e3bd095792b6c40e0f02baf3236989481f3adf4f36650e65",
    "bytes": 1279,
    "optimum": 949961,
    "proof": {
      "averageSeconds": 103,
      "solver": "Concorde",
      "machine": "Xeon 2.2 GHz",
      "subtourLpRatio": 1.1619,
      "measuredBy": "Hougardy and Zhong (2021)"
    },
    "source": "https://doi.org/10.1007/s12532-020-00184-5",
    "credit": "Hougardy and Zhong (2021), Mathematical Programming Computation 13, 51-74",
    "licence": "CC BY 4.0",
    "licenceUrl": "https://creativecommons.org/licenses/by/4.0/",
    "links": [
      {
        "href": "https://doi.org/10.60507/FK2/ESZ1QZ",
        "text": {
          "en": "data set doi:10.60507/FK2/ESZ1QZ",
          "sl": "zbirka podatkov doi:10.60507/FK2/ESZ1QZ"
        }
      }
    ],
    "dataSource": "https://www.or.uni-bonn.de/~hougardy/HardTSPInstances.html"
  },
  {
    "id": "Tnm100",
    "names": {
      "en": "Tnm100",
      "sl": "Tnm100"
    },
    "group": "hard",
    "collection": "hougardy-zhong",
    "collectionNames": {
      "en": "Hougardy and Zhong",
      "sl": "Hougardy in Zhong"
    },
    "unit": null,
    "path": "./examples/hard/Tnm100.tsp",
    "cities": 100,
    "sha256": "357f63dc561a5a6747378823324009d1471077c1b75596c23ed42ab8c57f05e8",
    "bytes": 1662,
    "optimum": 1398070,
    "proof": {
      "averageSeconds": 664,
      "solver": "Concorde",
      "machine": "Xeon 2.2 GHz",
      "subtourLpRatio": 1.1762,
      "measuredBy": "Hougardy and Zhong (2021)"
    },
    "source": "https://doi.org/10.1007/s12532-020-00184-5",
    "credit": "Hougardy and Zhong (2021), Mathematical Programming Computation 13, 51-74",
    "licence": "CC BY 4.0",
    "licenceUrl": "https://creativecommons.org/licenses/by/4.0/",
    "links": [
      {
        "href": "https://doi.org/10.60507/FK2/ESZ1QZ",
        "text": {
          "en": "data set doi:10.60507/FK2/ESZ1QZ",
          "sl": "zbirka podatkov doi:10.60507/FK2/ESZ1QZ"
        }
      }
    ],
    "dataSource": "https://www.or.uni-bonn.de/~hougardy/HardTSPInstances.html"
  },
  {
    "id": "Tnm151",
    "names": {
      "en": "Tnm151",
      "sl": "Tnm151"
    },
    "group": "hard",
    "collection": "hougardy-zhong",
    "collectionNames": {
      "en": "Hougardy and Zhong",
      "sl": "Hougardy in Zhong"
    },
    "unit": null,
    "path": "./examples/hard/Tnm151.tsp",
    "cities": 151,
    "sha256": "da4ebfcda1a0755ff39d1b09e516e918384c1c00c9479d4d511c483657bd288c",
    "bytes": 2510,
    "optimum": 2293265,
    "proof": {
      "averageSeconds": 18866,
      "solver": "Concorde",
      "machine": "Xeon 2.2 GHz",
      "subtourLpRatio": 1.2124,
      "measuredBy": "Hougardy and Zhong (2021)"
    },
    "source": "https://doi.org/10.1007/s12532-020-00184-5",
    "credit": "Hougardy and Zhong (2021), Mathematical Programming Computation 13, 51-74",
    "licence": "CC BY 4.0",
    "licenceUrl": "https://creativecommons.org/licenses/by/4.0/",
    "links": [
      {
        "href": "https://doi.org/10.60507/FK2/ESZ1QZ",
        "text": {
          "en": "data set doi:10.60507/FK2/ESZ1QZ",
          "sl": "zbirka podatkov doi:10.60507/FK2/ESZ1QZ"
        }
      }
    ],
    "dataSource": "https://www.or.uni-bonn.de/~hougardy/HardTSPInstances.html"
  },
  {
    "id": "qa194",
    "label": "Qatar · 194",
    "names": {
      "en": "Qatar",
      "sl": "Katar"
    },
    "group": "asia",
    "unit": null,
    "path": "./examples/qa194.tsp",
    "cities": 194,
    "sha256": "bb222094681b642ddff1bc62a8289de645e8629f51456a61c4661d4619f7d48d",
    "bytes": 5324,
    "source": "https://www.math.uwaterloo.ca/tsp/world/summary.html",
    "dataSource": "https://www.math.uwaterloo.ca/tsp/world/qa194.tsp",
    "credit": "National TSP collection, University of Waterloo",
    "referenceDate": "2022-07-31",
    "optimum": 9352
  },
  {
    "id": "Tnm199",
    "names": {
      "en": "Tnm199",
      "sl": "Tnm199"
    },
    "group": "hard",
    "collection": "hougardy-zhong",
    "collectionNames": {
      "en": "Hougardy and Zhong",
      "sl": "Hougardy in Zhong"
    },
    "unit": null,
    "path": "./examples/hard/Tnm199.tsp",
    "cities": 199,
    "sha256": "00b6653736f63576dd383503e425c688e0ac79b6e7dd7a8a38bf9677218aaeec",
    "bytes": 3306,
    "optimum": 3139778,
    "proof": {
      "averageSeconds": 411222,
      "solver": "Concorde",
      "machine": "Xeon 2.2 GHz",
      "subtourLpRatio": 1.2325,
      "measuredBy": "Hougardy and Zhong (2021)"
    },
    "source": "https://doi.org/10.1007/s12532-020-00184-5",
    "credit": "Hougardy and Zhong (2021), Mathematical Programming Computation 13, 51-74",
    "licence": "CC BY 4.0",
    "licenceUrl": "https://creativecommons.org/licenses/by/4.0/",
    "links": [
      {
        "href": "https://doi.org/10.60507/FK2/ESZ1QZ",
        "text": {
          "en": "data set doi:10.60507/FK2/ESZ1QZ",
          "sl": "zbirka podatkov doi:10.60507/FK2/ESZ1QZ"
        }
      }
    ],
    "dataSource": "https://www.or.uni-bonn.de/~hougardy/HardTSPInstances.html"
  },
  {
    "id": "uy734",
    "label": "Uruguay · 734",
    "names": {
      "en": "Uruguay",
      "sl": "Urugvaj"
    },
    "group": "americas",
    "unit": null,
    "path": "./examples/uy734.tsp",
    "cities": 734,
    "sha256": "b3028d537f425882b61aed5326f4ba4cc2451bad639e1f41b4f7dde7ecb49af2",
    "bytes": 19906,
    "source": "https://www.math.uwaterloo.ca/tsp/world/summary.html",
    "dataSource": "https://www.math.uwaterloo.ca/tsp/world/uy734.tsp",
    "credit": "National TSP collection, University of Waterloo",
    "referenceDate": "2022-07-31",
    "optimum": 79114
  },
  {
    "id": "zi929",
    "label": "Zimbabwe · 929",
    "names": {
      "en": "Zimbabwe",
      "sl": "Zimbabve"
    },
    "group": "africa",
    "unit": null,
    "path": "./examples/zi929.tsp",
    "cities": 929,
    "sha256": "4a079085f92852b0b87962ff0b11f90599df53b02c6da62153b5612b1a19a6e9",
    "bytes": 25172,
    "source": "https://www.math.uwaterloo.ca/tsp/world/summary.html",
    "dataSource": "https://www.math.uwaterloo.ca/tsp/world/zi929.tsp",
    "credit": "National TSP collection, University of Waterloo",
    "referenceDate": "2022-07-31",
    "optimum": 95345
  },
  {
    "id": "lu980",
    "label": "Luxembourg · 980",
    "names": {
      "en": "Luxembourg",
      "sl": "Luksemburg"
    },
    "group": "europe",
    "unit": null,
    "path": "./examples/lu980.tsp",
    "cities": 980,
    "sha256": "2b2e49fc300249cfdf3ccf8f0aee258a29904106ed71a7828cea81a94b47e693",
    "bytes": 25571,
    "source": "https://www.math.uwaterloo.ca/tsp/world/summary.html",
    "dataSource": "https://www.math.uwaterloo.ca/tsp/world/lu980.tsp",
    "credit": "National TSP collection, University of Waterloo",
    "referenceDate": "2022-07-31",
    "optimum": 11340
  },
  {
    "id": "evolved-1000-111",
    "names": {
      "en": "Evolved 1000-111",
      "sl": "Evolucijski primer 1000-111"
    },
    "group": "hard",
    "collection": "evolved",
    "collectionNames": {
      "en": "Seiler et al.",
      "sl": "Seiler in sod."
    },
    "unit": null,
    "remote": true,
    "remoteUrl": "https://raw.githubusercontent.com/mvseiler/PPSN_TSP_DL/239e1c50b1aa4be001b353119f971483ab8d2b8c/Instances/TSP/eax---lkh---sophisticated/1000-111.tsp",
    "cities": 1000,
    "sha256": "42c261d4d9aab0f4ffa8992c77bcee6dbcbbc531493128ba349616fb363f2b4c",
    "bytes": 17889,
    "optimum": 17693560, "provedBy": {"solver": "Concorde", "seconds": 25.24, "dateText": {"en": "17 Nov 2026", "sl": "17. nov. 2026"}},
    "source": "https://github.com/mvseiler/PPSN_TSP_DL",
    "credit": "Seiler, Pohl, Bossek, Kerschke and Trautmann, PPSN 2020",
    "links": [
      {
        "href": "https://doi.org/10.1007/978-3-030-58112-1_4",
        "text": {
          "en": "paper",
          "sl": "članek"
        }
      }
    ],
    "descriptions": {
      "en": "Evolved by the authors to be hard for one of two well-known heuristic solvers; 1,000 points.",
      "sl": "Avtorji so ga razvili tako, da je težak za enega od dveh znanih hevrističnih reševalnikov; 1.000 točk."
    }
  },
  {
    "id": "evolved-1000-137",
    "names": {
      "en": "Evolved 1000-137",
      "sl": "Evolucijski primer 1000-137"
    },
    "group": "hard",
    "collection": "evolved",
    "collectionNames": {
      "en": "Seiler et al.",
      "sl": "Seiler in sod."
    },
    "unit": null,
    "remote": true,
    "remoteUrl": "https://raw.githubusercontent.com/mvseiler/PPSN_TSP_DL/239e1c50b1aa4be001b353119f971483ab8d2b8c/Instances/TSP/eax---lkh---sophisticated/1000-137.tsp",
    "cities": 1000,
    "sha256": "094905d19b29684569e146004d588822e6e14a1c2298d675432a236e26d01686",
    "bytes": 17885,
    "optimum": 16980565, "provedBy": {"solver": "Concorde", "seconds": 10.51, "dateText": {"en": "17 Nov 2026", "sl": "17. nov. 2026"}},
    "source": "https://github.com/mvseiler/PPSN_TSP_DL",
    "credit": "Seiler, Pohl, Bossek, Kerschke and Trautmann, PPSN 2020",
    "links": [
      {
        "href": "https://doi.org/10.1007/978-3-030-58112-1_4",
        "text": {
          "en": "paper",
          "sl": "članek"
        }
      }
    ],
    "descriptions": {
      "en": "Evolved by the authors to be hard for one of two well-known heuristic solvers; 1,000 points.",
      "sl": "Avtorji so ga razvili tako, da je težak za enega od dveh znanih hevrističnih reševalnikov; 1.000 točk."
    }
  },
  {
    "id": "evolved-1000-195",
    "names": {
      "en": "Evolved 1000-195",
      "sl": "Evolucijski primer 1000-195"
    },
    "group": "hard",
    "collection": "evolved",
    "collectionNames": {
      "en": "Seiler et al.",
      "sl": "Seiler in sod."
    },
    "unit": null,
    "remote": true,
    "remoteUrl": "https://raw.githubusercontent.com/mvseiler/PPSN_TSP_DL/239e1c50b1aa4be001b353119f971483ab8d2b8c/Instances/TSP/lkh---eax---sophisticated/1000-195.tsp",
    "cities": 1000,
    "sha256": "cf7f65ae6185e2b3f92d079d7f53965d55b8339447c7e7d4667ab5a9d9011333",
    "bytes": 17822,
    "optimum": 23172007, "provedBy": {"solver": "Concorde", "seconds": 101.91, "dateText": {"en": "17 Nov 2026", "sl": "17. nov. 2026"}},
    "source": "https://github.com/mvseiler/PPSN_TSP_DL",
    "credit": "Seiler, Pohl, Bossek, Kerschke and Trautmann, PPSN 2020",
    "links": [
      {
        "href": "https://doi.org/10.1007/978-3-030-58112-1_4",
        "text": {
          "en": "paper",
          "sl": "članek"
        }
      }
    ],
    "descriptions": {
      "en": "Evolved by the authors to be hard for one of two well-known heuristic solvers; 1,000 points.",
      "sl": "Avtorji so ga razvili tako, da je težak za enega od dveh znanih hevrističnih reševalnikov; 1.000 točk."
    }
  },
  {
    "id": "evolved-1000-478",
    "names": {
      "en": "Evolved 1000-478",
      "sl": "Evolucijski primer 1000-478"
    },
    "group": "hard",
    "collection": "evolved",
    "collectionNames": {
      "en": "Seiler et al.",
      "sl": "Seiler in sod."
    },
    "unit": null,
    "remote": true,
    "remoteUrl": "https://raw.githubusercontent.com/mvseiler/PPSN_TSP_DL/239e1c50b1aa4be001b353119f971483ab8d2b8c/Instances/TSP/lkh---eax---sophisticated/1000-478.tsp",
    "cities": 1000,
    "sha256": "7b1bbfc27f8f6e4bf2d5d600418bb7d6080299eddf8c400bfc5dfd941544cd42",
    "bytes": 17944,
    "optimum": 19767397, "provedBy": {"solver": "Concorde", "seconds": 166.18, "dateText": {"en": "17 Nov 2026", "sl": "17. nov. 2026"}},
    "source": "https://github.com/mvseiler/PPSN_TSP_DL",
    "credit": "Seiler, Pohl, Bossek, Kerschke and Trautmann, PPSN 2020",
    "links": [
      {
        "href": "https://doi.org/10.1007/978-3-030-58112-1_4",
        "text": {
          "en": "paper",
          "sl": "članek"
        }
      }
    ],
    "descriptions": {
      "en": "Evolved by the authors to be hard for one of two well-known heuristic solvers; 1,000 points.",
      "sl": "Avtorji so ga razvili tako, da je težak za enega od dveh znanih hevrističnih reševalnikov; 1.000 točk."
    }
  },
  {
    "id": "rw1621",
    "label": "Rwanda · 1,621",
    "names": {
      "en": "Rwanda",
      "sl": "Ruanda"
    },
    "group": "africa",
    "unit": null,
    "path": "./examples/rw1621.tsp",
    "cities": 1621,
    "sha256": "08926829060a8e38543417dcffd214104c0dea89ac46ae0d9f0c6ed49aca274e",
    "bytes": 42858,
    "source": "https://www.math.uwaterloo.ca/tsp/world/summary.html",
    "dataSource": "https://www.math.uwaterloo.ca/tsp/world/rw1621.tsp",
    "credit": "National TSP collection, University of Waterloo",
    "referenceDate": "2022-07-31",
    "optimum": 26051
  },
  {
    "id": "mu1979",
    "label": "Oman · 1,979",
    "names": {
      "en": "Oman",
      "sl": "Oman"
    },
    "group": "asia",
    "unit": null,
    "path": "./examples/mu1979.tsp",
    "cities": 1979,
    "sha256": "8448c46b9d57cd296811d6a523df552d0c42f31b01678ff0eb48577b7ddb1866",
    "bytes": 54501,
    "source": "https://www.math.uwaterloo.ca/tsp/world/summary.html",
    "dataSource": "https://www.math.uwaterloo.ca/tsp/world/mu1979.tsp",
    "credit": "National TSP collection, University of Waterloo",
    "referenceDate": "2022-07-31",
    "optimum": 86891
  },  {
    "id": "che_from_europe_20261117",
    "names": {
      "en": "Switzerland",
      "sl": "Švica"
    },
    "group": "europe",
    "unit": "m",
    "path": "./examples/world/che_from_europe_20261117.tsp.gz",
    "compression": "gzip",
    "cities": 2850,
    "sha256": "1afc3b2e16760fa66ea9f25ff995b59b6efa445b56d0b03b6c23a21db555b8ef",
    "bytes": 59033,
    "gzipSha256": "d246d9cf5de1b1433353f6a5c8aefb7b81e3cec304d75460a2988b05d93ccada",
    "gzipBytes": 25873,
    "source": "https://www.math.uwaterloo.ca/tsp/world/",
    "credit": "World TSP, University of Waterloo",
    "links": [
      {
        "href": "https://www.naturalearthdata.com/",
        "text": {
          "en": "Made with Natural Earth",
          "sl": "Made with Natural Earth"
        }
      }
    ],
    "descriptions": {
      "en": "Places: World TSP (University of Waterloo; National Imagery and Mapping Agency and USGS GNIS names data). Borders: Made with Natural Earth (public domain). The 2,850 places of our Europe map in Switzerland, with the same coordinates: whole metres in a map projection; straight lines, not great-circle or road distances. Concorde proved the optimum on our laptop (QSopt) and on the NEOS Server (CPLEX), 17 Nov 2026.",
      "sl": "Kraji: World TSP (University of Waterloo; podatki o imenih National Imagery and Mapping Agency in USGS GNIS). Meje: Made with Natural Earth (javna last). 2.850 krajev našega zemljevida Evrope v Švici, z istimi koordinatami: celi metri v projekciji zemljevida; ravne črte, ne razdalje po velikem krogu ali po cestah. Concorde je optimum dokazal na našem prenosniku (QSopt) in na strežniku NEOS (CPLEX), 17. nov. 2026."
    },
    "optimum": 7844951,
    "provedBy": {
      "solver": "Concorde",
      "seconds": 3296.32,
      "dateText": {
        "en": "17 Nov 2026",
        "sl": "17. nov. 2026"
      }
    },
    "optimumKnown": true,
    "dataset": "Switzerland: the 2,850 places of evropa_world_20261116 with iso3 CHE (8zTSP-K, 17 Nov 2026)"
  },

  {
    "id": "nu3496",
    "label": "Nicaragua · 3,496",
    "names": {
      "en": "Nicaragua",
      "sl": "Nikaragva"
    },
    "group": "americas",
    "unit": null,
    "path": "./examples/nu3496.tsp",
    "cities": 3496,
    "sha256": "95aebc8fd9907b94ef644a7e9bd0662e24644cfc58963bc121abbe6696c96e74",
    "bytes": 96982,
    "source": "https://www.math.uwaterloo.ca/tsp/world/summary.html",
    "dataSource": "https://www.math.uwaterloo.ca/tsp/world/nu3496.tsp",
    "credit": "National TSP collection, University of Waterloo",
    "referenceDate": "2022-07-31",
    "optimum": 96132
  },
  {
    "id": "ca4663",
    "label": "Canada · 4,663",
    "names": {
      "en": "Canada",
      "sl": "Kanada"
    },
    "group": "americas",
    "unit": null,
    "path": "./examples/ca4663.tsp",
    "cities": 4663,
    "sha256": "032a7837db3b4d70b796280778fa8107db6ee2a2e21bcc4350f4c41f1f614fb8",
    "bytes": 131597,
    "source": "https://www.math.uwaterloo.ca/tsp/world/summary.html",
    "dataSource": "https://www.math.uwaterloo.ca/tsp/world/ca4663.tsp",
    "credit": "National TSP collection, University of Waterloo",
    "referenceDate": "2022-07-31",
    "optimum": 1290319
  },
  {
    "id": "tz6117",
    "label": "Tanzania · 6,117",
    "names": {
      "en": "Tanzania",
      "sl": "Tanzanija"
    },
    "group": "africa",
    "unit": null,
    "path": "./examples/tz6117.tsp",
    "cities": 6117,
    "sha256": "45486c69d1c38d653e2c33bf501fabb2bf6061df6d5a9cd331e76408e023063d",
    "bytes": 164919,
    "source": "https://www.math.uwaterloo.ca/tsp/world/summary.html",
    "dataSource": "https://www.math.uwaterloo.ca/tsp/world/tz6117.tsp",
    "credit": "National TSP collection, University of Waterloo",
    "referenceDate": "2022-07-31",
    "optimum": 394718
  },
  {
    "id": "alzirija_world_20261116",
    "names": {
      "en": "Algeria",
      "sl": "Alžirija"
    },
    "group": "africa",
    "unit": "m",
    "path": "./examples/world/alzirija_world_20261116.tsp.gz",
    "compression": "gzip",
    "cities": 6628,
    "sha256": "eeb4865d4e20774c5df03a5e92d9533667ccbd1cc710080312f559291d5b9443",
    "bytes": 137307,
    "gzipSha256": "583bbfc50c69f92809f7b467d725b1be6adca2d4fbb00749ac82361eee1b12dc",
    "gzipBytes": 60578,
    "source": "https://www.math.uwaterloo.ca/tsp/world/",
    "credit": "World TSP, University of Waterloo",
    "links": [
      {
        "href": "https://www.naturalearthdata.com/",
        "text": {
          "en": "Made with Natural Earth",
          "sl": "Made with Natural Earth"
        }
      }
    ],
    "descriptions": {
      "en": "Places: World TSP (University of Waterloo; National Imagery and Mapping Agency and USGS GNIS names data). Borders: Made with Natural Earth (public domain). Whole metres in a map projection; straight lines, not great-circle or road distances: at the far edges up to 1 % from great-circle distances. Optimum unknown (new map).",
      "sl": "Kraji: World TSP (University of Waterloo; podatki o imenih National Imagery and Mapping Agency in USGS GNIS). Meje: Made with Natural Earth (javna last). Celi metri v projekciji zemljevida; ravne črte, ne razdalje po velikem krogu ali po cestah: na skrajnih robovih do 1 % od razdalj po velikem krogu. Optimum ni znan (nov zemljevid)."
    },
    "maxEdgeErrorPercent": "1",
    "optimumKnown": false,
    "dataset": "8zTSP-world final maps 2026-11-16 (K checked 21/21)"
  },
  {
    "id": "eg7146",
    "label": "Egypt · 7,146",
    "names": {
      "en": "Egypt",
      "sl": "Egipt"
    },
    "group": "africa",
    "unit": null,
    "path": "./examples/eg7146.tsp",
    "cities": 7146,
    "sha256": "da62d0f91fe91093bc4eff69c8637c7ab0f68c24dfdc5532b5962fcc35d0d981",
    "bytes": 199178,
    "source": "https://www.math.uwaterloo.ca/tsp/world/summary.html",
    "dataSource": "https://www.math.uwaterloo.ca/tsp/world/eg7146.tsp",
    "credit": "National TSP collection, University of Waterloo",
    "referenceDate": "2022-07-31",
    "optimum": 172386
  },
  {
    "id": "ym7663",
    "label": "Yemen · 7,663",
    "names": {
      "en": "Yemen",
      "sl": "Jemen"
    },
    "group": "asia",
    "unit": null,
    "path": "./examples/ym7663.tsp",
    "cities": 7663,
    "sha256": "3bbf55d1ae4f198ddf5bde1de217c3984d8cc0e96ee3df3ecba295c6827163bf",
    "bytes": 213654,
    "source": "https://www.math.uwaterloo.ca/tsp/world/summary.html",
    "dataSource": "https://www.math.uwaterloo.ca/tsp/world/ym7663.tsp",
    "credit": "National TSP collection, University of Waterloo",
    "referenceDate": "2022-07-31",
    "optimum": 238314
  },
  {
    "id": "pm8079",
    "label": "Panama · 8,079",
    "names": {
      "en": "Panama",
      "sl": "Panama"
    },
    "group": "americas",
    "unit": null,
    "path": "./examples/pm8079.tsp",
    "cities": 8079,
    "sha256": "f1d80e695c7771c8651b885015944036da9ac3f29d26c5eeb89877bd25bd78f4",
    "bytes": 217224,
    "source": "https://www.math.uwaterloo.ca/tsp/world/summary.html",
    "dataSource": "https://www.math.uwaterloo.ca/tsp/world/pm8079.tsp",
    "credit": "National TSP collection, University of Waterloo",
    "referenceDate": "2022-07-31",
    "optimum": 114855
  },
  {
    "id": "ei8246",
    "label": "Ireland · 8,246",
    "names": {
      "en": "Ireland",
      "sl": "Irska"
    },
    "group": "europe",
    "unit": null,
    "path": "./examples/ei8246.tsp",
    "cities": 8246,
    "sha256": "3bc6e2f70e7631526a539f39ac6f38a178fa14e5997d51d079f9822f8148518e",
    "bytes": 221937,
    "source": "https://www.math.uwaterloo.ca/tsp/world/summary.html",
    "dataSource": "https://www.math.uwaterloo.ca/tsp/world/ei8246.tsp",
    "credit": "National TSP collection, University of Waterloo",
    "referenceDate": "2022-07-31",
    "optimum": 206171
  },
  {
    "id": "ar9152",
    "label": "Argentina · 9,152",
    "names": {
      "en": "Argentina",
      "sl": "Argentina"
    },
    "group": "americas",
    "unit": null,
    "path": "./examples/ar9152.tsp",
    "cities": 9152,
    "sha256": "219db5136b3dfe50aee7e8a3679b72875c7d2ec1acb6a31beb33dbf764ac7da5",
    "bytes": 255350,
    "source": "https://www.math.uwaterloo.ca/tsp/world/summary.html",
    "dataSource": "https://www.math.uwaterloo.ca/tsp/world/ar9152.tsp",
    "credit": "National TSP collection, University of Waterloo",
    "referenceDate": "2022-07-31",
    "optimum": 837479
  },
  {
    "id": "avstralija_world_20261116",
    "names": {
      "en": "Australia",
      "sl": "Avstralija"
    },
    "group": "oceania",
    "unit": "m",
    "path": "./examples/world/avstralija_world_20261116.tsp.gz",
    "compression": "gzip",
    "cities": 9471,
    "sha256": "91bc8abf2dcccd20ada24b0afe21507617c41154f6f9917dd2fb9b657fe027b4",
    "bytes": 194693,
    "gzipSha256": "2e093429051129fb75600df33ab889d6296a242d4a006c16776c4ac81763d04f",
    "gzipBytes": 89290,
    "source": "https://www.math.uwaterloo.ca/tsp/world/",
    "credit": "World TSP, University of Waterloo",
    "links": [
      {
        "href": "https://www.naturalearthdata.com/",
        "text": {
          "en": "Made with Natural Earth",
          "sl": "Made with Natural Earth"
        }
      }
    ],
    "descriptions": {
      "en": "Mainland and Tasmania. Places: World TSP (University of Waterloo; National Imagery and Mapping Agency and USGS GNIS names data). Borders: Made with Natural Earth (public domain). Whole metres in a map projection; straight lines, not great-circle or road distances: at the far edges up to 2 % from great-circle distances. Optimum unknown (new map).",
      "sl": "Celina in Tasmanija. Kraji: World TSP (University of Waterloo; podatki o imenih National Imagery and Mapping Agency in USGS GNIS). Meje: Made with Natural Earth (javna last). Celi metri v projekciji zemljevida; ravne črte, ne razdalje po velikem krogu ali po cestah: na skrajnih robovih do 2 % od razdalj po velikem krogu. Optimum ni znan (nov zemljevid)."
    },
    "maxEdgeErrorPercent": "2",
    "optimumKnown": false,
    "dataset": "8zTSP-world final maps 2026-11-16 (K checked 21/21)"
  },
  {
    "id": "ja9847",
    "label": "Japan · 9,847",
    "names": {
      "en": "Japan",
      "sl": "Japonska"
    },
    "group": "asia",
    "unit": null,
    "path": "./examples/ja9847.tsp",
    "cities": 9847,
    "sha256": "5845b29c01cece9311a7aa2c37df6bed653b3825ad839adce6f355a894c3304f",
    "bytes": 284653,
    "source": "https://www.math.uwaterloo.ca/tsp/world/summary.html",
    "dataSource": "https://www.math.uwaterloo.ca/tsp/world/ja9847.tsp",
    "credit": "National TSP collection, University of Waterloo",
    "referenceDate": "2022-07-31",
    "optimum": 491924
  },
  {
    "id": "gr9882",
    "label": "Greece · 9,882",
    "names": {
      "en": "Greece",
      "sl": "Grčija"
    },
    "group": "europe",
    "unit": null,
    "path": "./examples/gr9882.tsp",
    "cities": 9882,
    "sha256": "f53bedc46af763d380aceaf8c661b600bc569b38c07d72456bc6df4645a3b60e",
    "bytes": 275787,
    "source": "https://www.math.uwaterloo.ca/tsp/world/summary.html",
    "dataSource": "https://www.math.uwaterloo.ca/tsp/world/gr9882.tsp",
    "credit": "National TSP collection, University of Waterloo",
    "referenceDate": "2022-07-31",
    "optimum": 300899
  },
  {
    "id": "kz9976",
    "label": "Kazakhstan · 9,976",
    "names": {
      "en": "Kazakhstan",
      "sl": "Kazahstan"
    },
    "group": "asia",
    "unit": null,
    "path": "./examples/kz9976.tsp",
    "cities": 9976,
    "sha256": "f316b9b3937dcd03d26d182366c6a66d9f7c7b2d5ed2c67c6e3817d70add8b0c",
    "bytes": 278423,
    "source": "https://www.math.uwaterloo.ca/tsp/world/summary.html",
    "dataSource": "https://www.math.uwaterloo.ca/tsp/world/kz9976.tsp",
    "credit": "National TSP collection, University of Waterloo",
    "referenceDate": "2022-07-31",
    "optimum": 1061881
  },
  {
    "id": "C10k.0",
    "names": {
      "en": "C10k.0",
      "sl": "C10k.0"
    },
    "group": "hard",
    "collection": "dimacs",
    "collectionNames": {
      "en": "DIMACS",
      "sl": "DIMACS"
    },
    "unit": null,
    "path": "./examples/hard/C10k.0.tsp",
    "cities": 10000,
    "sha256": "98161dba3c257fcd48ceb607b343b42cb62b573b76c77a1197e8a1185aeb1066",
    "bytes": 187076,
    "bestKnownTour": 33019942,
    "bestTourKind": "challenge-2002",
    "bound": 32782155.22,
    "boundKind": "bound",
    "source": "https://archive.dimacs.rutgers.edu/Challenges/TSP/",
    "credit": "DIMACS TSP Challenge, clustered instance (portcgen 10000 10000)"
  },
  {
    "id": "fi10639",
    "label": "Finland · 10,639",
    "names": {
      "en": "Finland",
      "sl": "Finska"
    },
    "group": "europe",
    "unit": null,
    "path": "./examples/fi10639.tsp",
    "cities": 10639,
    "sha256": "2499b941abfb1d59fa9d7ddf5ff76dfa2e646dcb260580b6ec26da2b10544450",
    "bytes": 297627,
    "source": "https://www.math.uwaterloo.ca/tsp/world/summary.html",
    "dataSource": "https://www.math.uwaterloo.ca/tsp/world/fi10639.tsp",
    "credit": "National TSP collection, University of Waterloo",
    "referenceDate": "2022-07-31",
    "optimum": 520527
  },
  {
    "id": "usa13509",
    "names": {
      "en": "USA (TSPLIB usa13509)",
      "sl": "ZDA (TSPLIB usa13509)"
    },
    "group": "americas",
    "collection": "tsplib",
    "unit": null,
    "path": "./examples/usa13509.tsp",
    "cities": 13509,
    "sha256": "f2d7c9f97b9b343b868c72388241e803f099af551e563a10e183778b7e38ada1",
    "bytes": 369592,
    "optimum": 19982859,
    "optimumProof": {
      "by": "D. Applegate, R. Bixby, V. Chvátal, W. Cook",
      "year": 1998,
      "source": "https://www.math.uwaterloo.ca/tsp/history/milestone.html"
    },
    "source": "https://comopt.ifi.uni-heidelberg.de/software/TSPLIB95/tsp/TSP-BEST.html",
    "dataSource": "https://comopt.ifi.uni-heidelberg.de/software/TSPLIB95/tsp/usa13509.tsp.gz",
    "dataSourceGzipSha256": "69f4e56182cafa52fd5d4957c2d6998e063d68294f7299dc48e54d46fa544473",
    "credit": "TSPLIB, Heidelberg University",
    "referenceDate": "2026-11-16",
    "descriptions": {
      "en": "13,509 cities in the continental United States; TSPLIB instance contributed by David Applegate and Andre Rohe. Optimum proved in 1998 by Applegate, Bixby, Chvátal and Cook.",
      "sl": "13.509 mest v celinskih ZDA; primer TSPLIB, prispevala David Applegate in Andre Rohe. Optimum so leta 1998 dokazali Applegate, Bixby, Chvátal in Cook."
    }
  },
  {
    "id": "mo14185",
    "label": "Morocco · 14,185",
    "names": {
      "en": "Morocco",
      "sl": "Maroko"
    },
    "group": "africa",
    "unit": null,
    "path": "./examples/mo14185.tsp",
    "cities": 14185,
    "sha256": "037e20e74751e0c9cc4ed369322232d5d93f87f22fec5f6e30e82b67f4872cb9",
    "bytes": 386531,
    "source": "https://www.math.uwaterloo.ca/tsp/world/summary.html",
    "dataSource": "https://www.math.uwaterloo.ca/tsp/world/mo14185.tsp",
    "credit": "National TSP collection, University of Waterloo",
    "referenceDate": "2022-07-31",
    "optimum": 427377
  },
  {
    "id": "zdruzeno_kraljestvo_world_20261116",
    "names": {
      "en": "United Kingdom",
      "sl": "Združeno kraljestvo"
    },
    "group": "europe",
    "unit": "m",
    "path": "./examples/world/zdruzeno_kraljestvo_world_20261116.tsp.gz",
    "compression": "gzip",
    "cities": 14185,
    "sha256": "5aa218e3eb796d37fe8ad2438d96386a9e8593f8b1c0138454efd117d90b3def",
    "bytes": 274000,
    "gzipSha256": "47e460bf5307a2b42cd5e94a0d7ae5ea4b3d5914e4ba77cec77f13ca2a416c8c",
    "gzipBytes": 122377,
    "source": "https://www.math.uwaterloo.ca/tsp/world/",
    "credit": "World TSP, University of Waterloo",
    "links": [
      {
        "href": "https://www.naturalearthdata.com/",
        "text": {
          "en": "Made with Natural Earth",
          "sl": "Made with Natural Earth"
        }
      }
    ],
    "descriptions": {
      "en": "Great Britain and Northern Ireland. Places: World TSP (University of Waterloo; National Imagery and Mapping Agency and USGS GNIS names data). Borders: Made with Natural Earth (public domain). Whole metres in a map projection; straight lines, not great-circle or road distances: at the far edges up to 0.5 % from great-circle distances. Optimum unknown (new map).",
      "sl": "Velika Britanija in Severna Irska. Kraji: World TSP (University of Waterloo; podatki o imenih National Imagery and Mapping Agency in USGS GNIS). Meje: Made with Natural Earth (javna last). Celi metri v projekciji zemljevida; ravne črte, ne razdalje po velikem krogu ali po cestah: na skrajnih robovih do 0,5 % od razdalj po velikem krogu. Optimum ni znan (nov zemljevid)."
    },
    "maxEdgeErrorPercent": "0.5",
    "optimumKnown": false,
    "dataset": "8zTSP-world final maps 2026-11-16 (K checked 21/21)"
  },
  {
    "id": "xrb14233",
    "names": {
      "en": "xrb14233",
      "sl": "xrb14233"
    },
    "group": "hard",
    "collection": "vlsi",
    "collectionNames": {
      "en": "VLSI",
      "sl": "VLSI"
    },
    "unit": null,
    "path": "./examples/hard/xrb14233.tsp",
    "cities": 14233,
    "sha256": "16ba6922d7957e154da56378695228057a930e8b346ba95ca656c14c2d314912",
    "bytes": 196323,
    "bestKnownTour": 45462,
    "bound": 45450,
    "boundKind": "certified",
    "source": "https://www.math.uwaterloo.ca/tsp/vlsi/summary.html",
    "dataSource": "https://www.math.uwaterloo.ca/tsp/vlsi/xrb14233.tsp",
    "credit": "VLSI TSP collection, University of Waterloo",
    "referenceDate": "2026-11-16",
    "descriptions": {
      "en": "Bonn VLSI instance, contributed by Andre Rohe (Uni Bonn). Best tour: Keld Helsgaun; values as listed by Waterloo on 16 Nov 2026.",
      "sl": "Bonnski primer VLSI, prispeval Andre Rohe (Univerza v Bonnu). Najboljša pot: Keld Helsgaun; vrednosti po seznamu Waterlooja 16. 11. 2026."
    }
  },
  {
    "id": "ho14473",
    "label": "Honduras · 14,473",
    "names": {
      "en": "Honduras",
      "sl": "Honduras"
    },
    "group": "americas",
    "unit": null,
    "path": "./examples/ho14473.tsp",
    "cities": 14473,
    "sha256": "4fab086f1761036bdb23fe7a36169d98804b75075b481f865c16492fe55b7bb4",
    "bytes": 408814,
    "source": "https://www.math.uwaterloo.ca/tsp/world/summary.html",
    "dataSource": "https://www.math.uwaterloo.ca/tsp/world/ho14473.tsp",
    "credit": "National TSP collection, University of Waterloo",
    "referenceDate": "2022-07-31",
    "optimum": 177092
  },
  {
    "id": "bangladesh_world_20261116",
    "names": {
      "en": "Bangladesh",
      "sl": "Bangladeš"
    },
    "group": "asia",
    "unit": "m",
    "path": "./examples/world/bangladesh_world_20261116.tsp.gz",
    "compression": "gzip",
    "cities": 14783,
    "sha256": "630fe3488b34797d1c6c3e3c49443bd1bbba5210403f62ed3746a1879b70f38c",
    "bytes": 285481,
    "gzipSha256": "5bdc29f0dbe7f6b2e799f0f80031ee600b29baf60c6fdf2dc5d51d25e7baa8ff",
    "gzipBytes": 120468,
    "source": "https://www.math.uwaterloo.ca/tsp/world/",
    "credit": "World TSP, University of Waterloo",
    "links": [
      {
        "href": "https://www.naturalearthdata.com/",
        "text": {
          "en": "Made with Natural Earth",
          "sl": "Made with Natural Earth"
        }
      }
    ],
    "descriptions": {
      "en": "Places: World TSP (University of Waterloo; National Imagery and Mapping Agency and USGS GNIS names data). Borders: Made with Natural Earth (public domain). Whole metres in a map projection; straight lines, not great-circle or road distances: at the far edges up to 1 % from great-circle distances. Optimum unknown (new map).",
      "sl": "Kraji: World TSP (University of Waterloo; podatki o imenih National Imagery and Mapping Agency in USGS GNIS). Meje: Made with Natural Earth (javna last). Celi metri v projekciji zemljevida; ravne črte, ne razdalje po velikem krogu ali po cestah: na skrajnih robovih do 1 % od razdalj po velikem krogu. Optimum ni znan (nov zemljevid)."
    },
    "maxEdgeErrorPercent": "1",
    "optimumKnown": false,
    "dataset": "8zTSP-world final maps 2026-11-16 (K checked 21/21)"
  },
  {
    "id": "it16862",
    "label": "Italy · 16,862",
    "names": {
      "en": "Italy",
      "sl": "Italija"
    },
    "group": "europe",
    "unit": null,
    "path": "./examples/it16862.tsp",
    "cities": 16862,
    "sha256": "d248da34c36b73bf15e1e99fe2d2ff03c92ff82b7bbbdfc897052da86efade32",
    "bytes": 474304,
    "source": "https://www.math.uwaterloo.ca/tsp/world/summary.html",
    "dataSource": "https://www.math.uwaterloo.ca/tsp/world/it16862.tsp",
    "credit": "National TSP collection, University of Waterloo",
    "referenceDate": "2022-07-31",
    "optimum": 557315
  },
  {
    "id": "ido21215",
    "names": {
      "en": "ido21215",
      "sl": "ido21215"
    },
    "group": "hard",
    "collection": "vlsi",
    "collectionNames": {
      "en": "VLSI",
      "sl": "VLSI"
    },
    "unit": null,
    "path": "./examples/hard/ido21215.tsp",
    "cities": 21215,
    "sha256": "b1ea84180b7076b17216e21407a6d303ddcda6c68ae8d1fcfd23db0a73b83282",
    "bytes": 301185,
    "bestKnownTour": 63517,
    "bound": 63501,
    "boundKind": "certified",
    "source": "https://www.math.uwaterloo.ca/tsp/vlsi/summary.html",
    "dataSource": "https://www.math.uwaterloo.ca/tsp/vlsi/ido21215.tsp",
    "credit": "VLSI TSP collection, University of Waterloo",
    "referenceDate": "2026-11-16",
    "descriptions": {
      "en": "Bonn VLSI instance, contributed by Andre Rohe (Uni Bonn). Best tour: C. Dong, G. Jaeger, P. Molitor, D. Richter; values as listed by Waterloo on 16 Nov 2026.",
      "sl": "Bonnski primer VLSI, prispeval Andre Rohe (Univerza v Bonnu). Najboljša pot: C. Dong, G. Jaeger, P. Molitor, D. Richter; vrednosti po seznamu Waterlooja 16. 11. 2026."
    }
  },
  {
    "id": "indija_world_20261116",
    "names": {
      "en": "India",
      "sl": "Indija"
    },
    "group": "asia",
    "unit": "m",
    "path": "./examples/world/indija_world_20261116.tsp.gz",
    "compression": "gzip",
    "cities": 21514,
    "sha256": "8291c751f15a11809add1396808e9216adf7136da2c2720a4cb0d212f8f04eb5",
    "bytes": 451499,
    "gzipSha256": "35773f7059185dbdaac27b4e1b70977c6dcaed97def4f0594d2288358de75a02",
    "gzipBytes": 200707,
    "source": "https://www.math.uwaterloo.ca/tsp/world/",
    "credit": "World TSP, University of Waterloo",
    "links": [
      {
        "href": "https://www.naturalearthdata.com/",
        "text": {
          "en": "Made with Natural Earth",
          "sl": "Made with Natural Earth"
        }
      }
    ],
    "descriptions": {
      "en": "Places: World TSP (University of Waterloo; National Imagery and Mapping Agency and USGS GNIS names data). Borders: Made with Natural Earth (public domain). Whole metres in a map projection; straight lines, not great-circle or road distances: at the far edges up to 2 % from great-circle distances. Optimum unknown (new map).",
      "sl": "Kraji: World TSP (University of Waterloo; podatki o imenih National Imagery and Mapping Agency in USGS GNIS). Meje: Made with Natural Earth (javna last). Celi metri v projekciji zemljevida; ravne črte, ne razdalje po velikem krogu ali po cestah: na skrajnih robovih do 2 % od razdalj po velikem krogu. Optimum ni znan (nov zemljevid)."
    },
    "maxEdgeErrorPercent": "2",
    "optimumKnown": false,
    "dataset": "8zTSP-world final maps 2026-11-16 (K checked 21/21)"
  },
  {
    "id": "indonezija_world_20261116",
    "names": {
      "en": "Indonesia",
      "sl": "Indonezija"
    },
    "group": "asia",
    "unit": "m",
    "path": "./examples/world/indonezija_world_20261116.tsp.gz",
    "compression": "gzip",
    "cities": 21634,
    "sha256": "86c37b2a1b0a92ee9880e29813dcba8bd8ccd5c075fcd1fc7dc4fbf494f46d6d",
    "bytes": 449077,
    "gzipSha256": "379fd137b8ecbfdbba7bc9c5d0925b4e93ec4a5af7229ecafb2dbb1920f29ec5",
    "gzipBytes": 193105,
    "source": "https://www.math.uwaterloo.ca/tsp/world/",
    "credit": "World TSP, University of Waterloo",
    "links": [
      {
        "href": "https://www.naturalearthdata.com/",
        "text": {
          "en": "Made with Natural Earth",
          "sl": "Made with Natural Earth"
        }
      }
    ],
    "descriptions": {
      "en": "Places: World TSP (University of Waterloo; National Imagery and Mapping Agency and USGS GNIS names data). Borders: Made with Natural Earth (public domain). Whole metres in a map projection; straight lines, not great-circle or road distances: at the far edges up to 2.5 % from great-circle distances. Optimum unknown (new map).",
      "sl": "Kraji: World TSP (University of Waterloo; podatki o imenih National Imagery and Mapping Agency in USGS GNIS). Meje: Made with Natural Earth (javna last). Celi metri v projekciji zemljevida; ravne črte, ne razdalje po velikem krogu ali po cestah: na skrajnih robovih do 2,5 % od razdalj po velikem krogu. Optimum ni znan (nov zemljevid)."
    },
    "maxEdgeErrorPercent": "2.5",
    "optimumKnown": false,
    "dataset": "8zTSP-world final maps 2026-11-16 (K checked 21/21)"
  },
  {
    "id": "vm22775",
    "label": "Vietnam · 22,775",
    "names": {
      "en": "Vietnam",
      "sl": "Vietnam"
    },
    "group": "asia",
    "unit": null,
    "path": "./examples/vm22775.tsp",
    "cities": 22775,
    "sha256": "b5204a782fe7e3d0d0444764612498aa08e052d00f4cdabe1f8642cdc7673aec",
    "bytes": 670999,
    "source": "https://www.math.uwaterloo.ca/tsp/world/summary.html",
    "dataSource": "https://www.math.uwaterloo.ca/tsp/world/vm22775.tsp",
    "credit": "National TSP collection, University of Waterloo",
    "referenceDate": "2022-07-31",
    "optimum": 569288
  },
  {
    "id": "sw24978",
    "label": "Sweden · 24,978",
    "names": {
      "en": "Sweden",
      "sl": "Švedska"
    },
    "group": "europe",
    "unit": null,
    "path": "./examples/sw24978.tsp",
    "cities": 24978,
    "sha256": "85b1b3acd0e56a228632685638e7febc83571fefa084b626584dba88de0c674a",
    "bytes": 713457,
    "source": "https://www.math.uwaterloo.ca/tsp/world/summary.html",
    "dataSource": "https://www.math.uwaterloo.ca/tsp/world/sw24978.tsp",
    "credit": "National TSP collection, University of Waterloo",
    "referenceDate": "2022-07-31",
    "optimum": 855597
  },
  {
    "id": "nigerija_world_20261116",
    "names": {
      "en": "Nigeria",
      "sl": "Nigerija"
    },
    "group": "africa",
    "unit": "m",
    "path": "./examples/world/nigerija_world_20261116.tsp.gz",
    "compression": "gzip",
    "cities": 27999,
    "sha256": "3c059f50fcdbb723a1f1fcd8d3d370d0140a249ae0e0f2e8bc321c44c023e03d",
    "bytes": 559439,
    "gzipSha256": "1c13860dc871b0a21f1540c2682e2d4d27d51adc80db6cdd116fef2ff87e596a",
    "gzipBytes": 240698,
    "source": "https://www.math.uwaterloo.ca/tsp/world/",
    "credit": "World TSP, University of Waterloo",
    "links": [
      {
        "href": "https://www.naturalearthdata.com/",
        "text": {
          "en": "Made with Natural Earth",
          "sl": "Made with Natural Earth"
        }
      }
    ],
    "descriptions": {
      "en": "Places: World TSP (University of Waterloo; National Imagery and Mapping Agency and USGS GNIS names data). Borders: Made with Natural Earth (public domain). Whole metres in a map projection; straight lines, not great-circle or road distances: at the far edges up to 1 % from great-circle distances. Optimum unknown (new map).",
      "sl": "Kraji: World TSP (University of Waterloo; podatki o imenih National Imagery and Mapping Agency in USGS GNIS). Meje: Made with Natural Earth (javna last). Celi metri v projekciji zemljevida; ravne črte, ne razdalje po velikem krogu ali po cestah: na skrajnih robovih do 1 % od razdalj po velikem krogu. Optimum ni znan (nov zemljevid)."
    },
    "maxEdgeErrorPercent": "1",
    "optimumKnown": false,
    "dataset": "8zTSP-world final maps 2026-11-16 (K checked 21/21)"
  },
  {
    "id": "bm33708",
    "label": "Burma · 33,708",
    "names": {
      "en": "Burma",
      "sl": "Burma"
    },
    "group": "asia",
    "unit": null,
    "path": "./examples/bm33708.tsp",
    "cities": 33708,
    "sha256": "a41cb09449eaa14e332efae40de727a894daf9941f93da93167cbb5e7e0f3644",
    "bytes": 967231,
    "source": "https://www.math.uwaterloo.ca/tsp/world/summary.html",
    "dataSource": "https://www.math.uwaterloo.ca/tsp/world/bm33708.tsp",
    "credit": "National TSP collection, University of Waterloo",
    "referenceDate": "2022-07-31",
    "bestKnownTour": 959289,
    "bound": 959011,
    "boundKind": "certified"
  },
  {
    "id": "brazilija_world_20261116",
    "names": {
      "en": "Brazil",
      "sl": "Brazilija"
    },
    "group": "americas",
    "unit": "m",
    "path": "./examples/world/brazilija_world_20261116.tsp.gz",
    "compression": "gzip",
    "cities": 34291,
    "sha256": "0749c10aa04b702718350c8f8240ab17e6929eb1e95bc2f06cde9007c6b9b46f",
    "bytes": 741117,
    "gzipSha256": "99c979310c39505a665483bee3cfebcafb8b05d51b5609091513d54adaa1be41",
    "gzipBytes": 319088,
    "source": "https://www.math.uwaterloo.ca/tsp/world/",
    "credit": "World TSP, University of Waterloo",
    "links": [
      {
        "href": "https://www.naturalearthdata.com/",
        "text": {
          "en": "Made with Natural Earth",
          "sl": "Made with Natural Earth"
        }
      }
    ],
    "descriptions": {
      "en": "Places: World TSP (University of Waterloo; National Imagery and Mapping Agency and USGS GNIS names data). Borders: Made with Natural Earth (public domain). Whole metres in a map projection; straight lines, not great-circle or road distances: at the far edges up to 2.5 % from great-circle distances. Optimum unknown (new map).",
      "sl": "Kraji: World TSP (University of Waterloo; podatki o imenih National Imagery and Mapping Agency in USGS GNIS). Meje: Made with Natural Earth (javna last). Celi metri v projekciji zemljevida; ravne črte, ne razdalje po velikem krogu ali po cestah: na skrajnih robovih do 2,5 % od razdalj po velikem krogu. Optimum ni znan (nov zemljevid)."
    },
    "maxEdgeErrorPercent": "2.5",
    "optimumKnown": false,
    "dataset": "8zTSP-world final maps 2026-11-16 (K checked 21/21)"
  },
  {
    "id": "pakistan_world_20261116",
    "names": {
      "en": "Pakistan",
      "sl": "Pakistan"
    },
    "group": "asia",
    "unit": "m",
    "path": "./examples/world/pakistan_world_20261116.tsp.gz",
    "compression": "gzip",
    "cities": 37000,
    "sha256": "c02f719d537f27a9ae07ce31a29e84032d21756a00176bc175a0d76afab9b7af",
    "bytes": 767249,
    "gzipSha256": "01e819bd31a8dcda94b8debb343380849697f9cf7d65197ec676746809c7d51e",
    "gzipBytes": 320599,
    "source": "https://www.math.uwaterloo.ca/tsp/world/",
    "credit": "World TSP, University of Waterloo",
    "links": [
      {
        "href": "https://www.naturalearthdata.com/",
        "text": {
          "en": "Made with Natural Earth",
          "sl": "Made with Natural Earth"
        }
      }
    ],
    "descriptions": {
      "en": "Places: World TSP (University of Waterloo; National Imagery and Mapping Agency and USGS GNIS names data). Borders: Made with Natural Earth (public domain). Whole metres in a map projection; straight lines, not great-circle or road distances: at the far edges up to 1 % from great-circle distances. Optimum unknown (new map).",
      "sl": "Kraji: World TSP (University of Waterloo; podatki o imenih National Imagery and Mapping Agency in USGS GNIS). Meje: Made with Natural Earth (javna last). Celi metri v projekciji zemljevida; ravne črte, ne razdalje po velikem krogu ali po cestah: na skrajnih robovih do 1 % od razdalj po velikem krogu. Optimum ni znan (nov zemljevid)."
    },
    "maxEdgeErrorPercent": "1",
    "optimumKnown": false,
    "dataset": "8zTSP-world final maps 2026-11-16 (K checked 21/21)"
  },
  {
    "id": "mehika_world_20261116",
    "names": {
      "en": "Mexico",
      "sl": "Mehika"
    },
    "group": "americas",
    "unit": "m",
    "path": "./examples/world/mehika_world_20261116.tsp.gz",
    "compression": "gzip",
    "cities": 47855,
    "sha256": "7053c484c331b1ed4a37a86667855e82ad0a406d92e08217d2ce9b3b5234bec7",
    "bytes": 1014217,
    "gzipSha256": "dec9c02c7d78abb067769074c5cc94caef3693777085809934598052d56683a5",
    "gzipBytes": 432108,
    "source": "https://www.math.uwaterloo.ca/tsp/world/",
    "credit": "World TSP, University of Waterloo",
    "links": [
      {
        "href": "https://www.naturalearthdata.com/",
        "text": {
          "en": "Made with Natural Earth",
          "sl": "Made with Natural Earth"
        }
      }
    ],
    "descriptions": {
      "en": "Places: World TSP (University of Waterloo; National Imagery and Mapping Agency and USGS GNIS names data). Borders: Made with Natural Earth (public domain). Whole metres in a map projection; straight lines, not great-circle or road distances: at the far edges up to 1.5 % from great-circle distances. Optimum unknown (new map).",
      "sl": "Kraji: World TSP (University of Waterloo; podatki o imenih National Imagery and Mapping Agency in USGS GNIS). Meje: Made with Natural Earth (javna last). Celi metri v projekciji zemljevida; ravne črte, ne razdalje po velikem krogu ali po cestah: na skrajnih robovih do 1,5 % od razdalj po velikem krogu. Optimum ni znan (nov zemljevid)."
    },
    "maxEdgeErrorPercent": "1.5",
    "optimumKnown": false,
    "dataset": "8zTSP-world final maps 2026-11-16 (K checked 21/21)"
  },
  {
    "id": "francija_world_20261116",
    "names": {
      "en": "France",
      "sl": "Francija"
    },
    "group": "europe",
    "unit": "m",
    "path": "./examples/world/francija_world_20261116.tsp.gz",
    "compression": "gzip",
    "cities": 53408,
    "sha256": "2080cc083621753b1bdcab9fb11659d8cf5ec981b32cfca9e358d9054d9bbe05",
    "bytes": 1069771,
    "gzipSha256": "ad65138a0ac615f1ea82b99104b22967e76c8a8ab4f5469170bcac11ce104f9f",
    "gzipBytes": 460709,
    "source": "https://www.math.uwaterloo.ca/tsp/world/",
    "credit": "World TSP, University of Waterloo",
    "links": [
      {
        "href": "https://www.naturalearthdata.com/",
        "text": {
          "en": "Made with Natural Earth",
          "sl": "Made with Natural Earth"
        }
      }
    ],
    "descriptions": {
      "en": "Metropolitan France and Corsica. Places: World TSP (University of Waterloo; National Imagery and Mapping Agency and USGS GNIS names data). Borders: Made with Natural Earth (public domain). Whole metres in a map projection; straight lines, not great-circle or road distances: at the far edges up to 0.5 % from great-circle distances. Optimum unknown (new map).",
      "sl": "Celinska Francija in Korzika. Kraji: World TSP (University of Waterloo; podatki o imenih National Imagery and Mapping Agency in USGS GNIS). Meje: Made with Natural Earth (javna last). Celi metri v projekciji zemljevida; ravne črte, ne razdalje po velikem krogu ali po cestah: na skrajnih robovih do 0,5 % od razdalj po velikem krogu. Optimum ni znan (nov zemljevid)."
    },
    "maxEdgeErrorPercent": "0.5",
    "optimumKnown": false,
    "dataset": "8zTSP-world final maps 2026-11-16 (K checked 21/21)"
  },
  {
    "id": "nemcija_world_20261116",
    "names": {
      "en": "Germany",
      "sl": "Nemčija"
    },
    "group": "europe",
    "unit": "m",
    "path": "./examples/world/nemcija_world_20261116.tsp.gz",
    "compression": "gzip",
    "cities": 62172,
    "sha256": "c878cd4b3211654f9b083e520621aee719fd719ea201c926551c6220c221baa9",
    "bytes": 1233851,
    "gzipSha256": "d76d366e65cabf500b601d5a28c889c3a479cf2ad0220b6f05847200aadc97f5",
    "gzipBytes": 527249,
    "source": "https://www.math.uwaterloo.ca/tsp/world/",
    "credit": "World TSP, University of Waterloo",
    "links": [
      {
        "href": "https://www.naturalearthdata.com/",
        "text": {
          "en": "Made with Natural Earth",
          "sl": "Made with Natural Earth"
        }
      }
    ],
    "descriptions": {
      "en": "Places: World TSP (University of Waterloo; National Imagery and Mapping Agency and USGS GNIS names data). Borders: Made with Natural Earth (public domain). Whole metres in a map projection; straight lines, not great-circle or road distances: at the far edges up to 0.5 % from great-circle distances. Optimum unknown (new map).",
      "sl": "Kraji: World TSP (University of Waterloo; podatki o imenih National Imagery and Mapping Agency in USGS GNIS). Meje: Made with Natural Earth (javna last). Celi metri v projekciji zemljevida; ravne črte, ne razdalje po velikem krogu ali po cestah: na skrajnih robovih do 0,5 % od razdalj po velikem krogu. Optimum ni znan (nov zemljevid)."
    },
    "maxEdgeErrorPercent": "0.5",
    "optimumKnown": false,
    "dataset": "8zTSP-world final maps 2026-11-16 (K checked 21/21)"
  },
  {
    "id": "ch71009",
    "label": "China · 71,009",
    "names": {
      "en": "China",
      "sl": "Kitajska"
    },
    "group": "asia",
    "unit": null,
    "path": "./examples/ch71009.tsp",
    "cities": 71009,
    "sha256": "abade36c9367578eb2cc82a027b8ea62e4ef6b66ff990328d762605d6408c6bf",
    "bytes": 2116902,
    "source": "https://www.math.uwaterloo.ca/tsp/world/summary.html",
    "dataSource": "https://www.math.uwaterloo.ca/tsp/world/ch71009.tsp",
    "credit": "National TSP collection, University of Waterloo",
    "referenceDate": "2022-07-31",
    "bestKnownTour": 4566506,
    "bound": 4565452,
    "boundKind": "certified"
  },
  {
    "id": "E100k.0",
    "label": "DIMACS E100k.0 · 100,000 · generated",
    "cities": 100000,
    "generator": "portgen",
    "sha256": "840cf3fc140cec778ef65d9a3ad60d1bfef5be3f76847d864a49669d868fa427",
    "bytes": 1967211,
    "bound": 224330692.072818,
    "boundKind": "bound",
    "source": "https://archive.dimacs.rutgers.edu/Challenges/TSP/download.html",
    "group": "random",
    "names": {
      "en": "DIMACS E100k.0",
      "sl": "DIMACS E100k.0"
    },
    "unit": null
  },
  {
    "id": "usa115475",
    "names": {
      "en": "USA (Waterloo usa115475)",
      "sl": "ZDA (Waterloo usa115475)"
    },
    "group": "americas",
    "collection": "waterloo-usa",
    "unit": null,
    "path": "./examples/world/usa115475.tsp.gz",
    "compression": "gzip",
    "cities": 115475,
    "sha256": "2fbaac79b49f4abc48ae4c15b232b5e2c7450aa86a59957f0e05ce88fb20c791",
    "bytes": 3718732,
    "gzipSha256": "f82b24bcb21ef24d39c2cb632b92248df1f3423d03ec425b8c3a4c7091b10e20",
    "gzipBytes": 1464440,
    "bestKnownTour": 6204999,
    "bestKnownBy": {
      "en": "Clarist, Helsgaun and Nagata",
      "sl": "Clarist, Helsgaun in Nagata"
    },
    "optimumKnown": false,
    "source": "https://www.math.uwaterloo.ca/tsp/data/usa/index.html",
    "dataSource": "https://www.math.uwaterloo.ca/tsp/data/usa/usa115475.tsp",
    "credit": "USA TSP challenge, University of Waterloo",
    "referenceDate": "2026-11-16",
    "descriptions": {
      "en": "115,475 towns and cities in the 48 contiguous states, from USGS data (July 2012).",
      "sl": "115.475 mest in naselij v 48 sosednjih zveznih državah, po podatkih USGS (julij 2012)."
    }
  },
  {
    "id": "juzna_amerika_world_20261116",
    "names": {
      "en": "South America",
      "sl": "Južna Amerika"
    },
    "group": "americas",
    "unit": "m",
    "path": "./examples/world/juzna_amerika_world_20261116.tsp.gz",
    "compression": "gzip",
    "cities": 126104,
    "sha256": "ce534fbaf3b28d91598cbf2365489e7178349f8f975105e6ce9431088a2bd8b0",
    "bytes": 2953838,
    "gzipSha256": "b1190656029e439cdf95750ae66c04af0f0e6ee813e7231a050775dc534821a6",
    "gzipBytes": 1186424,
    "source": "https://www.math.uwaterloo.ca/tsp/world/",
    "credit": "World TSP, University of Waterloo",
    "links": [
      {
        "href": "https://www.naturalearthdata.com/",
        "text": {
          "en": "Made with Natural Earth",
          "sl": "Made with Natural Earth"
        }
      }
    ],
    "descriptions": {
      "en": "With French Guiana. Places: World TSP (University of Waterloo; National Imagery and Mapping Agency and USGS GNIS names data). Borders: Made with Natural Earth (public domain). Whole metres in a map projection; straight lines, not great-circle or road distances: at the far edges (Easter Island, Fernando de Noronha) up to 6 % from great-circle distances. Optimum unknown (new map).",
      "sl": "S Francosko Gvajano. Kraji: World TSP (University of Waterloo; podatki o imenih National Imagery and Mapping Agency in USGS GNIS). Meje: Made with Natural Earth (javna last). Celi metri v projekciji zemljevida; ravne črte, ne razdalje po velikem krogu ali po cestah: na skrajnih robovih (Velikonočni otok, Fernando de Noronha) do 6 % od razdalj po velikem krogu. Optimum ni znan (nov zemljevid)."
    },
    "maxEdgeErrorPercent": "6",
    "optimumKnown": false,
    "dataset": "8zTSP-world final maps 2026-11-16 (K checked 21/21)",
    "kind": "continent"
  },
  {
    "id": "rusija_world_20261116",
    "names": {
      "en": "Russia (without Crimea and Sevastopol)",
      "sl": "Rusija (brez Krima in Sevastopola)"
    },
    "group": "eurasia",
    "unit": "m",
    "path": "./examples/world/rusija_world_20261116.tsp.gz",
    "compression": "gzip",
    "cities": 146882,
    "sha256": "711f244e725e5790ef87ded846c7a9746060433b664930b23fff5441a5c04bfc",
    "bytes": 3196243,
    "gzipSha256": "821e2b8eefc990eb9b7e3ba53c0f8d2c41743fb55b678c0d043ade35906dfcc2",
    "gzipBytes": 1419151,
    "source": "https://www.math.uwaterloo.ca/tsp/world/",
    "credit": "World TSP, University of Waterloo",
    "links": [
      {
        "href": "https://www.naturalearthdata.com/",
        "text": {
          "en": "Made with Natural Earth",
          "sl": "Made with Natural Earth"
        }
      }
    ],
    "descriptions": {
      "en": "Crimea and Sevastopol not included (UN and EU position); other borders as drawn by Natural Earth. Places: World TSP (University of Waterloo; National Imagery and Mapping Agency and USGS GNIS names data). Borders: Made with Natural Earth (public domain). Whole metres in a map projection; straight lines, not great-circle or road distances: at the far edges up to 6 % from great-circle distances. Optimum unknown (new map).",
      "sl": "Krim in Sevastopol nista vključena (stališče ZN in EU); druge meje po Natural Earth. Kraji: World TSP (University of Waterloo; podatki o imenih National Imagery and Mapping Agency in USGS GNIS). Meje: Made with Natural Earth (javna last). Celi metri v projekciji zemljevida; ravne črte, ne razdalje po velikem krogu ali po cestah: na skrajnih robovih do 6 % od razdalj po velikem krogu. Optimum ni znan (nov zemljevid)."
    },
    "maxEdgeErrorPercent": "6",
    "optimumKnown": false,
    "dataset": "8zTSP-world final maps 2026-11-16 (K checked 21/21)"
  },
  {
    "id": "zda_world_20261116",
    "names": {
      "en": "United States",
      "sl": "ZDA"
    },
    "group": "americas",
    "unit": "m",
    "path": "./examples/world/zda_world_20261116.tsp.gz",
    "compression": "gzip",
    "cities": 159612,
    "sha256": "3411b609a63a3678c45d0816044a2557e65e3101f7fb88cb29a3d5c396298c1e",
    "bytes": 3532143,
    "gzipSha256": "f50917d99a88772e19e20ba0de1452e2e9a9ab4540fe3204820a0037f5d43d02",
    "gzipBytes": 1513635,
    "source": "https://www.math.uwaterloo.ca/tsp/world/",
    "credit": "World TSP, University of Waterloo",
    "links": [
      {
        "href": "https://www.naturalearthdata.com/",
        "text": {
          "en": "Made with Natural Earth",
          "sl": "Made with Natural Earth"
        }
      }
    ],
    "descriptions": {
      "en": "48 contiguous states and DC. Places: World TSP (University of Waterloo; National Imagery and Mapping Agency and USGS GNIS names data). Borders: Made with Natural Earth (public domain). Whole metres in a map projection; straight lines, not great-circle or road distances: at the far edges up to 2 % from great-circle distances. Optimum unknown (new map).",
      "sl": "48 sosednjih držav in DC. Kraji: World TSP (University of Waterloo; podatki o imenih National Imagery and Mapping Agency in USGS GNIS). Meje: Made with Natural Earth (javna last). Celi metri v projekciji zemljevida; ravne črte, ne razdalje po velikem krogu ali po cestah: na skrajnih robovih do 2 % od razdalj po velikem krogu. Optimum ni znan (nov zemljevid)."
    },
    "maxEdgeErrorPercent": "2",
    "optimumKnown": false,
    "dataset": "8zTSP-world final maps 2026-11-16 (K checked 21/21)"
  },
  {
    "id": "severna_amerika_world_20261116",
    "names": {
      "en": "North America",
      "sl": "Severna Amerika"
    },
    "group": "americas",
    "unit": "m",
    "path": "./examples/world/severna_amerika_world_20261116.tsp.gz",
    "compression": "gzip",
    "cities": 263404,
    "sha256": "587b6d59f5b0d7e4e34b3078858d49e9dd0f5db75da8fe7166f73ed8fc87da81",
    "bytes": 6135673,
    "gzipSha256": "55dd1ee0880f3601cf6794bb6f4defea2c70082c7de4ca2d060f89645d4620ae",
    "gzipBytes": 2514820,
    "source": "https://www.math.uwaterloo.ca/tsp/world/",
    "credit": "World TSP, University of Waterloo",
    "links": [
      {
        "href": "https://www.naturalearthdata.com/",
        "text": {
          "en": "Made with Natural Earth",
          "sl": "Made with Natural Earth"
        }
      }
    ],
    "descriptions": {
      "en": "With Central America, the Caribbean and Greenland. Places: World TSP (University of Waterloo; National Imagery and Mapping Agency and USGS GNIS names data). Borders: Made with Natural Earth (public domain). Whole metres in a map projection; straight lines, not great-circle or road distances: at the far edges (Aleutians, Trinidad and Tobago) up to 10 % from great-circle distances. Optimum unknown (new map).",
      "sl": "S Srednjo Ameriko, Karibi in Grenlandijo. Kraji: World TSP (University of Waterloo; podatki o imenih National Imagery and Mapping Agency in USGS GNIS). Meje: Made with Natural Earth (javna last). Celi metri v projekciji zemljevida; ravne črte, ne razdalje po velikem krogu ali po cestah: na skrajnih robovih (Aleuti, Trinidad in Tobago) do 10 % od razdalj po velikem krogu. Optimum ni znan (nov zemljevid)."
    },
    "maxEdgeErrorPercent": "10",
    "optimumKnown": false,
    "dataset": "8zTSP-world final maps 2026-11-16 (K checked 21/21)",
    "kind": "continent"
  },
  {
    "id": "eu27_world_20261116",
    "names": {
      "en": "EU27",
      "sl": "EU27"
    },
    "group": "europe",
    "unit": "m",
    "path": "./examples/world/eu27_world_20261116.tsp.gz",
    "compression": "gzip",
    "cities": 371671,
    "sha256": "43fbabc6c6819bf21014710eceb55d2c6e1a79333703cddb84b66084ffc16668",
    "bytes": 8438280,
    "gzipSha256": "19137e3224bbf88ae4375fcba3865d46d0ddba0b407bb706be718790c583fef1",
    "gzipBytes": 3457001,
    "source": "https://www.math.uwaterloo.ca/tsp/world/",
    "credit": "World TSP, University of Waterloo",
    "links": [
      {
        "href": "https://www.naturalearthdata.com/",
        "text": {
          "en": "Made with Natural Earth",
          "sl": "Made with Natural Earth"
        }
      }
    ],
    "descriptions": {
      "en": "European Union, 27 member states, European parts. Places: World TSP (University of Waterloo; National Imagery and Mapping Agency and USGS GNIS names data). Borders: Made with Natural Earth (public domain). Whole metres in a map projection; straight lines, not great-circle or road distances: at the far edges up to 2.5 % from great-circle distances. Optimum unknown (new map).",
      "sl": "Evropska unija, 27 držav članic, evropski deli. Kraji: World TSP (University of Waterloo; podatki o imenih National Imagery and Mapping Agency in USGS GNIS). Meje: Made with Natural Earth (javna last). Celi metri v projekciji zemljevida; ravne črte, ne razdalje po velikem krogu ali po cestah: na skrajnih robovih do 2,5 % od razdalj po velikem krogu. Optimum ni znan (nov zemljevid)."
    },
    "maxEdgeErrorPercent": "2.5",
    "optimumKnown": false,
    "dataset": "8zTSP-world final maps 2026-11-16 (K checked 21/21)",
    "desktopOnly": true
  },
  {
    "id": "azija_world_20261116",
    "names": {
      "en": "Asia",
      "sl": "Azija"
    },
    "group": "asia",
    "unit": "m",
    "path": "./examples/world/azija_world_20261116.tsp.gz",
    "compression": "gzip",
    "cities": 571501,
    "sha256": "373af84a8ef61c39de101de055079e1c8d1da33e0e6eb2e4be1bb5c6c5307a5f",
    "bytes": 13555439,
    "gzipSha256": "31c4ed4002a248f35b1b03c9ad9d5691ce08cf93ba2264fc439e44d97584d86d",
    "gzipBytes": 5603429,
    "source": "https://www.math.uwaterloo.ca/tsp/world/",
    "credit": "World TSP, University of Waterloo",
    "links": [
      {
        "href": "https://www.naturalearthdata.com/",
        "text": {
          "en": "Made with Natural Earth",
          "sl": "Made with Natural Earth"
        }
      }
    ],
    "descriptions": {
      "en": "Places: World TSP (University of Waterloo; National Imagery and Mapping Agency and USGS GNIS names data). Borders: Made with Natural Earth (public domain). Whole metres in a map projection; straight lines, not great-circle or road distances: at the far edges (Chukotka, western Turkey) up to 15 % from great-circle distances. Optimum unknown (new map).",
      "sl": "Kraji: World TSP (University of Waterloo; podatki o imenih National Imagery and Mapping Agency in USGS GNIS). Meje: Made with Natural Earth (javna last). Celi metri v projekciji zemljevida; ravne črte, ne razdalje po velikem krogu ali po cestah: na skrajnih robovih (Čukotka, zahodna Turčija) do 15 % od razdalj po velikem krogu. Optimum ni znan (nov zemljevid)."
    },
    "maxEdgeErrorPercent": "15",
    "optimumKnown": false,
    "dataset": "8zTSP-world final maps 2026-11-16 (K checked 21/21)",
    "kind": "continent",
    "desktopOnly": true
  },
  {
    "id": "evropa_world_20261116",
    "names": {
      "en": "Europe",
      "sl": "Evropa"
    },
    "group": "europe",
    "unit": "m",
    "path": "./examples/world/evropa_world_20261116.tsp.gz",
    "compression": "gzip",
    "cities": 598854,
    "sha256": "ec1dbab9f47177100b68f48f335d1e8b4ded298b52d56cdde1b91d36446b2ad9",
    "bytes": 13663457,
    "gzipSha256": "ea76a420a3ee0ef6c09b4601f9a687983ba6a4b09942f164d425683d17f0dba7",
    "gzipBytes": 5747270,
    "source": "https://www.math.uwaterloo.ca/tsp/world/",
    "credit": "World TSP, University of Waterloo",
    "links": [
      {
        "href": "https://www.naturalearthdata.com/",
        "text": {
          "en": "Made with Natural Earth",
          "sl": "Made with Natural Earth"
        }
      }
    ],
    "descriptions": {
      "en": "Places: World TSP (University of Waterloo; National Imagery and Mapping Agency and USGS GNIS names data). Borders: Made with Natural Earth (public domain). Whole metres in a map projection; straight lines, not great-circle or road distances: at the far edges (north-eastern Russia) up to 4 % from great-circle distances. Optimum unknown (new map).",
      "sl": "Kraji: World TSP (University of Waterloo; podatki o imenih National Imagery and Mapping Agency in USGS GNIS). Meje: Made with Natural Earth (javna last). Celi metri v projekciji zemljevida; ravne črte, ne razdalje po velikem krogu ali po cestah: na skrajnih robovih (severovzhodna Rusija) do 4 % od razdalj po velikem krogu. Optimum ni znan (nov zemljevid)."
    },
    "maxEdgeErrorPercent": "4",
    "optimumKnown": false,
    "dataset": "8zTSP-world final maps 2026-11-16 (K checked 21/21)",
    "kind": "continent",
    "desktopOnly": true
  },
  {
    "id": "E1M.0",
    "label": "DIMACS E1M.0 · 1,000,000 · generated",
    "cities": 1000000,
    "generator": "portgen",
    "sha256": "68ac80d45a2bee0b30d4a85f5d597b05a49cfef9c9e4cb9b960d54e251fd703e",
    "bytes": 20667926,
    "bound": 708703512.913668,
    "boundKind": "bound",
    "source": "https://archive.dimacs.rutgers.edu/Challenges/TSP/download.html",
    "group": "random",
    "names": {
      "en": "DIMACS E1M.0",
      "sl": "DIMACS E1M.0"
    },
    "unit": null,
    "desktopOnly": true
  },
  {
    "id": "E10M.0",
    "label": "DIMACS E10M.0 · 10,000,000 · generated",
    "cities": 10000000,
    "generator": "portgen",
    "sha256": "6cd80f9556a34a39e3bc915e387153c8f05fc051bfee0244f7688bf81b741a0f",
    "bytes": 216667663,
    "bound": 2238892584,
    "boundKind": "estimate",
    "source": "https://archive.dimacs.rutgers.edu/Challenges/TSP/download.html",
    "group": "random",
    "names": {
      "en": "DIMACS E10M.0",
      "sl": "DIMACS E10M.0"
    },
    "unit": null,
    "desktopOnly": true
  }
];

export const DESKTOP_ONLY_CITIES = 300000;
export const desktopOnly = item => item.cities > DESKTOP_ONLY_CITIES;
export function exampleLabel(item, language='en') {
  const lang=language.startsWith('sl')?'sl':'en';
  const count=item.cities.toLocaleString(lang==='sl'?'sl-SI':'en-US',{useGrouping:'always'});
  const middle=item.generator||item.id===defaultExampleId?'':item.collectionNames?item.collectionNames[lang]:item.kind==='continent'?(lang==='sl'?'celina':'continent'):exampleGroups.find(g=>g.id===item.group).names[lang];
  // The flat menu has no sections; a short tag keeps the hard instances recognisable.
  const tag=item.group==='hard'?(lang==='sl'?'težak primer':'hard instance'):'';
  return `${item.names[lang]}${middle?' · '+middle:''}${tag?' · '+tag:''} · ${count}${item.generator?(lang==='sl'?' · ustvarjeno na napravi':' · generated on device'):''}`;
}
function displayDate(iso, lang) {
  const date=new Date(iso+'T00:00:00Z');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(iso)||!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==iso)throw Error('Invalid reference date');
  const [year,month,day]=iso.split('-');
  return lang==='sl'?`${Number(day)}. ${Number(month)}. ${year}`:date.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
}
export function gapDisplay(status, language='en') {
  const value=String(status.maximumPercent);
  if(!/^\d+(?:\.\d+)?$/.test(value))throw Error('Invalid reference percentage');
  const [whole,fraction='']=value.split('.');
  const units=BigInt(whole)*1000n+BigInt((fraction+'000').slice(0,3))+(/[1-9]/.test(fraction.slice(3))?1n:0n);
  const lang=language.startsWith('sl')?'sl':'en';
  const percent=String(units/1000n)+(lang==='sl'?',':'.')+String(units%1000n).padStart(3,'0');
  const result={percent,date:displayDate(status.asOf,lang),proofRunning:status.proofRunning!==false};
  if(status.tourDate)result.tourDate=displayDate(status.tourDate,lang);
  if(status.boundAsOf){
    const [day,time='']=String(status.boundAsOf).split(' ');
    if(time&&!/^\d{2}:\d{2}$/.test(time))throw Error('Invalid reference time');
    result.boundAsOf=displayDate(day,lang)+(time?', '+time:'');
  }
  return result;
}
