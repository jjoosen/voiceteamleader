/*
 * Binnendeuren configurator — productcatalogus (datamodel)
 *
 * Prijzen zijn INCLUSIEF 21% btw (particuliere richtprijs). Ze zijn indicatief:
 * bevestiging gebeurt via offerte. Het model is bewust data-gedreven: nieuwe
 * afwerkingen, modellen of prijzen voeg je toe zonder de logica aan te passen.
 */
window.CATALOG = {
  meta: {
    brand: "Binnendeuren Configurator",
    collection: "Deuren op maat",
    currency: "EUR",
    vat: 0.21,
    priceNote:
      "Richtprijzen incl. 21% btw. Definitieve prijs volgt op offerte. Plaatsing niet inbegrepen.",
    updated: "2026",
  },

  /* ---------------------------------------------------------------------- *
   *  AFWERKINGEN (oppervlakken) — per categorie
   *  swatch = CSS-kleur/gradient voor de live preview
   * ---------------------------------------------------------------------- */
  finishGroups: [
    {
      id: "te-verven",
      name: "Te verven",
      blurb: "Schilderklaar wit voorgelakt — jij bepaalt de kleur.",
      finishes: [
        { id: "wit-teverven", name: "Wit (te verven)", swatch: "#f4f2ec", tags: ["wit", "budget"] },
      ],
    },
    {
      id: "soft-mat",
      name: "Soft Mat Emotion",
      blurb: "Matte, zijdezachte toplaag. Luxueus en warm.",
      finishes: [
        { id: "soft-mat-white", name: "Soft Mat White", swatch: "#f6f5f1", tags: ["wit", "mat"] },
        { id: "soft-mat-grey", name: "Soft Mat Grey", swatch: "#cfccc4", tags: ["grijs", "mat"] },
        { id: "soft-mat-taupe", name: "Soft Mat Taupe", swatch: "#9a8f80", tags: ["taupe", "mat"] },
        { id: "soft-mat-sage", name: "Soft Mat Sage Green", swatch: "#b7bda3", tags: ["groen", "mat"] },
      ],
    },
    {
      id: "laminado",
      name: "Laminado Mat",
      blurb: "Uiterst slijtvast en onderhoudsvriendelijk.",
      finishes: [
        { id: "platina-wit", name: "Platina Wit", swatch: "#f2f1ee", tags: ["wit"] },
        { id: "black-mat", name: "Black Mat", swatch: "#1c1c1e", tags: ["zwart"] },
      ],
    },
    {
      id: "industrial",
      name: "Industrial",
      blurb: "Betonlook voor een stoer, industrieel interieur.",
      finishes: [
        { id: "beton-silver", name: 'Beton "Concrete" Silver', swatch: "#b9b7b3", tags: ["beton", "grijs"] },
        { id: "mortex-beige", name: "Mortex Beige", swatch: "#cbb79f", tags: ["beton", "beige"] },
        { id: "candela-marble", name: "Candela Marble", swatch: "#8f9296", tags: ["marmer"] },
        { id: "metallic-anthracite", name: "Metallic Anthracite", swatch: "#3b3d40", tags: ["antraciet"] },
        { id: "ardenne-ardoise", name: "Ardenne Ardoise (leisteen)", swatch: "#2f3336", tags: ["leisteen", "zwart"] },
      ],
    },
    {
      id: "woodlook",
      name: "Woodlook",
      blurb: "Natuurlijke houtstructuur, licht van tint.",
      finishes: [
        { id: "ardenne-oak", name: "Ardenne Oak", swatch: "linear-gradient(90deg,#c9c3b6,#d8d3c8)", tags: ["hout", "eik"] },
      ],
    },
    {
      id: "realwood",
      name: "Realwood",
      blurb: "Voelbare, echte houtstructuur.",
      finishes: [
        { id: "nature-oak", name: "Nature Oak", swatch: "linear-gradient(90deg,#c49a5f,#d8b57a)", tags: ["hout", "eik"] },
        { id: "black-oak", name: "Black Oak", swatch: "linear-gradient(90deg,#3a2f28,#2a221c)", tags: ["hout", "zwart"] },
        { id: "wild-oak", name: "Wild Oak", swatch: "linear-gradient(90deg,#c8a165,#e0c08a)", tags: ["hout", "eik"] },
        { id: "prestige-oak", name: "Prestige Oak", swatch: "linear-gradient(90deg,#a9803f,#c79c5c)", tags: ["hout", "eik"] },
        { id: "heritage-oak", name: "Heritage Oak", swatch: "linear-gradient(90deg,#8a6a3e,#a9823f)", tags: ["hout", "eik"] },
        { id: "walnut", name: "Walnut (notelaar)", swatch: "linear-gradient(90deg,#5b3d2b,#734c33)", tags: ["hout", "walnoot", "donker"] },
      ],
    },
    {
      id: "vintage",
      name: "Vintage",
      blurb: "Verweerde, karaktervolle houtlook.",
      finishes: [
        { id: "mont-ventoux", name: "Mont Ventoux", swatch: "linear-gradient(90deg,#8f8a82,#a19c93)", tags: ["hout", "grijs"] },
        { id: "mont-blanc", name: "Mont Blanc", swatch: "linear-gradient(90deg,#d8cfc2,#e6ded1)", tags: ["hout", "licht"] },
      ],
    },
    {
      id: "modern-classic",
      name: "Modern Classic",
      blurb: "Tijdloze, warme eikentint.",
      finishes: [
        { id: "prime-oak", name: "Prime Oak", swatch: "linear-gradient(90deg,#cca877,#e0c48f)", tags: ["hout", "eik"] },
      ],
    },
  ],

  /* ---------------------------------------------------------------------- *
   *  DEURMODELLEN (freesprofiel / paneelindeling) — voor de preview + prijs
   *  glass = deur met glaspartij (steel look / glasdeur)
   * ---------------------------------------------------------------------- */
  models: {
    vlak: { name: "Vlak / Lisse", desc: "Effen, tijdloos vlak deurblad.", glass: false, lines: 0 },
    "moderne-verticale": { name: "Moderne Verticale", desc: "Verticale designgroeven.", glass: false, lines: 4, orient: "v" },
    "moderne-horizontale": { name: "Moderne Horizontale", desc: "Horizontale designgroeven.", glass: false, lines: 4, orient: "h" },
    "line-2500": { name: "Line Design 2500", desc: "1 designlijn.", glass: false, lines: 1, orient: "v" },
    "line-3500": { name: "Line Design 3500", desc: "2 designlijnen.", glass: false, lines: 2, orient: "v" },
    "line-4500": { name: "Line Design 4500", desc: "4 designlijnen.", glass: false, lines: 4, orient: "v" },
    "1r": { name: "1R (steel)", desc: "Steel look — 1 vlak glas.", glass: true, grid: [1, 1] },
    "3r": { name: "3R (steel)", desc: "Steel look — 3 velden.", glass: true, grid: [1, 3] },
    "4r": { name: "4R (steel)", desc: "Steel look — 4 velden.", glass: true, grid: [2, 2] },
    "8r": { name: "8R (steel)", desc: "Steel look — 8 velden.", glass: true, grid: [2, 4] },
    "2line": { name: "2 Line (steel)", desc: "Steel look — 2 horizontale delen.", glass: true, grid: [1, 2] },
    "3line": { name: "3 Line (steel)", desc: "Steel look — 3 horizontale delen.", glass: true, grid: [1, 3] },
  },

  /* ---------------------------------------------------------------------- *
   *  DEURKRUKKEN / GREPEN
   * ---------------------------------------------------------------------- */
  handles: [
    { id: "geen", name: "Geen kruk (zelf voorzien)", price: 0, finishes: ["alle"], type: "kruk" },
    { id: "linea-prime-inox", name: "Linea Prime – INOX", price: 29.99, finishes: ["inox"], type: "kruk" },
    { id: "linea-square-inox", name: "Linea Square – INOX", price: 29.99, finishes: ["inox"], type: "kruk" },
    { id: "linea-trendy-inox", name: 'Linea Trendy – INOX', price: 16.0, finishes: ["inox"], type: "kruk" },
    { id: "linea-trendy-black", name: "Linea Trendy – Black Mat", price: 19.99, finishes: ["zwart"], type: "kruk" },
    { id: "milano-inox", name: "Milano – Inox-look", price: 29.0, finishes: ["inox"], type: "kruk" },
    { id: "milano-black", name: "Milano – Black", price: 29.0, finishes: ["zwart"], type: "kruk" },
    { id: "milano-white", name: "Milano – White", price: 29.0, finishes: ["wit"], type: "kruk" },
    { id: "steel-01-black", name: "Steel 01 – Black (greep)", price: 49.0, finishes: ["zwart"], type: "greep" },
    { id: "steel-02-black", name: "Steel 02 – Black (greep)", price: 49.0, finishes: ["zwart"], type: "greep" },
    { id: "steel-02-white", name: "Steel 02 – White (greep)", price: 49.0, finishes: ["wit"], type: "greep" },
  ],

  /* ---------------------------------------------------------------------- *
   *  SLOTEN (magnetisch slot standaard inbegrepen)
   *  meerprijs = supplement t.o.v. inbegrepen baardsleutelslot
   * ---------------------------------------------------------------------- */
  locks: [
    { id: "baardsleutel", name: "Magnetisch slot met baardsleutel", extra: 0.0, note: "Standaard inbegrepen" },
    { id: "cilinder", name: "Cilinderslot (afsluitbaar met sleutel)", extra: 8.0, note: "Aanrader slaapkamer/bureau" },
    { id: "wc", name: "WC-/vrij-bezet slot", extra: 8.0, note: "Aanrader badkamer/toilet" },
  ],
  lockColors: [
    { id: "inox", name: "Inox" },
    { id: "zwart", name: "Zwart (mat)" },
  ],

  /* ---------------------------------------------------------------------- *
   *  EXTRA'S / TOEBEHOREN (los bij te bestellen)
   * ---------------------------------------------------------------------- */
  extras: [
    { id: "voegband", name: "Zelfklevend voegband (100mm x 90m)", price: 27.21, per: "rol" },
    { id: "hechtmiddel", name: "Hechtmiddel (voorstrijk)", price: 29.0, per: "stuk" },
    { id: "montageschuim", name: "THYS montageschuim voor deurkasten", price: 12.56, per: "bus" },
    { id: "tpe-zwart", name: "Zwarte TPE-dichtingsstrip (i.p.v. transparant)", price: 19.0, per: "set" },
    { id: "extra-scharnier", name: "Extra verdoken scharnier", price: 14.99, per: "stuk" },
  ],

  /* ---------------------------------------------------------------------- *
   *  PRODUCTLIJNEN
   *
   *  attrs  : score 1-5 voor de adviesmotor (hoger = sterker)
   *  leaf   : prijstabel deurblad  (incl. btw) → base + evt. width-tiers
   *  frame  : prijstabel deurkast  (incl. btw)
   * ---------------------------------------------------------------------- */
  lines: [
    /* ============ 1. TE VERVEN — SERIE 10 (budget, schilderklaar) ======= */
    {
      id: "te-verven",
      name: "Te verven — Serie 10",
      badge: "Budgetvriendelijk",
      tagline: "Schilderklare deuren die je in elke kleur afwerkt.",
      description:
        "De voordeligste keuze. Wit voorgelakt deurblad + deurkast met deurlijsten, " +
        "magnetisch slot en verdoken scharnieren inbegrepen. Zelf te schilderen in je eigen kleur.",
      visibleHandle: true,
      invisible: false,
      handleRequired: true,
      heights: [201.5, 211.5],
      widths: [63, 68, 73, 78, 83, 88, 93],
      finishGroups: ["te-verven"],
      cores: [
        { id: "honingraat", name: "Honingraat (alveolair)", desc: "Licht & goedkoop.", sound: 2 },
        { id: "tubespaan", name: "Tubespaan (tubulair)", desc: "Beste prijs/kwaliteit, dB32.", sound: 4 },
      ],
      models: ["vlak", "moderne-verticale", "moderne-horizontale", "line-2500", "line-3500", "line-4500"],
      attrs: { budget: 5, luxe: 2, invisible: 1, glass: 3, sound: 4, wood: 1, paint: 5, maxHeight: 211.5 },
      // deurblad incl. btw — [core][model] => { base(63-83), wide(88-93) }
      leaf: {
        honingraat: {
          vlak: { "201.5": { base: 79, wide: 89 }, "211.5": { base: 96, wide: 109 } },
          "moderne-verticale": { "201.5": { base: 124, wide: 139 }, "211.5": { base: 144, wide: 159 } },
          "moderne-horizontale": { "201.5": { base: 124, wide: 139 }, "211.5": { base: 144, wide: 159 } },
          "line-2500": { "201.5": { base: 129, wide: 134 }, "211.5": { base: 144, wide: 149 } },
          "line-3500": { "201.5": { base: 129, wide: 134 }, "211.5": { base: 144, wide: 149 } },
          "line-4500": { "201.5": { base: 129, wide: 134 }, "211.5": { base: 144, wide: 149 } },
        },
        tubespaan: {
          vlak: { "201.5": { base: 119, wide: 129 }, "211.5": { base: 124, wide: 139 } },
          "moderne-verticale": { "201.5": { base: 169, wide: 179 }, "211.5": { base: 184, wide: 189 } },
          "moderne-horizontale": { "201.5": { base: 169, wide: 179 }, "211.5": { base: 184, wide: 189 } },
          "line-2500": { "201.5": { base: 169, wide: 174 }, "211.5": { base: 184, wide: 189 } },
          "line-3500": { "201.5": { base: 169, wide: 174 }, "211.5": { base: 184, wide: 189 } },
          "line-4500": { "201.5": { base: 169, wide: 174 }, "211.5": { base: 184, wide: 189 } },
        },
      },
      // deurkast incl. btw (MDF wit voorlak, incl. magnetisch slot + scharnieren)
      // per hoogte, per muurdikte-tier
      frame: {
        type: "met-lijsten",
        name: "Deurkast met deurlijsten (wit voorgelakt)",
        byHeight: {
          "201.5": { "200": 209, "400": 239 },
          "211.5": { "200": 219, "400": 249 },
        },
      },
    },

    /* ============ 2. INVISIBLE FLAT (vlaggenschip) ====================== */
    {
      id: "invisible-flat",
      name: "Invisible Flat",
      badge: "Meest gekozen",
      tagline: "Strak, vlak deurgeheel met gelijkliggende lijsten en verdoken scharnieren.",
      description:
        "Het vlaggenschip. Deurblad ligt gelijk met de kast, verdoken scharnieren, " +
        "magnetisch slot en zichtbare kruk. Talrijke afwerkingen — van schilderklaar tot echte houtstructuur.",
      visibleHandle: true,
      invisible: true,
      handleRequired: true,
      heights: [201.5, 211.5],
      widths: [63, 68, 73, 78, 83, 88, 93],
      finishGroups: ["te-verven", "soft-mat", "laminado", "industrial", "woodlook", "realwood", "vintage", "modern-classic"],
      cores: [
        { id: "tubespaan", name: "Tubespaan (tubulair)", desc: "Stabiel, dB32.", sound: 4 },
      ],
      models: ["vlak"],
      attrs: { budget: 3, luxe: 5, invisible: 5, glass: 1, sound: 3, wood: 5, paint: 3, maxHeight: 211.5 },
      // deurblad incl. btw — prijs per finishGroup (63-83 / 88-93), per hoogte
      leaf: {
        _byFinishGroup: {
          "te-verven": { "201.5": { base: 119, wide: 129 }, "211.5": { base: 124, wide: 139 } },
          "soft-mat": { "201.5": { base: 199, wide: 239 }, "211.5": { base: 214, wide: 254 } },
          laminado: { "201.5": { base: 199, wide: 239 }, "211.5": { base: 214, wide: 254 } },
          industrial: { "201.5": { base: 199, wide: 239 }, "211.5": { base: 214, wide: 254 } },
          woodlook: { "201.5": { base: 199, wide: 239 }, "211.5": { base: 214, wide: 254 } },
          realwood: { "201.5": { base: 199, wide: 239 }, "211.5": { base: 214, wide: 254 } },
          vintage: { "201.5": { base: 199, wide: 239 }, "211.5": { base: 214, wide: 254 } },
          "modern-classic": { "201.5": { base: 199, wide: 239 }, "211.5": { base: 214, wide: 254 } },
        },
      },
      // deurkast incl. btw — keuze uit kleuren (breedte op maat = muurbreedte + 5mm)
      frame: {
        type: "invisible",
        name: "Plaatsklare deurkast (verdoken, met TPE-dichting)",
        options: [
          { id: "platina-wit", name: "Platina Wit", price: 224 },
          { id: "black-mat", name: "Black Mat (incl. zwart slag)", price: 244 },
          { id: "realwood-nature-oak", name: "Realwood Nature Oak", price: 224 },
        ],
      },
    },

    /* ============ 3. STEEL LOOK FEELING ================================ */
    {
      id: "steel-look",
      name: "Steel Look Feeling",
      badge: "Industrieel & licht",
      tagline: "Smalle staaldeuren met 8mm veiligheidsglas — maximale lichtinval.",
      description:
        "Extra smalle profielen (65mm) met groot oppervlak 8mm veiligheidsglas. " +
        "Magnetische sluiting met greep (geen klink). Verdoken scharnieren, plaatsklaar. " +
        "Deuren zijn NIET inkortbaar.",
      visibleHandle: true,
      invisible: true,
      handleRequired: true,
      handleType: "greep",
      heights: [201.5, 211.5],
      widths: [63, 73, 78, 83],
      finishGroups: ["soft-mat", "laminado"], // Soft Mat White / Platina Wit / Black Mat
      finishFilter: ["soft-mat-white", "platina-wit", "black-mat"],
      cores: [
        { id: "steel", name: "Steel (8mm veiligheidsglas)", desc: "Robuust, hoge isolatie.", sound: 3 },
      ],
      models: ["1r", "3r", "4r", "8r", "2line", "3line"],
      // glasoptie
      glassOptions: [
        { id: "helder", name: "Helder glas", extra: 0 },
        { id: "mat", name: "Mat glas", extra: 20 },
        { id: "grijs", name: "Grijs gerookt glas", extra: 40 },
      ],
      attrs: { budget: 3, luxe: 5, invisible: 4, glass: 5, sound: 3, wood: 1, paint: 2, maxHeight: 211.5 },
      // deurblad incl. btw — per model, per hoogte (helder glas basis; +glassOption extra)
      leaf: {
        _byModel: {
          "1r": { "201.5": { base: 299, wide: 299 }, "211.5": { base: 319, wide: 319 } },
          "3r": { "201.5": { base: 349, wide: 349 }, "211.5": { base: 369, wide: 369 } },
          "4r": { "201.5": { base: 369, wide: 369 }, "211.5": { base: 389, wide: 389 } },
          "8r": { "201.5": { base: 389, wide: 389 }, "211.5": { base: 409, wide: 409 } },
          "2line": { "201.5": { base: 349, wide: 349 }, "211.5": { base: 369, wide: 369 } },
          "3line": { "201.5": { base: 389, wide: 389 }, "211.5": { base: 409, wide: 409 } },
        },
      },
      frame: {
        type: "invisible",
        name: "Steel look deurkast (verdoken)",
        options: [
          { id: "platina-wit", name: "Platina Wit", price: 259 },
          { id: "soft-mat-white", name: "Soft Mat White", price: 299 },
          { id: "black-mat", name: "Black Mat", price: 299 },
        ],
      },
    },

    /* ============ 4. INVISIBLE LOFT / LOFT PLUS (hoge deuren) =========== */
    {
      id: "loft",
      name: "Invisible Loft / Loft Plus",
      badge: "Plafondhoog tot 231,5 cm",
      tagline: "Verdoken deurgeheel voor hoge deuren tot 231,5 cm.",
      description:
        "Zoals Invisible Flat, maar voor hoge deuren (201,5 / 211,5 / 231,5 cm). " +
        "Loft = naar binnen draaiend (trekkend), Loft Plus = naar buiten draaiend (duwend). " +
        "Verdoken scharnieren, magnetisch slot, gelijkliggend deurblad.",
      visibleHandle: true,
      invisible: true,
      handleRequired: true,
      heights: [201.5, 211.5, 231.5],
      widths: [63, 68, 73, 78, 83, 88, 93],
      finishGroups: ["te-verven", "soft-mat", "laminado", "industrial", "woodlook", "realwood", "vintage", "modern-classic"],
      cores: [{ id: "tubespaan", name: "Tubespaan (tubulair)", desc: "Stabiel, dB32.", sound: 4 }],
      models: ["vlak"],
      swings: [
        { id: "trekkend", name: "Loft — naar binnen (trekkend)" },
        { id: "duwend", name: "Loft Plus — naar buiten (duwend)" },
      ],
      attrs: { budget: 3, luxe: 5, invisible: 5, glass: 1, sound: 3, wood: 5, paint: 3, maxHeight: 231.5 },
      leaf: {
        _byFinishGroup: {
          "te-verven": { "201.5": { base: 199, wide: 219 }, "211.5": { base: 214, wide: 234 }, "231.5": { base: 249, wide: 269 } },
          "soft-mat": { "201.5": { base: 289, wide: 319 }, "211.5": { base: 309, wide: 339 }, "231.5": { base: 349, wide: 379 } },
          laminado: { "201.5": { base: 289, wide: 319 }, "211.5": { base: 309, wide: 339 }, "231.5": { base: 349, wide: 379 } },
          industrial: { "201.5": { base: 289, wide: 319 }, "211.5": { base: 309, wide: 339 }, "231.5": { base: 349, wide: 379 } },
          woodlook: { "201.5": { base: 289, wide: 319 }, "211.5": { base: 309, wide: 339 }, "231.5": { base: 349, wide: 379 } },
          realwood: { "201.5": { base: 289, wide: 319 }, "211.5": { base: 309, wide: 339 }, "231.5": { base: 349, wide: 379 } },
          vintage: { "201.5": { base: 289, wide: 319 }, "211.5": { base: 309, wide: 339 }, "231.5": { base: 349, wide: 379 } },
          "modern-classic": { "201.5": { base: 289, wide: 319 }, "211.5": { base: 309, wide: 339 }, "231.5": { base: 349, wide: 379 } },
        },
      },
      // deurkast incl. btw — per hoogte, per muurdikte-tier, per draairichting
      frame: {
        type: "invisible",
        name: "Plaatsklare Loft deurkast (verdoken, TPE)",
        bySwingHeight: {
          trekkend: {
            "201.5": { "129": 209, "200": 234, "400": 284 },
            "211.5": { "129": 219, "200": 244, "400": 314 },
            "231.5": { "129": 249, "200": 274, "400": 344 },
          },
          duwend: {
            "201.5": { "129": 244, "200": 269, "400": 319 },
            "211.5": { "129": 254, "200": 279, "400": 349 },
            "231.5": { "129": 284, "200": 309, "400": 379 },
          },
        },
      },
    },

    /* ============ 5. ENDLESS LOFT / LOFT PLUS (tot 300 cm) ============== */
    {
      id: "endless-loft",
      name: "Endless Loft / Loft Plus",
      badge: "Plafondhoog tot 300 cm",
      tagline: "Deuren op maat tot plafondhoogte 300 cm — zonder deurlijsten.",
      description:
        "Deuren tot 300 cm hoogte, volledig op maat. Zichtbare kruk, verdoken scharnieren, " +
        "magnetisch slot, zonder deurlijsten (kader wordt mee bepleisterd). " +
        "Loft = trekkend, Loft Plus = duwend.",
      visibleHandle: true,
      invisible: true,
      handleRequired: true,
      customHeight: { min: 237, max: 300 },
      widths: [73, 78, 83, 88, 93, 98, 103],
      finishGroups: ["te-verven", "laminado"], // Te verven / Platina wit
      finishFilter: ["wit-teverven", "platina-wit"],
      cores: [{ id: "tubespaan", name: "Tubespaan (tubulair)", desc: "Stabiel, dB32.", sound: 4 }],
      models: ["vlak"],
      swings: [
        { id: "trekkend", name: "Endless Loft — naar binnen (trekkend)" },
        { id: "duwend", name: "Endless Loft Plus — naar buiten (duwend)" },
      ],
      attrs: { budget: 2, luxe: 5, invisible: 5, glass: 1, sound: 3, wood: 2, paint: 4, maxHeight: 300 },
      // deurblad incl. btw — per finishGroup, per swing, per breedte-tier (73-93 / 98-103)
      leaf: {
        _bySwingFinish: {
          trekkend: {
            "te-verven": { base: 309, wide: 389 },
            laminado: { base: 410, wide: 450 },
          },
          duwend: {
            "te-verven": { base: 369, wide: 409 },
            laminado: { base: 460, wide: 499 },
          },
        },
        wideFrom: 98, // breedtes >= 98 => 'wide' tarief
      },
      // deurkast incl. btw — per swing, per muurdikte-tier
      frame: {
        type: "invisible-no-lijst",
        name: "Endless Loft deurkast op maat (zonder deurlijsten)",
        bySwing: {
          trekkend: { "165": 291, "215": 291, "400": 378.99 },
          duwend: { "165": 341, "215": 341, "400": 429 },
        },
      },
    },
  ],
};
