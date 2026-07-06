/*
 * Group Thys binnendeuren configurator — logica
 * Vanilla JS, geen dependencies. Werkt volledig client-side (live prijs).
 */
(function () {
  "use strict";

  var C = window.CATALOG;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---- helpers ---------------------------------------------------------- */
  function fmt(n) {
    return "€ " + (Math.round(n * 100) / 100).toFixed(2).replace(".", ",");
  }
  // Toon prijs volgens modus: gezin = incl. btw, aannemer = excl. btw
  function toExcl(n) { return n / (1 + C.meta.vat); }
  function euro(nIncl) {
    return fmt(state.audience === "aannemer" ? toExcl(nIncl) : nIncl);
  }
  function vatLabel() { return state.audience === "aannemer" ? "excl. btw" : "incl. btw"; }
  function finishById(id) {
    for (var g = 0; g < C.finishGroups.length; g++) {
      var grp = C.finishGroups[g];
      for (var f = 0; f < grp.finishes.length; f++) {
        if (grp.finishes[f].id === id) return { finish: grp.finishes[f], group: grp };
      }
    }
    return null;
  }
  function lineById(id) {
    return C.lines.filter(function (l) { return l.id === id; })[0];
  }
  function isWide(width) { return width >= 88; }
  function paintColorById(id) { return C.paintColors.filter(function (p) { return p.id === id; })[0]; }

  // De weer te geven afwerking, rekening houdend met de schilder-modus
  function activeFinish() {
    if (state.finishMode === "geschilderd") {
      var pc = paintColorById(state.paintColor) || C.paintColors[0];
      return { finish: { id: "paint-" + pc.id, name: "Geschilderd: " + pc.name, swatch: pc.swatch, tags: ["mat"] }, group: { id: "te-verven", name: "Geschilderd op kleur" }, painted: true };
    }
    if (state.finishMode === "schilderklaar") {
      return { finish: { id: "wit-teverven", name: "Schilderklaar wit (zelf te schilderen)", swatch: "#f4f2ec", tags: ["wit"] }, group: { id: "te-verven", name: "Schilderklaar" }, paintable: true };
    }
    return finishById(state.finishId) || finishById("soft-mat-white");
  }

  // materiaaltype voor realistische rendering, afgeleid van tags/swatch
  function materialOf(fObj) {
    var f = fObj.finish;
    var t = f.tags || [];
    if (t.indexOf("marmer") >= 0) return "marble";
    if (t.indexOf("beton") >= 0 || t.indexOf("leisteen") >= 0) return "concrete";
    if (t.indexOf("hout") >= 0 || t.indexOf("eik") >= 0 || t.indexOf("walnoot") >= 0 || (f.swatch || "").indexOf("gradient") >= 0) return "wood";
    return "matte";
  }

  /* ---- state ------------------------------------------------------------ */
  var state = {
    view: "start",     // start | gallery | bouw | config | guide | cart | checkout | done
    step: 0,
    audience: "gezin", // gezin (particulier) | aannemer (vakman)
    advice: {},        // antwoorden adviesmotor
    lineId: null,
    finishId: null,
    finishMode: "afgewerkt", // afgewerkt | schilderklaar | geschilderd
    paintColor: "ral9010",
    coreId: null,
    modelId: null,
    height: null,
    customHeight: null,
    width: null,
    swing: null,       // trekkend/duwend
    hinge: "rechts",   // links/rechts
    frameOptId: null,
    lockId: "baardsleutel",
    lockColor: "inox",
    glassId: null,
    handleId: null,
    extras: {},        // id -> qty
    qty: 1,
    _seq: 1,
    cart: [],          // winkelmandje: [{uid,label,cfg,unitIncl,qty,thumb}]
    editingUid: null,  // bewerken van bestaand mandje-item
    checkout: {},      // klant + levering
    order: null,       // geplaatste bestelling
    bouw: {            // bouwselector
      plans: [], rows: [],
      lineId: "invisible-flat", finishId: "soft-mat-white",
      finishMode: "afgewerkt", paintColor: "ral9010", height: 201.5,
    },
  };

  /* ====================================================================== *
   *  ADVIESMOTOR — vertaalt wensen naar de beste productlijn
   * ====================================================================== */
  var ADVICE_QUESTIONS = [
    {
      id: "room", label: "Voor welke ruimte?", icon: "🚪",
      options: [
        { id: "leefruimte", label: "Leef-/woonruimte", ic: "🛋️" },
        { id: "slaapkamer", label: "Slaap-/bureauruimte", ic: "🛏️" },
        { id: "badkamer", label: "Badkamer / toilet", ic: "🚿" },
        { id: "berging", label: "Berging / technisch", ic: "🧰" },
      ],
    },
    {
      id: "look", label: "Welke look spreekt je aan?", icon: "🎨",
      options: [
        { id: "invisible", label: "Strak & onzichtbaar", ic: "⬜", attrs: { invisible: 2, luxe: 1 } },
        { id: "steel", label: "Industrieel staal + glas", ic: "🏭", attrs: { glass: 2, invisible: 1 } },
        { id: "hout", label: "Warme houtlook", ic: "🌳", attrs: { wood: 2, luxe: 1 } },
        { id: "schilder", label: "Schilderklaar wit", ic: "🖌️", attrs: { paint: 2, budget: 1 } },
      ],
    },
    {
      id: "budget", label: "Wat is je budget per deur?", icon: "💶",
      options: [
        { id: "laag", label: "Budgetvriendelijk", ic: "💰", attrs: { budget: 2 } },
        { id: "midden", label: "Gemiddeld", ic: "⚖️", attrs: { luxe: 1 } },
        { id: "hoog", label: "Premium kwaliteit", ic: "💎", attrs: { luxe: 2, invisible: 1 } },
      ],
    },
    {
      id: "height", label: "Hoe hoog moeten de deuren zijn?", icon: "📏",
      options: [
        { id: "standaard", label: "Standaard (± 201–211 cm)", ic: "🚪" },
        { id: "hoog", label: "Verhoogd tot 231 cm", ic: "📐" },
        { id: "plafond", label: "Plafondhoog tot 300 cm", ic: "🏛️" },
      ],
    },
    {
      id: "light", label: "Is lichtinval / glas belangrijk?", icon: "☀️",
      options: [
        { id: "ja", label: "Ja, graag glas", ic: "☀️", attrs: { glass: 2 } },
        { id: "nee", label: "Nee, dichte deur", ic: "⬛", attrs: {} },
      ],
    },
    {
      id: "sound", label: "Is geluidsisolatie belangrijk?", icon: "🔇",
      options: [
        { id: "ja", label: "Ja, graag stil", ic: "🔇", attrs: { sound: 2 } },
        { id: "nee", label: "Niet echt", ic: "🔊", attrs: {} },
      ],
    },
  ];

  // Bereken score per lijn op basis van de antwoorden
  function recommend() {
    var a = state.advice;
    var wishes = { budget: 0, luxe: 0, invisible: 0, glass: 0, sound: 0, wood: 0, paint: 0 };

    ADVICE_QUESTIONS.forEach(function (q) {
      var chosen = (q.options.filter(function (o) { return o.id === a[q.id]; })[0]) || {};
      var at = chosen.attrs || {};
      Object.keys(at).forEach(function (k) { wishes[k] += at[k]; });
    });

    // hoogte-eis bepaalt harde ondergrens
    var needHeight = a.height === "plafond" ? 300 : a.height === "hoog" ? 231.5 : 211.5;

    var scored = C.lines.map(function (line) {
      var s = 0, reasons = [];
      // match wensen tegen lijn-attributen
      Object.keys(wishes).forEach(function (k) {
        if (wishes[k] > 0 && line.attrs[k]) {
          s += wishes[k] * line.attrs[k];
        }
      });
      // hoogte: sluit lijnen uit die niet hoog genoeg gaan
      if (line.attrs.maxHeight < needHeight) {
        s -= 100;
      } else if (needHeight >= 231.5 && line.attrs.maxHeight >= needHeight) {
        s += 8; reasons.push("geschikt voor hoge deuren");
      }
      // badkamer → vocht/tubespaan bonus, endless minder
      if (a.room === "badkamer" && line.id === "te-verven") { s += 4; }
      // berging → budget
      if (a.room === "berging" && line.id === "te-verven") { s += 6; }
      // steel look enkel zinvol bij glas-wens
      if (line.id === "steel-look" && a.light !== "ja" && a.look !== "steel") s -= 8;
      return { line: line, score: s };
    });

    scored.sort(function (x, y) { return y.score - x.score; });
    return scored;
  }

  /* ====================================================================== *
   *  PRIJSBEREKENING
   * ====================================================================== */
  function calcLeaf(line) {
    if (!line) return 0;
    var h = state.height ? String(state.height) : (line.heights ? String(line.heights[0]) : null);
    var wide = isWide(state.width || line.widths[0]);
    var L = line.leaf;

    // Te verven Serie 10: per core + model
    if (L[state.coreId] && !L._byFinishGroup && !L._byModel && !L._bySwingFinish) {
      var byModel = L[state.coreId][state.modelId] || L[state.coreId].vlak;
      var tier = byModel[h] || byModel[Object.keys(byModel)[0]];
      return wide ? tier.wide : tier.base;
    }
    // Invisible Flat / Loft: per finishGroup
    if (L._byFinishGroup) {
      var fg = finishById(state.finishId);
      var gid = fg ? fg.group.id : line.finishGroups[0];
      var t = L._byFinishGroup[gid] || L._byFinishGroup[line.finishGroups[0]];
      var th = t[h] || t[Object.keys(t)[0]];
      return wide ? th.wide : th.base;
    }
    // Steel look: per model (+ glasoptie)
    if (L._byModel) {
      var tm = L._byModel[state.modelId] || L._byModel[line.models[0]];
      var tmh = tm[h] || tm[Object.keys(tm)[0]];
      var p = wide ? tmh.wide : tmh.base;
      if (line.glassOptions && state.glassId) {
        var go = line.glassOptions.filter(function (g) { return g.id === state.glassId; })[0];
        if (go) p += go.extra;
      }
      return p;
    }
    // Endless Loft: per swing + finishGroup, breedte-tier op 98cm
    if (L._bySwingFinish) {
      var sw = state.swing || line.swings[0].id;
      var fg2 = finishById(state.finishId);
      var gid2 = fg2 ? fg2.group.id : line.finishGroups[0];
      var t2 = L._bySwingFinish[sw][gid2] || L._bySwingFinish[sw][line.finishGroups[0]];
      var w = state.width || line.widths[0];
      return w >= (L.wideFrom || 98) ? t2.wide : t2.base;
    }
    return 0;
  }

  function calcFrame(line) {
    if (!line || !line.frame) return 0;
    var F = line.frame;
    var h = state.height ? String(state.height) : (line.heights ? String(line.heights[0]) : "201.5");

    if (F.byHeight) { // te verven
      var bh = F.byHeight[h] || F.byHeight[Object.keys(F.byHeight)[0]];
      return bh["400"]; // standaard tot 400mm muur — grootste tarief tonen
    }
    if (F.options) { // invisible flat / steel look → gekozen kastkleur
      var opt = F.options.filter(function (o) { return o.id === state.frameOptId; })[0] || F.options[0];
      return opt.price;
    }
    if (F.bySwingHeight) { // loft
      var sw = state.swing || "trekkend";
      var by = F.bySwingHeight[sw][h] || F.bySwingHeight[sw]["201.5"];
      return by["400"];
    }
    if (F.bySwing) { // endless loft
      var sw2 = state.swing || "trekkend";
      return F.bySwing[sw2]["400"];
    }
    return 0;
  }

  function calcHandle() {
    if (!state.handleId) return 0;
    var h = C.handles.filter(function (x) { return x.id === state.handleId; })[0];
    return h ? h.price : 0;
  }
  function calcLock() {
    var l = C.locks.filter(function (x) { return x.id === state.lockId; })[0];
    return l ? l.extra : 0;
  }
  function calcExtras() {
    var t = 0;
    Object.keys(state.extras).forEach(function (id) {
      var q = state.extras[id];
      if (!q) return;
      var e = C.extras.filter(function (x) { return x.id === id; })[0];
      if (e) t += e.price * q;
    });
    return t;
  }
  function calcPaint() {
    return state.finishMode === "geschilderd" ? (C.paintService.pricePerDoor || 0) : 0;
  }
  function calcUnit(line) {
    return calcLeaf(line) + calcFrame(line) + calcHandle() + calcLock() + calcPaint();
  }
  function calcTotal(line) {
    return calcUnit(line) * state.qty + calcExtras();
  }

  /* ====================================================================== *
   *  RENDERING
   * ====================================================================== */
  var app = $("#app");

  function render() {
    app.innerHTML = "";
    var stepperEl = $("#stepper");

    if (state.view === "start") {
      app.appendChild(renderStart());
      if (stepperEl) stepperEl.style.display = "none";
    } else if (state.view === "bouw") {
      app.appendChild(renderBouw());
      if (stepperEl) stepperEl.style.display = "none";
    } else if (state.view === "gallery") {
      app.appendChild(renderGallery());
      if (stepperEl) stepperEl.style.display = "none";
    } else if (state.view === "guide") {
      app.appendChild(renderGuide());
      if (stepperEl) stepperEl.style.display = "none";
    } else if (state.view === "cart") {
      app.appendChild(renderCart());
      if (stepperEl) stepperEl.style.display = "none";
    } else if (state.view === "checkout") {
      app.appendChild(renderCheckout());
      if (stepperEl) stepperEl.style.display = "none";
    } else if (state.view === "done") {
      app.appendChild(renderOrderDone());
      if (stepperEl) stepperEl.style.display = "none";
    } else {
      // configurator-wizard
      if (stepperEl) stepperEl.style.display = "";
      var steps = [renderIntro, renderAdvice, renderLine, renderFinish, renderModel,
                   renderSize, renderHardware, renderExtras, renderResult];
      var content = steps[state.step]();
      var withPreview = state.step >= 3 && state.step <= 7 && state.lineId;
      if (withPreview) {
        app.appendChild(h("div", { class: "config-layout" }, [
          h("aside", { class: "preview-aside" }, [renderPreviewPanel()]),
          h("div", { class: "config-main" }, [content]),
        ]));
      } else {
        app.appendChild(content);
      }
      renderStepper();
    }

    renderNav();
    renderModeSwitch();
    updateSummary();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // hoofdnavigatie (Configureren / Keuzehulp / Winkelmandje) onder de header
  function renderNav() {
    var el = $("#mainnav");
    if (!el) return;
    var count = state.cart.reduce(function (n, it) { return n + it.qty; }, 0);
    el.innerHTML = "";
    var items = [
      { id: "gallery", label: "Deuren", ic: "🏠" },
      { id: "bouw", label: "Bouwselector", ic: "📐" },
      { id: "config", label: "Configureren", ic: "🚪" },
      { id: "guide", label: "Keuzehulp", ic: "💡" },
    ];
    items.forEach(function (it) {
      el.appendChild(h("button", {
        class: "nav-item" + (state.view === it.id ? " on" : ""),
        onclick: function () { goView(it.id); },
      }, [h("span", { class: "ni-ic" }, [it.ic]), it.label]));
    });
    el.appendChild(h("button", {
      class: "nav-item cart-btn" + (state.view === "cart" ? " on" : ""),
      onclick: function () { goView("cart"); },
    }, [
      h("span", { class: "ni-ic" }, ["🛒"]), "Winkelmandje",
      count ? h("span", { class: "cart-badge" }, [String(count)]) : null,
    ]));
  }

  function goView(v) {
    state.view = v;
    if (v === "config" && !state.lineId && state.step > 2) state.step = 0;
    render();
  }

  // korte toast-melding
  function toast(msg) {
    var t = $("#toast");
    if (!t) { t = h("div", { id: "toast" }, []); document.body.appendChild(t); }
    t.textContent = msg;
    t.className = "show";
    clearTimeout(t._t);
    t._t = setTimeout(function () { t.className = ""; }, 2200);
  }

  // modus-schakelaar (gezin / aannemer) in de header
  function renderModeSwitch() {
    var el = $("#mode-switch");
    if (!el) return;
    el.innerHTML = "";
    [["gezin", "🏠 Particulier"], ["aannemer", "🔧 Aannemer"]].forEach(function (m) {
      el.appendChild(h("button", {
        class: "mode-btn" + (state.audience === m[0] ? " on" : ""),
        onclick: function () { state.audience = m[0]; render(); },
      }, [m[1]]));
    });
  }

  // live preview-paneel dat naast de stappen blijft staan
  function renderPreviewPanel() {
    var line = lineById(state.lineId);
    var fg = activeFinish();
    return h("div", { class: "preview-card" }, [
      h("div", { class: "preview-door" }, [bigDoor(line, fg)]),
      h("div", { class: "preview-info" }, [
        h("div", { class: "pi-line" }, [line.name]),
        h("div", { class: "pi-finish" }, [fg ? fg.finish.name : ""]),
        h("div", { class: "pi-meta" }, [
          C.models[state.modelId].name + " · " +
          (line.customHeight ? state.customHeight : state.height) + "×" + state.width + " cm",
        ]),
        h("div", { class: "pi-price" }, [
          h("span", { class: "pip-val" }, [euro(calcUnit(line))]),
          h("span", { class: "pip-lbl" }, ["per deur " + vatLabel()]),
        ]),
      ]),
    ]);
  }

  var STEP_NAMES = ["Start", "Advies", "Lijn", "Afwerking", "Model", "Maat", "Beslag", "Extra's", "Resultaat"];
  function renderStepper() {
    var el = $("#stepper");
    if (!el) return;
    el.innerHTML = "";
    STEP_NAMES.forEach(function (n, i) {
      var d = document.createElement("div");
      d.className = "step-dot" + (i === state.step ? " active" : "") + (i < state.step ? " done" : "");
      d.innerHTML = '<span class="num">' + (i < state.step ? "✓" : i + 1) + "</span><span class='lbl'>" + n + "</span>";
      if (i < state.step) d.onclick = function () { state.step = i; render(); };
      el.appendChild(d);
    });
  }

  function h(tag, attrs, kids) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var val = attrs[k];
      if (val === null || val === undefined || val === false) return; // skip lege attrs
      if (k === "class") e.className = val;
      else if (k === "html") e.innerHTML = val;
      else if (k.slice(0, 2) === "on") e[k] = val;
      else e.setAttribute(k, val);
    });
    (kids || []).forEach(function (c) { if (c) e.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return e;
  }
  function card(cls, kids) { return h("div", { class: "panel " + (cls || "") }, kids); }
  function btnRow(kids) { return h("div", { class: "btn-row" }, kids); }
  function nextBtn(label, fn, disabled) {
    return h("button", { class: "btn primary", disabled: disabled ? "disabled" : null, onclick: fn }, [label || "Volgende →"]);
  }
  function backBtn() {
    return h("button", { class: "btn ghost", onclick: function () { state.step = Math.max(0, state.step - 1); render(); } }, ["← Terug"]);
  }

  /* ====================================================================== *
   *  STARTKEUZE — gewoon kiezen of via de bouwselector
   * ====================================================================== */
  function renderStart() {
    return card("start-hero", [
      h("div", { class: "hero-badge" }, ["Binnendeuren op maat"]),
      h("h1", {}, ["Hoe wil je starten?"]),
      h("p", { class: "lead" }, ["Kies wat het best bij jou past. Je kan altijd wisselen via het menu bovenaan."]),
      h("div", { class: "start-choice" }, [
        h("button", { class: "start-card", onclick: function () { goView("gallery"); } }, [
          h("div", { class: "sc-ic" }, ["🚪"]),
          h("h3", {}, ["Ik kies gewoon mijn deuren"]),
          h("p", {}, ["Blader door realistische voorbeelden en stel per deur je afwerking, maat en beslag samen."]),
          h("span", { class: "sc-go" }, ["Naar de deuren →"]),
        ]),
        h("button", { class: "start-card feature", onclick: function () { goView("bouw"); } }, [
          h("div", { class: "sc-ic" }, ["📐"]),
          h("h3", {}, ["Doorloop de bouwselector"]),
          h("p", {}, ["Upload je bouwplan(nen). We bepalen samen alle deuren, afmetingen en aantallen voor je project — in één keer besteld."]),
          h("span", { class: "sc-go" }, ["Start de bouwselector →"]),
          h("span", { class: "sc-badge" }, ["Ideaal voor nieuwbouw & renovatie"]),
        ]),
      ]),
    ]);
  }

  /* ====================================================================== *
   *  BOUWSELECTOR — plan uploaden → deuren, afmetingen & aantallen
   * ====================================================================== */
  var HOME_TYPES = [
    { id: "appartement", name: "Appartement", ic: "🏢", rows: [
      { room: "Inkomhal", qty: 1, width: 83, height: 201.5 },
      { room: "Slaapkamer", qty: 2, width: 83, height: 201.5 },
      { room: "Badkamer", qty: 1, width: 78, height: 201.5 },
      { room: "Toilet", qty: 1, width: 63, height: 201.5 },
      { room: "Berging", qty: 1, width: 73, height: 201.5 },
    ] },
    { id: "rijwoning", name: "Rij-/gesloten woning", ic: "🏠", rows: [
      { room: "Inkomhal", qty: 1, width: 88, height: 211.5 },
      { room: "Leefruimte", qty: 1, width: 88, height: 211.5 },
      { room: "Slaapkamer", qty: 3, width: 83, height: 201.5 },
      { room: "Badkamer", qty: 1, width: 78, height: 201.5 },
      { room: "Toilet", qty: 2, width: 63, height: 201.5 },
      { room: "Berging", qty: 1, width: 73, height: 201.5 },
    ] },
    { id: "villa", name: "Open bebouwing / villa", ic: "🏡", rows: [
      { room: "Inkomhal", qty: 1, width: 93, height: 231.5 },
      { room: "Leefruimte", qty: 2, width: 93, height: 231.5 },
      { room: "Bureau", qty: 1, width: 88, height: 211.5 },
      { room: "Slaapkamer", qty: 4, width: 88, height: 211.5 },
      { room: "Badkamer", qty: 2, width: 83, height: 201.5 },
      { room: "Toilet", qty: 2, width: 63, height: 201.5 },
      { room: "Berging / wasplaats", qty: 2, width: 78, height: 201.5 },
    ] },
  ];

  function renderBouw() {
    var bw = state.bouw;
    var kids = [
      h("div", { class: "guide-hero" }, [
        h("h2", {}, ["Bouwselector"]),
        h("p", { class: "lead" }, ["Upload je bouwplan en bepaal in enkele stappen alle deuren voor je project. Perfect voor nieuwbouw of een volledige renovatie — je bestelt alles in één keer."]),
      ]),
    ];

    // 1. plan upload
    kids.push(h("section", { class: "guide-sec" }, [
      h("h3", {}, ["1. Upload je bouwplan (optioneel)"]),
      h("p", { class: "gs-intro" }, ["Voeg je grondplan of deurenlijst toe als referentie. Foto of PDF — blijft privé bij je aanvraag."]),
      h("label", { class: "upload-zone" }, [
        h("input", { type: "file", accept: "image/*,application/pdf", multiple: "multiple", style: "display:none", onchange: onPlanUpload }, []),
        h("div", { class: "uz-ic" }, ["📤"]),
        h("div", {}, [h("strong", {}, ["Klik om te uploaden"]), h("br"), h("small", {}, ["of sleep je bestand hierheen"])]),
      ]),
      bw.plans.length ? h("div", { class: "plan-thumbs" }, bw.plans.map(function (p, i) {
        return h("div", { class: "plan-thumb" }, [
          p.type === "pdf" ? h("div", { class: "pt-pdf" }, ["📄 " + p.name]) : h("img", { src: p.url, alt: p.name }, []),
          h("button", { class: "pt-del", onclick: function () { bw.plans.splice(i, 1); render(); } }, ["✕"]),
        ]);
      })) : null,
    ]));

    // 2. woningtype snelstart
    kids.push(h("section", { class: "guide-sec" }, [
      h("h3", {}, ["2. Snelstart: kies je woningtype"]),
      h("p", { class: "gs-intro" }, ["We vullen meteen een typische deurenlijst in. Pas alles daarna gerust aan."]),
      h("div", { class: "hometype-grid" }, HOME_TYPES.map(function (ht) {
        return h("button", { class: "hometype", onclick: function () { bw.rows = ht.rows.map(function (r) { return Object.assign({}, r); }); render(); } }, [
          h("span", { class: "ht-ic" }, [ht.ic]),
          h("strong", {}, [ht.name]),
          h("small", {}, [ht.rows.reduce(function (n, r) { return n + r.qty; }, 0) + " deuren"]),
        ]);
      })),
    ]));

    // 3. deurenlijst
    kids.push(h("section", { class: "guide-sec" }, [
      h("h3", {}, ["3. Je deuren, afmetingen & aantallen"]),
      renderDoorRows(),
      h("button", { class: "btn ghost", onclick: function () { bw.rows.push({ room: "Nieuwe ruimte", qty: 1, width: 83, height: 201.5 }); render(); } }, ["+ Deur toevoegen"]),
    ]));

    // 4. afwerking voor het project
    kids.push(h("section", { class: "guide-sec" }, [
      h("h3", {}, ["4. Afwerking voor het hele project"]),
      h("p", { class: "gs-intro" }, ["Kies één stijl voor alle deuren. Individuele deuren pas je nadien nog aan in je winkelmandje."]),
      renderBouwFinish(),
    ]));

    // 5. samenvatting + toevoegen
    var totDoors = bw.rows.reduce(function (n, r) { return n + (+r.qty || 0); }, 0);
    var estTotal = bouwEstimate();
    kids.push(h("section", { class: "guide-sec bouw-foot" }, [
      h("div", { class: "bouw-summary" }, [
        h("div", {}, [h("strong", {}, [totDoors + " deuren"]), h("br"), h("small", {}, [bw.rows.length + " ruimtes"])]),
        h("div", { class: "bs-total" }, [h("span", {}, ["Geschat totaal " + vatLabel()]), h("strong", {}, [euro(estTotal)])]),
      ]),
      h("div", { class: "btn-row" }, [
        h("button", { class: "btn ghost", onclick: function () { goView("start"); } }, ["← Terug"]),
        h("button", { class: "btn primary lg", onclick: addProjectToCart, disabled: totDoors ? null : "disabled" }, ["Alle " + totDoors + " deuren in winkelmandje →"]),
      ]),
      h("p", { class: "disclaimer" }, ["Richtprijs op basis van je keuzes. Upload en aantallen zijn indicatief; onze mensen controleren je plan en bevestigen de definitieve maten."]),
    ]));

    return card("guide", kids);
  }

  function renderDoorRows() {
    var bw = state.bouw;
    if (!bw.rows.length) return h("p", { class: "gs-intro" }, ["Kies hierboven een woningtype of voeg zelf deuren toe."]);
    var rows = bw.rows.map(function (r, i) {
      return h("div", { class: "door-row" }, [
        h("input", { class: "dr-room", type: "text", value: r.room, oninput: function (e) { r.room = e.target.value; } }, []),
        h("div", { class: "dr-field" }, [h("label", {}, ["Aantal"]),
          h("div", { class: "mini-step" }, [
            h("button", { onclick: function () { r.qty = Math.max(1, (+r.qty || 1) - 1); render(); } }, ["−"]),
            h("span", {}, [String(r.qty)]),
            h("button", { onclick: function () { r.qty = (+r.qty || 1) + 1; render(); } }, ["+"]),
          ])]),
        h("div", { class: "dr-field" }, [h("label", {}, ["Breedte"]),
          h("select", { onchange: function (e) { r.width = +e.target.value; render(); } },
            [63, 68, 73, 78, 83, 88, 93, 98, 103].map(function (w) { return h("option", { value: w, selected: r.width === w ? "selected" : null }, [w + " cm"]); }))]),
        h("div", { class: "dr-field" }, [h("label", {}, ["Hoogte"]),
          h("select", { onchange: function (e) { r.height = +e.target.value; render(); } },
            [201.5, 211.5, 231.5].map(function (ht) { return h("option", { value: ht, selected: r.height === ht ? "selected" : null }, [String(ht).replace(".", ",") + " cm"]); }))]),
        h("button", { class: "dr-del", onclick: function () { bw.rows.splice(i, 1); render(); } }, ["🗑"]),
      ]);
    });
    return h("div", { class: "door-rows" }, [
      h("div", { class: "dr-head" }, [h("span", {}, ["Ruimte"]), h("span", {}, ["Aantal"]), h("span", {}, ["Breedte"]), h("span", {}, ["Hoogte"]), h("span", {}, [])]),
    ].concat(rows));
  }

  function renderBouwFinish() {
    var bw = state.bouw;
    // lijnkeuze
    var lineBtns = h("div", { class: "bouw-lines" }, C.lines.map(function (l) {
      return h("button", { class: "bl-btn" + (bw.lineId === l.id ? " sel" : ""), onclick: function () {
        bw.lineId = l.id;
        var line = lineById(l.id);
        if (!hasFinishedGroup(line)) { bw.finishMode = "schilderklaar"; bw.finishId = "wit-teverven"; }
        else { bw.finishMode = "afgewerkt"; bw.finishId = firstFinishedOf(line); }
        render();
      } }, [l.name]);
    }));
    // afwerkingstegels van de gekozen lijn
    var line = lineById(bw.lineId);
    var tiles = [];
    line.finishGroups.forEach(function (gid) {
      if (gid === "te-verven") return;
      var grp = C.finishGroups.filter(function (g) { return g.id === gid; })[0];
      if (!grp) return;
      grp.finishes.filter(function (f) { return !line.finishFilter || line.finishFilter.indexOf(f.id) >= 0; }).forEach(function (f) {
        tiles.push(h("button", { class: "tile" + (bw.finishMode === "afgewerkt" && bw.finishId === f.id ? " sel" : ""), onclick: function () { bw.finishMode = "afgewerkt"; bw.finishId = f.id; render(); } }, [
          h("div", { class: "tile-door", html: tileDoorSVG({ finish: f }, "vlak", line) }, []),
          h("span", { class: "tile-name" }, [f.name]),
        ]));
      });
    });
    if (line.finishGroups.indexOf("te-verven") >= 0) {
      tiles.push(h("button", { class: "tile" + (bw.finishMode === "schilderklaar" ? " sel" : ""), onclick: function () { bw.finishMode = "schilderklaar"; bw.finishId = "wit-teverven"; render(); } }, [
        h("div", { class: "tile-door", html: tileDoorSVG({ finish: { id: "wit-teverven", name: "wit", swatch: "#f4f2ec", tags: ["wit"] } }, "vlak", line) }, []),
        h("span", { class: "tile-name" }, ["Schilderklaar wit"]),
      ]));
    }
    return h("div", {}, [lineBtns, h("div", { class: "tile-grid" }, tiles)]);
  }

  function onPlanUpload(e) {
    var files = Array.prototype.slice.call(e.target.files || []);
    files.forEach(function (file) {
      var isPdf = /pdf$/i.test(file.type) || /\.pdf$/i.test(file.name);
      if (isPdf) { state.bouw.plans.push({ type: "pdf", name: file.name }); render(); return; }
      var reader = new FileReader();
      reader.onload = function (ev) { state.bouw.plans.push({ type: "img", name: file.name, url: ev.target.result }); render(); };
      reader.readAsDataURL(file);
    });
  }

  // schatting projecttotaal
  function bouwEstimate() {
    var bw = state.bouw, line = lineById(bw.lineId), total = 0;
    var saved = snapshotConfig(); saved.finishMode = state.finishMode; saved.paintColor = state.paintColor;
    bw.rows.forEach(function (r) {
      applyBouwToState(r);
      total += calcUnit(line) * (+r.qty || 0);
    });
    Object.keys(saved).forEach(function (k) { state[k] = saved[k]; });
    return total;
  }
  function applyBouwToState(r) {
    var bw = state.bouw, line = lineById(bw.lineId);
    setLineDefaults(line);
    state.finishMode = bw.finishMode; state.finishId = bw.finishId; state.paintColor = bw.paintColor;
    state.modelId = "vlak";
    // dichtste geldige hoogte/breedte voor de lijn
    state.height = line.customHeight ? null : nearest(line.heights, r.height);
    state.customHeight = line.customHeight ? Math.max(line.customHeight.min, Math.min(line.customHeight.max, r.height * 10 > 300 ? r.height : r.height)) : null;
    state.width = nearest(line.widths, r.width);
    if (line.glassOptions) state.glassId = line.glassOptions[0].id;
  }
  function nearest(arr, v) { return arr.reduce(function (a, b) { return Math.abs(b - v) < Math.abs(a - v) ? b : a; }); }

  function addProjectToCart() {
    var bw = state.bouw, line = lineById(bw.lineId);
    if (!bw.rows.length) return;
    var saved = snapshotConfig(); saved.finishMode = state.finishMode; saved.paintColor = state.paintColor; saved.qty = state.qty;
    bw.rows.forEach(function (r) {
      if (!(+r.qty)) return;
      applyBouwToState(r);
      var fg = activeFinish();
      state.cart.push({
        uid: uid(), label: (r.room ? r.room + " · " : "") + currentItemLabel(line, fg),
        lineName: line.name, finishName: (fg ? fg.finish.name : "") + " · " + r.room,
        cfg: snapshotConfig(), unitIncl: calcUnit(line), extrasIncl: 0, qty: +r.qty, thumb: bigDoorSVG(line, fg, true),
      });
    });
    Object.keys(saved).forEach(function (k) { state[k] = saved[k]; });
    state.editingUid = null;
    toast(bw.rows.reduce(function (n, r) { return n + (+r.qty || 0); }, 0) + " deuren toegevoegd");
    goView("cart");
  }

  /* ====================================================================== *
   *  GALERIJ — realistische voorbeelden als startpunt voor particulieren
   * ====================================================================== */
  // showcase-deuren: [lijn, afwerking, model, modus, titel, sfeer]
  var SHOWCASE = [
    { line: "invisible-flat", finish: "nature-oak", model: "vlak", mode: "afgewerkt", title: "Nature Oak", tag: "Warm eiken" },
    { line: "invisible-flat", finish: "walnut", model: "vlak", mode: "afgewerkt", title: "Walnut", tag: "Donker & chic" },
    { line: "invisible-flat", finish: "soft-mat-white", model: "vlak", mode: "afgewerkt", title: "Soft Mat White", tag: "Tijdloos mat wit" },
    { line: "invisible-flat", finish: "black-mat", model: "vlak", mode: "afgewerkt", title: "Black Mat", tag: "Strak zwart" },
    { line: "invisible-flat", finish: "soft-mat-sage", model: "vlak", mode: "afgewerkt", title: "Soft Mat Sage", tag: "Zacht groen" },
    { line: "invisible-flat", finish: "beton-silver", model: "vlak", mode: "afgewerkt", title: "Beton Silver", tag: "Industrieel" },
    { line: "invisible-flat", finish: "candela-marble", model: "vlak", mode: "afgewerkt", title: "Candela Marble", tag: "Marmerlook" },
    { line: "invisible-flat", finish: "wit-teverven", model: "vlak", mode: "geschilderd", paint: "navy", title: "Op kleur geschilderd", tag: "Jouw RAL-kleur" },
    { line: "steel-look", finish: "black-mat", model: "4r", mode: "afgewerkt", title: "Steel Look 4R", tag: "Staal + glas" },
    { line: "steel-look", finish: "black-mat", model: "1r", mode: "afgewerkt", title: "Steel Look 1R", tag: "Staal + glas" },
    { line: "loft", finish: "nature-oak", model: "vlak", mode: "afgewerkt", title: "Loft Nature Oak", tag: "Hoog tot 231 cm" },
    { line: "te-verven", finish: "wit-teverven", model: "vlak", mode: "schilderklaar", title: "Schilderklaar wit", tag: "Zelf schilderen" },
  ];

  // pas een showcase toe op de state (zonder render) → voor rendering én overgang
  function applyShowcase(sc) {
    var line = lineById(sc.line);
    setLineDefaults(line);
    state.finishMode = sc.mode || "afgewerkt";
    if (sc.mode === "geschilderd") { state.paintColor = sc.paint || "ral9010"; state.finishId = "wit-teverven"; }
    else if (sc.mode === "schilderklaar") { state.finishId = "wit-teverven"; }
    else { state.finishId = sc.finish; }
    if (sc.model) state.modelId = sc.model;
    if (line.glassOptions && !state.glassId) state.glassId = line.glassOptions[0].id;
  }

  function renderGallery() {
    // bewaar volledige config, render elke showcase, herstel
    var saved = snapshotConfig(); saved.finishMode = state.finishMode; saved.paintColor = state.paintColor; saved.lineId = state.lineId; saved.qty = state.qty;

    var cards = SHOWCASE.map(function (sc) {
      applyShowcase(sc);
      var line = lineById(sc.line);
      var svg = bigDoorSVG(line, activeFinish(), false);
      var price = calcUnit(line);
      return h("button", { class: "gal-card", onclick: (function (item) { return function () { openShowcase(item); }; })(sc) }, [
        h("div", { class: "gal-door", html: svg }, []),
        h("div", { class: "gal-info" }, [
          h("div", { class: "gal-title" }, [sc.title]),
          h("div", { class: "gal-tag" }, [sc.tag]),
          h("div", { class: "gal-meta" }, [
            h("span", { class: "gal-line" }, [line.name]),
            h("span", { class: "gal-price" }, ["vanaf " + euro(price)]),
          ]),
        ]),
        h("div", { class: "gal-cta" }, ["Bekijk & pas aan →"]),
      ]);
    });

    // herstel live state
    Object.keys(saved).forEach(function (k) { state[k] = k === "extras" ? saved[k] : saved[k]; });

    return h("div", {}, [
      card("gal-hero", [
        h("div", { class: "hero-badge" }, ["Binnendeuren op maat"]),
        h("h1", {}, ["Kies je binnendeur — zie meteen hoe ze eruitziet"]),
        h("p", { class: "lead" }, [
          "Blader door realistische voorbeelden. Klik op een deur die je aanspreekt om ze aan te passen " +
          "(kleur, maat, beslag) met een live voorbeeld. Weet je nog niet wat je wil? Onze keuzehulp en het gratis advies helpen je verder.",
        ]),
        h("div", { class: "hero-actions" }, [
          h("button", { class: "btn primary lg", onclick: function () { state.step = 1; goView("config"); } }, ["Help me kiezen (advies) →"]),
          h("button", { class: "btn ghost lg", onclick: function () { goView("guide"); } }, ["💡 Naar de keuzehulp"]),
        ]),
      ]),
      h("h2", { class: "gal-heading" }, ["Populaire deuren"]),
      h("div", { class: "gallery-grid" }, cards),
      h("div", { class: "gal-foot" }, [
        h("p", {}, ["Meer dan 40 afwerkingen mogelijk — van schilderklaar tot echte houtstructuur, staal-glas en plafondhoog tot 300 cm."]),
        h("button", { class: "btn primary", onclick: function () { state.step = 0; goView("config"); } }, ["Zelf samenstellen →"]),
      ]),
    ]);
  }

  function openShowcase(sc) {
    applyShowcase(sc);
    state.editingUid = null;
    state.qty = 1;
    state.view = "config";
    state.step = 3; // spring naar afwerking zodat men meteen kan aanpassen
    render();
  }

  /* ---- STAP 0 : intro --------------------------------------------------- */
  function renderIntro() {
    var wrap = card("hero", [
      h("div", { class: "hero-badge" }, ["Binnendeuren op maat"]),
      h("h1", {}, ["Vind in 2 minuten jouw perfecte binnendeur"]),
      h("p", { class: "lead" }, [
        "Beantwoord enkele eenvoudige vragen en wij tonen meteen de beste deur voor jouw situatie — " +
        "met een live richtprijs. Daarna verfijn je kleur, maat en beslag. Simpel en visueel.",
      ]),

      // audience-keuze
      h("div", { class: "aud-choice" }, [
        audCard("gezin", "🏠", "Ik ben particulier / gezin", "Prijzen incl. btw, advies op maat van je woning."),
        audCard("aannemer", "🔧", "Ik ben aannemer / vakman", "Prijzen excl. btw, vlot meerdere deuren samenstellen."),
      ]),

      h("div", { class: "usp-grid" }, [
        usp("✨", "Onzichtbaar & strak", "Verdoken scharnieren en gelijkliggende lijsten."),
        usp("📐", "Elke maat", "Van standaard tot plafondhoog (300 cm)."),
        usp("🎨", "Veel afwerkingen", "Hout, mat, beton, staal-glas of schilderklaar."),
        usp("💶", "Direct prijs", "Live richtprijs terwijl je kiest."),
      ]),
      btnRow([
        h("button", { class: "btn primary lg", onclick: function () { state.step = 1; render(); } }, ["Start met advies →"]),
        h("button", { class: "btn ghost lg", onclick: function () { state.step = 2; render(); } }, ["Ik kies liever zelf"]),
      ]),
    ]);
    return wrap;
  }
  function audCard(id, ic, t, d) {
    return h("button", {
      class: "aud-card" + (state.audience === id ? " sel" : ""),
      onclick: function () { state.audience = id; render(); },
    }, [
      h("span", { class: "aud-ic" }, [ic]),
      h("span", { class: "aud-txt" }, [h("strong", {}, [t]), h("small", {}, [d])]),
      h("span", { class: "aud-check" }, [state.audience === id ? "✓" : ""]),
    ]);
  }
  function usp(ic, t, d) {
    return h("div", { class: "usp" }, [h("div", { class: "usp-ic" }, [ic]), h("strong", {}, [t]), h("span", {}, [d])]);
  }

  /* ---- STAP 1 : adviesmotor -------------------------------------------- */
  function renderAdvice() {
    var kids = [h("h2", {}, ["Vertel ons je wensen"]), h("p", { class: "sub" }, ["We stemmen het advies af op jouw situatie."])];
    ADVICE_QUESTIONS.forEach(function (q) {
      var opts = h("div", { class: "opt-grid" }, q.options.map(function (o) {
        return h("button", {
          class: "opt opt-ic" + (state.advice[q.id] === o.id ? " sel" : ""),
          onclick: function () { state.advice[q.id] = o.id; render(); },
        }, [h("span", { class: "o-ic" }, [o.ic || "•"]), h("span", {}, [o.label])]);
      }));
      kids.push(h("div", { class: "q-block" }, [h("h3", {}, [q.icon + " " + q.label]), opts]));
    });

    var answered = ADVICE_QUESTIONS.every(function (q) { return state.advice[q.id]; });
    kids.push(btnRow([backBtn(), nextBtn("Toon mijn beste deur →", function () {
      state.step = 2; render();
    }, !answered)]));
    return card("", kids);
  }

  /* ---- STAP 2 : lijn kiezen (met advies) -------------------------------- */
  function renderLine() {
    var scored = null, best = null;
    if (Object.keys(state.advice).length) {
      scored = recommend();
      best = scored[0].line;
    }
    var kids = [h("h2", {}, ["Kies je productlijn"])];

    if (best) {
      kids.push(h("div", { class: "advice-banner" }, [
        h("span", { class: "star" }, ["★"]),
        h("div", {}, [
          h("strong", {}, ["Ons advies: " + best.name]),
          h("span", {}, [" — " + best.tagline]),
        ]),
      ]));
    }

    var order = scored ? scored.map(function (s) { return s.line; }) : C.lines;
    kids.push(h("div", { class: "line-grid" }, order.map(function (line) {
      var isBest = best && line.id === best.id;
      var priceFrom = lowestFrom(line);
      var REP = { "te-verven": "wit-teverven", "invisible-flat": "nature-oak", "steel-look": "black-mat", "loft": "nature-oak", "endless-loft": "wit-teverven" };
      var repFinishId = REP[line.id] || firstFinishedOf(line) || "wit-teverven";
      var repFinish = finishById(repFinishId) || { finish: { id: "x", name: "", swatch: "#eee", tags: [] } };
      var repModel = line.id === "steel-look" ? "1r" : line.models[0];
      return h("div", {
        class: "line-card img" + (state.lineId === line.id ? " sel" : "") + (isBest ? " best" : ""),
        onclick: function () { selectLine(line.id); },
      }, [
        isBest ? h("div", { class: "ribbon" }, ["Aanbevolen"]) : null,
        h("div", { class: "lc-door", html: tileDoorSVG(repFinish, repModel, line) }, []),
        h("div", { class: "lc-body" }, [
          h("div", { class: "line-badge" }, [line.badge]),
          h("h3", {}, [line.name]),
          h("p", {}, [line.tagline]),
          h("div", { class: "line-meta" }, [
            h("span", {}, ["vanaf " + euro(priceFrom)]),
            line.invisible ? h("span", { class: "tag" }, ["verdoken"]) : null,
            line.attrs.maxHeight >= 300 ? h("span", { class: "tag" }, ["tot 300cm"]) :
              line.attrs.maxHeight >= 231 ? h("span", { class: "tag" }, ["tot 231cm"]) : null,
          ]),
        ]),
      ]);
    })));

    kids.push(btnRow([backBtn(), nextBtn("Volgende →", function () { state.step = 3; render(); }, !state.lineId)]));
    return card("", kids);
  }

  function lowestFrom(line) {
    // ruwe 'vanaf'-indicatie: goedkoopste deurblad + goedkoopste kast
    var saved = { finishId: state.finishId, coreId: state.coreId, modelId: state.modelId, height: state.height, width: state.width, swing: state.swing, frameOptId: state.frameOptId, glassId: state.glassId, customHeight: state.customHeight };
    state.height = line.heights ? line.heights[0] : line.customHeight ? 250 : null;
    state.width = line.widths[0];
    state.coreId = line.cores[0].id;
    state.modelId = line.models[0];
    state.swing = line.swings ? line.swings[0].id : null;
    state.glassId = line.glassOptions ? line.glassOptions[0].id : null;
    // goedkoopste finish
    var cheapFinish = firstFinishOf(line);
    state.finishId = cheapFinish;
    state.frameOptId = line.frame.options ? line.frame.options[0].id : null;
    var v = calcLeaf(line) + calcFrame(line);
    Object.keys(saved).forEach(function (k) { state[k] = saved[k]; });
    return v;
  }
  function firstFinishOf(line) {
    var groups = line.finishGroups;
    for (var i = 0; i < groups.length; i++) {
      var grp = C.finishGroups.filter(function (g) { return g.id === groups[i]; })[0];
      if (!grp) continue;
      for (var j = 0; j < grp.finishes.length; j++) {
        var fid = grp.finishes[j].id;
        if (!line.finishFilter || line.finishFilter.indexOf(fid) >= 0) return fid;
      }
    }
    return null;
  }

  // welke schilder-modi ondersteunt deze lijn?
  function lineModes(line) {
    var m = [];
    if (hasFinishedGroup(line)) m.push("afgewerkt");
    if (line.finishGroups.indexOf("te-verven") >= 0) { m.push("schilderklaar"); m.push("geschilderd"); }
    return m;
  }
  function hasFinishedGroup(line) {
    return line.finishGroups.some(function (g) { return g !== "te-verven"; });
  }
  function firstFinishedOf(line) {
    var groups = line.finishGroups.filter(function (g) { return g !== "te-verven"; });
    for (var i = 0; i < groups.length; i++) {
      var grp = C.finishGroups.filter(function (g) { return g.id === groups[i]; })[0];
      if (!grp) continue;
      for (var j = 0; j < grp.finishes.length; j++) {
        var fid = grp.finishes[j].id;
        if (!line.finishFilter || line.finishFilter.indexOf(fid) >= 0) return fid;
      }
    }
    return null;
  }

  function setLineDefaults(line) {
    state.lineId = line.id;
    var modes = lineModes(line);
    state.finishMode = modes[0] || "afgewerkt";
    state.finishId = state.finishMode === "afgewerkt" ? firstFinishedOf(line) : "wit-teverven";
    state.coreId = line.cores[0].id;
    state.modelId = line.models[0];
    state.height = line.heights ? line.heights[0] : null;
    state.customHeight = line.customHeight ? line.customHeight.min : null;
    state.width = line.widths[Math.min(2, line.widths.length - 1)];
    state.swing = line.swings ? line.swings[0].id : null;
    state.glassId = line.glassOptions ? line.glassOptions[0].id : null;
    state.frameOptId = line.frame.options ? line.frame.options[0].id : null;
    state.handleId = defaultHandle(line);
  }
  function selectLine(id) {
    if (state.lineId === id) return;
    setLineDefaults(lineById(id));
    render();
  }
  function defaultHandle(line) {
    if (line.handleType === "greep") return "steel-02-black";
    return "milano-inox";
  }

  /* ---- STAP 3 : afwerking ---------------------------------------------- */
  function renderFinish() {
    var line = lineById(state.lineId);
    var modes = lineModes(line);
    var kids = [h("h2", {}, ["Kies je afwerking"]), h("p", { class: "sub" }, [line.name])];

    // 1) duidelijke keuze: hoe wil je de deur afgewerkt?
    var modeCards = {
      afgewerkt: { ic: "✨", t: "Kant-en-klaar afgewerkt", d: "Volledig afgewerkt geleverd — je hoeft niet te schilderen. Hout, mat, beton, staal-glas …" },
      schilderklaar: { ic: "🖌️", t: "Schilderklaar (ik schilder zelf)", d: "Voordeligst. Wit voorgelakt; jij schildert in je eigen kleur." },
      geschilderd: { ic: "🎨", t: "In mijn kleur geschilderd", d: "Wij leveren de deur kant-en-klaar geschilderd in de kleur die jij kiest. (+ " + euro(C.paintService.pricePerDoor) + "/deur)" },
    };
    kids.push(h("div", { class: "finish-mode-grid" }, modes.map(function (mid) {
      var mc = modeCards[mid];
      return h("button", {
        class: "fmode-card" + (state.finishMode === mid ? " sel" : ""),
        onclick: function () { setFinishMode(mid, line); },
      }, [
        h("span", { class: "fmc-ic" }, [mc.ic]),
        h("span", { class: "fmc-txt" }, [h("strong", {}, [mc.t]), h("small", {}, [mc.d])]),
        h("span", { class: "aud-check" }, [state.finishMode === mid ? "✓" : ""]),
      ]);
    })));

    // 2) opties afhankelijk van de gekozen modus
    if (state.finishMode === "afgewerkt") {
      line.finishGroups.forEach(function (gid) {
        if (gid === "te-verven") return;
        var grp = C.finishGroups.filter(function (g) { return g.id === gid; })[0];
        if (!grp) return;
        var finishes = grp.finishes.filter(function (f) { return !line.finishFilter || line.finishFilter.indexOf(f.id) >= 0; });
        if (!finishes.length) return;
        kids.push(h("div", { class: "finish-group" }, [
          h("h3", {}, [grp.name]),
          h("p", { class: "grp-blurb" }, [grp.blurb]),
          h("div", { class: "tile-grid" }, finishes.map(function (f) {
            return h("button", {
              class: "tile" + (state.finishId === f.id ? " sel" : ""),
              onclick: function () { state.finishId = f.id; render(); },
            }, [
              h("div", { class: "tile-door", html: tileDoorSVG({ finish: f }, state.modelId, line) }, []),
              h("span", { class: "tile-name" }, [f.name]),
            ]);
          })),
        ]));
      });
    } else if (state.finishMode === "schilderklaar") {
      kids.push(h("div", { class: "finish-note" }, [
        h("p", {}, ["✅ Je ontvangt een net wit voorgelakte deur. Je schildert ze zelf af in de kleur die je wil — ideaal als je later nog wil aanpassen of matchen met je muur."]),
      ]));
    } else if (state.finishMode === "geschilderd") {
      kids.push(h("div", { class: "finish-note" }, [
        h("p", {}, ["✅ Wij schilderen de deur in onze werkplaats in jouw kleur. Ze wordt volledig afgewerkt geleverd — meteen klaar om te plaatsen."]),
      ]));
      kids.push(h("div", { class: "finish-group" }, [
        h("h3", {}, ["Kies je kleur"]),
        h("div", { class: "tile-grid" }, C.paintColors.map(function (pc) {
          return h("button", {
            class: "tile" + (state.paintColor === pc.id ? " sel" : ""),
            onclick: function () { state.paintColor = pc.id; render(); },
          }, [
            h("div", { class: "tile-door", html: tileDoorSVG({ finish: { id: "paint-" + pc.id, name: pc.name, swatch: pc.swatch, tags: ["mat"] } }, state.modelId, line) }, []),
            h("span", { class: "tile-name" }, [pc.name]),
          ]);
        })),
        h("p", { class: "mt-note" }, ["Andere RAL-kleur gewenst? Dat kan — vermeld het bij je bestelling."]),
      ]));
    }

    // core (indien meerdere)
    if (line.cores.length > 1) {
      kids.push(h("div", { class: "finish-group" }, [
        h("h3", {}, ["Deurkern"]),
        h("p", { class: "grp-blurb" }, ["Bepaalt gewicht, geluid en prijs. ", h("a", { href: "#", onclick: function (e) { e.preventDefault(); goView("guide"); } }, ["Meer uitleg in de keuzehulp →"])]),
        h("div", { class: "opt-grid" }, line.cores.map(function (c) {
          return h("button", {
            class: "opt" + (state.coreId === c.id ? " sel" : ""),
            onclick: function () { state.coreId = c.id; render(); },
          }, [h("strong", {}, [c.name]), h("br"), h("small", {}, [c.desc])]);
        })),
      ]));
    }

    kids.push(btnRow([backBtn(), nextBtn("Volgende →", function () { state.step = 4; render(); })]));
    return card("", kids);
  }

  function setFinishMode(mid, line) {
    state.finishMode = mid;
    if (mid === "afgewerkt") { if (!state.finishId || state.finishId === "wit-teverven") state.finishId = firstFinishedOf(line); }
    else { state.finishId = "wit-teverven"; }
    render();
  }

  /* ---- STAP 4 : model + glas ------------------------------------------- */
  function renderModel() {
    var line = lineById(state.lineId);
    var kids = [h("h2", {}, ["Kies je deurmodel"])];

    kids.push(h("div", { class: "model-grid" }, line.models.map(function (mid) {
      var m = C.models[mid];
      return h("button", {
        class: "model-card" + (state.modelId === mid ? " sel" : ""),
        onclick: function () { state.modelId = mid; render(); },
      }, [
        h("div", { class: "model-prev" }, [miniDoor(m)]),
        h("strong", {}, [m.name]),
        h("small", {}, [m.desc]),
      ]);
    })));

    // glasoptie voor steel look
    if (line.glassOptions) {
      kids.push(h("div", { class: "q-block" }, [
        h("h3", {}, ["Glassoort"]),
        h("div", { class: "opt-grid" }, line.glassOptions.map(function (g) {
          return h("button", {
            class: "opt" + (state.glassId === g.id ? " sel" : ""),
            onclick: function () { state.glassId = g.id; render(); },
          }, [g.name + (g.extra ? " (+" + euro(g.extra) + ")" : "")]);
        })),
      ]));
    }

    kids.push(btnRow([backBtn(), nextBtn("Volgende →", function () { state.step = 5; render(); })]));
    return card("", kids);
  }

  // kleine SVG-preview van een model
  function miniDoor(m) {
    var svg = '<svg viewBox="0 0 60 120" class="mini-svg">';
    svg += '<rect x="4" y="2" width="52" height="116" rx="2" fill="#e9e6df" stroke="#c9c4ba"/>';
    if (m.glass && m.grid) {
      var cols = m.grid[0], rows = m.grid[1];
      var gw = 44 / cols, gh = 108 / rows;
      svg += '<rect x="8" y="6" width="44" height="108" fill="#cfe0e6" stroke="#333" stroke-width="2"/>';
      for (var c = 1; c < cols; c++) svg += '<line x1="' + (8 + c * gw) + '" y1="6" x2="' + (8 + c * gw) + '" y2="114" stroke="#333" stroke-width="2"/>';
      for (var r = 1; r < rows; r++) svg += '<line x1="8" y1="' + (6 + r * gh) + '" x2="52" y2="' + (6 + r * gh) + '" stroke="#333" stroke-width="2"/>';
    } else if (m.lines) {
      for (var i = 0; i < m.lines; i++) {
        if (m.orient === "h") {
          var y = 20 + i * (80 / Math.max(1, m.lines - 0));
          svg += '<line x1="10" y1="' + y + '" x2="50" y2="' + y + '" stroke="#b9b3a7" stroke-width="1.5"/>';
        } else {
          var x = 14 + i * (34 / Math.max(1, m.lines));
          svg += '<line x1="' + x + '" y1="8" x2="' + x + '" y2="112" stroke="#b9b3a7" stroke-width="1.5"/>';
        }
      }
    }
    svg += '<circle cx="49" cy="62" r="1.8" fill="#8a8378"/></svg>';
    return h("div", { html: svg });
  }

  /* ---- STAP 5 : maat + draairichting ----------------------------------- */
  function renderSize() {
    var line = lineById(state.lineId);
    var kids = [h("h2", {}, ["Maat & draairichting"])];

    // hoogte
    if (line.customHeight) {
      kids.push(h("div", { class: "q-block" }, [
        h("h3", {}, ["Deurhoogte (op maat)"]),
        h("p", { class: "sub" }, ["Van " + line.customHeight.min + " tot " + line.customHeight.max + " cm."]),
        h("div", { class: "range-row" }, [
          h("input", {
            type: "range", min: line.customHeight.min, max: line.customHeight.max, value: state.customHeight || line.customHeight.min, step: 1,
            oninput: function (e) { state.customHeight = +e.target.value; $("#hval").textContent = e.target.value + " cm"; updateSummary(); },
          }),
          h("span", { id: "hval", class: "range-val" }, [(state.customHeight || line.customHeight.min) + " cm"]),
        ]),
      ]));
    } else {
      kids.push(h("div", { class: "q-block" }, [
        h("h3", {}, ["Deurhoogte"]),
        h("div", { class: "opt-grid" }, line.heights.map(function (ht) {
          return h("button", {
            class: "opt" + (state.height === ht ? " sel" : ""),
            onclick: function () { state.height = ht; render(); },
          }, [String(ht).replace(".", ",") + " cm"]);
        })),
      ]));
    }

    // breedte
    kids.push(h("div", { class: "q-block" }, [
      h("h3", {}, ["Deurbreedte (deurblad)"]),
      h("p", { class: "sub" }, ["Meet de muuropening; wij tonen de bijhorende deurbreedte."]),
      h("div", { class: "opt-grid narrow" }, line.widths.map(function (w) {
        return h("button", {
          class: "opt" + (state.width === w ? " sel" : ""),
          onclick: function () { state.width = w; render(); },
        }, [w + " cm"]);
      })),
    ]));

    // draairichting swing (loft/endless)
    if (line.swings) {
      kids.push(h("div", { class: "q-block" }, [
        h("h3", {}, ["Draairichting"]),
        h("div", { class: "opt-grid" }, line.swings.map(function (s) {
          return h("button", {
            class: "opt" + (state.swing === s.id ? " sel" : ""),
            onclick: function () { state.swing = s.id; render(); },
          }, [s.name]);
        })),
      ]));
    }

    // scharnierzijde links/rechts
    kids.push(h("div", { class: "q-block" }, [
      h("h3", {}, ["Scharnierzijde (van jou uit gezien)"]),
      h("div", { class: "opt-grid" }, [
        h("button", { class: "opt" + (state.hinge === "links" ? " sel" : ""), onclick: function () { state.hinge = "links"; render(); } }, ["Links"]),
        h("button", { class: "opt" + (state.hinge === "rechts" ? " sel" : ""), onclick: function () { state.hinge = "rechts"; render(); } }, ["Rechts"]),
      ]),
    ]));

    kids.push(btnRow([backBtn(), nextBtn("Volgende →", function () { state.step = 6; render(); })]));
    return card("", kids);
  }

  /* ---- STAP 6 : beslag (kast, slot, kruk) ------------------------------ */
  function renderHardware() {
    var line = lineById(state.lineId);
    var kids = [h("h2", {}, ["Deurkast, slot & kruk"])];

    // deurkast
    if (line.frame.options) {
      kids.push(h("div", { class: "q-block" }, [
        h("h3", {}, ["Deurkast (kader)"]),
        h("div", { class: "opt-grid" }, line.frame.options.map(function (o) {
          return h("button", {
            class: "opt" + (state.frameOptId === o.id ? " sel" : ""),
            onclick: function () { state.frameOptId = o.id; render(); },
          }, [h("strong", {}, [o.name]), h("br"), h("small", {}, [euro(o.price)])]);
        })),
      ]));
    } else {
      kids.push(h("div", { class: "q-block" }, [
        h("h3", {}, ["Deurkast"]),
        h("p", { class: "sub" }, [line.frame.name + " — " + euro(calcFrame(line)) + " inbegrepen."]),
      ]));
    }

    // slot
    kids.push(h("div", { class: "q-block" }, [
      h("h3", {}, ["Slot"]),
      h("div", { class: "opt-grid" }, C.locks.map(function (l) {
        return h("button", {
          class: "opt" + (state.lockId === l.id ? " sel" : ""),
          onclick: function () { state.lockId = l.id; render(); },
        }, [h("strong", {}, [l.name]), h("br"), h("small", {}, [l.note + (l.extra ? " · +" + euro(l.extra) : " · inbegrepen")])]);
      })),
    ]));
    kids.push(h("div", { class: "q-block" }, [
      h("h3", {}, ["Slot-/beslagkleur"]),
      h("div", { class: "opt-grid" }, C.lockColors.map(function (lc) {
        return h("button", {
          class: "opt" + (state.lockColor === lc.id ? " sel" : ""),
          onclick: function () { state.lockColor = lc.id; render(); },
        }, [lc.name]);
      })),
    ]));

    // kruk / greep
    var relevantHandles = C.handles.filter(function (hd) {
      if (hd.id === "geen") return true;
      if (line.handleType === "greep") return hd.type === "greep";
      return hd.type === "kruk";
    });
    kids.push(h("div", { class: "q-block" }, [
      h("h3", {}, [line.handleType === "greep" ? "Greep" : "Deurkruk"]),
      h("div", { class: "opt-grid" }, relevantHandles.map(function (hd) {
        return h("button", {
          class: "opt" + (state.handleId === hd.id ? " sel" : ""),
          onclick: function () { state.handleId = hd.id; render(); },
        }, [h("strong", {}, [hd.name]), h("br"), h("small", {}, [hd.price ? "+" + euro(hd.price) : "—"])]);
      })),
    ]));

    kids.push(btnRow([backBtn(), nextBtn("Volgende →", function () { state.step = 7; render(); })]));
    return card("", kids);
  }

  /* ---- STAP 7 : extra's + aantal --------------------------------------- */
  function renderExtras() {
    var kids = [h("h2", {}, ["Toebehoren & aantal"]), h("p", { class: "sub" }, ["Optioneel — voor een vlotte plaatsing."])];

    kids.push(h("div", { class: "extra-list" }, C.extras.map(function (e) {
      var qty = state.extras[e.id] || 0;
      return h("div", { class: "extra-row" }, [
        h("div", {}, [h("strong", {}, [e.name]), h("br"), h("small", {}, [euro(e.price) + " / " + e.per])]),
        h("div", { class: "stepper-ctl" }, [
          h("button", { class: "rnd", onclick: function () { state.extras[e.id] = Math.max(0, qty - 1); render(); } }, ["−"]),
          h("span", {}, [String(qty)]),
          h("button", { class: "rnd", onclick: function () { state.extras[e.id] = qty + 1; render(); } }, ["+"]),
        ]),
      ]);
    })));

    kids.push(h("div", { class: "q-block" }, [
      h("h3", {}, ["Aantal identieke deuren"]),
      h("div", { class: "stepper-ctl big" }, [
        h("button", { class: "rnd", onclick: function () { state.qty = Math.max(1, state.qty - 1); render(); } }, ["−"]),
        h("span", {}, [String(state.qty)]),
        h("button", { class: "rnd", onclick: function () { state.qty += 1; render(); } }, ["+"]),
      ]),
    ]));

    kids.push(btnRow([backBtn(), nextBtn("Bekijk resultaat →", function () { state.step = 8; render(); })]));
    return card("", kids);
  }

  /* ---- STAP 8 : resultaat + offerte ------------------------------------ */
  function renderResult() {
    var line = lineById(state.lineId);
    var fg = activeFinish();
    var kids = [h("h2", {}, ["Jouw samenstelling"])];

    kids.push(h("div", { class: "result-grid" }, [
      h("div", { class: "result-preview" }, [bigDoor(line, fg)]),
      h("div", { class: "result-spec" }, [
        specRow("Productlijn", line.name),
        specRow("Afwerking", fg ? fg.finish.name : "—"),
        line.cores.length > 1 ? specRow("Kern", coreName(line)) : null,
        specRow("Model", C.models[state.modelId].name),
        line.glassOptions ? specRow("Glas", glassName(line)) : null,
        specRow("Hoogte", (line.customHeight ? state.customHeight : state.height) + " cm"),
        specRow("Breedte", state.width + " cm"),
        line.swings ? specRow("Draairichting", swingName(line)) : null,
        specRow("Scharnierzijde", cap(state.hinge)),
        specRow("Deurkast", frameName(line)),
        specRow("Slot", lockName() + " (" + cap(state.lockColor) + ")"),
        specRow("Kruk/greep", handleName()),
        specRow("Aantal", state.qty + " stuk(s)"),
      ]),
    ]));

    // prijsopbouw
    var totalIncl = calcTotal(line);
    var isVak = state.audience === "aannemer";
    kids.push(h("div", { class: "price-breakdown" }, [
      h("h3", {}, ["Prijsopbouw (" + vatLabel() + ")"]),
      priceLine("Deurblad", calcLeaf(line)),
      calcPaint() ? priceLine("Geschilderd op kleur", calcPaint()) : null,
      priceLine("Deurkast", calcFrame(line)),
      calcLock() ? priceLine("Slot-supplement", calcLock()) : null,
      calcHandle() ? priceLine("Kruk/greep", calcHandle()) : null,
      h("div", { class: "pl sub" }, [h("span", {}, ["Per deur"]), h("span", {}, [euro(calcUnit(line))])]),
      state.qty > 1 ? h("div", { class: "pl" }, [h("span", {}, ["× " + state.qty + " deuren"]), h("span", {}, [euro(calcUnit(line) * state.qty)])]) : null,
      calcExtras() ? priceLine("Toebehoren", calcExtras()) : null,
      isVak ? h("div", { class: "pl" }, [h("span", {}, ["Subtotaal excl. btw"]), h("span", {}, [fmt(toExcl(totalIncl))])]) : null,
      isVak ? h("div", { class: "pl" }, [h("span", {}, ["Btw 21%"]), h("span", {}, [fmt(totalIncl - toExcl(totalIncl))])]) : null,
      h("div", { class: "pl total" }, [
        h("span", {}, [isVak ? "Totaal incl. btw" : "Totaal richtprijs"]),
        h("span", {}, [fmt(totalIncl)]),
      ]),
    ]));

    kids.push(h("p", { class: "disclaimer" }, [C.meta.priceNote]));

    // hoofd-actie: in winkelmandje / bestellen
    kids.push(h("div", { class: "result-cta" }, [
      h("button", { class: "btn primary lg", onclick: function () { addToCart(); } }, [
        (state.editingUid ? "✓ Wijziging opslaan" : "🛒 In winkelmandje") + " · " + euro(calcTotal(line)),
      ]),
      h("button", { class: "btn ghost lg", onclick: function () { addToCart(true); } }, ["In mandje en meteen bestellen →"]),
      h("button", { class: "btn ghost", onclick: function () { window.print(); } }, ["🖨 Print / PDF"]),
    ]));

    // offerte (alternatief voor wie liever advies vraagt)
    kids.push(h("details", { class: "quote-fold" }, [
      h("summary", {}, ["Liever eerst een vrijblijvende offerte of advies?"]),
      h("div", { class: "quote-box", id: "quote" }, [
        h("div", { class: "form-grid" }, [
          field("naam", "Naam", "text", true),
          field("email", "E-mail", "email", true),
          field("tel", "Telefoon", "tel", false),
          field("postcode", "Postcode", "text", false),
        ]),
        h("textarea", { id: "f-bericht", placeholder: "Extra info of vraag (optioneel)", rows: "3" }, []),
        h("label", { class: "chk" }, [h("input", { type: "checkbox", id: "f-akkoord" }), h("span", {}, [" Ik ga akkoord dat mijn gegevens gebruikt worden om deze aanvraag te behandelen."])]),
        h("div", { class: "quote-actions" }, [
          h("button", { class: "btn primary", onclick: submitQuote }, ["Verstuur offerte-aanvraag"]),
        ]),
        h("div", { id: "quote-msg", class: "quote-msg" }, []),
      ]),
    ]));

    return card("", kids);
  }

  /* ---- winkelmandje-acties --------------------------------------------- */
  function currentItemLabel(line, fg) {
    return line.name + " · " + (fg ? fg.finish.name : "") + " · " + C.models[state.modelId].name +
      " · " + (line.customHeight ? state.customHeight : state.height) + "×" + state.width + " cm";
  }
  function snapshotConfig() {
    return {
      lineId: state.lineId, finishId: state.finishId, coreId: state.coreId, modelId: state.modelId,
      height: state.height, customHeight: state.customHeight, width: state.width, swing: state.swing,
      hinge: state.hinge, frameOptId: state.frameOptId, lockId: state.lockId, lockColor: state.lockColor,
      glassId: state.glassId, handleId: state.handleId, extras: JSON.parse(JSON.stringify(state.extras)),
    };
  }
  function uid() { return "d" + (state.cart.length + 1) + "-" + state._seq++; }
  function addToCart(goCheckout) {
    var line = lineById(state.lineId);
    var fg = activeFinish();
    var item = {
      uid: state.editingUid || uid(),
      label: currentItemLabel(line, fg),
      lineName: line.name,
      finishName: fg ? fg.finish.name : "",
      cfg: snapshotConfig(),
      unitIncl: calcUnit(line),
      extrasIncl: calcExtras(),
      qty: state.qty,
      thumb: bigDoorSVG(line, fg, true),
    };
    if (state.editingUid) {
      var i = state.cart.map(function (x) { return x.uid; }).indexOf(state.editingUid);
      if (i >= 0) state.cart[i] = item;
      state.editingUid = null;
      toast("Wijziging opgeslagen");
    } else {
      state.cart.push(item);
      toast("Toegevoegd aan winkelmandje");
    }
    state.view = goCheckout ? "checkout" : "cart";
    render();
  }
  function loadCartItem(uidv) {
    var it = state.cart.filter(function (x) { return x.uid === uidv; })[0];
    if (!it) return;
    var c = it.cfg;
    Object.keys(c).forEach(function (k) { state[k] = k === "extras" ? JSON.parse(JSON.stringify(c[k])) : c[k]; });
    state.qty = it.qty;
    state.editingUid = uidv;
    state.view = "config";
    state.step = 8;
    render();
  }
  function removeCartItem(uidv) {
    state.cart = state.cart.filter(function (x) { return x.uid !== uidv; });
    render();
  }
  function cartItemTotal(it) { return it.unitIncl * it.qty + (it.extrasIncl || 0); }
  function cartTotal() { return state.cart.reduce(function (s, it) { return s + cartItemTotal(it); }, 0); }

  function field(id, label, type, req) {
    return h("div", { class: "field" }, [
      h("label", {}, [label + (req ? " *" : "")]),
      h("input", { id: "f-" + id, type: type }, []),
    ]);
  }
  function specRow(k, v) { return h("div", { class: "spec-row" }, [h("span", { class: "k" }, [k]), h("span", { class: "v" }, [v])]); }
  function priceLine(k, v) { return h("div", { class: "pl" }, [h("span", {}, [k]), h("span", {}, [euro(v)])]); }

  // grote deur-preview in een showroom-scène
  function bigDoor(line, fg) {
    return h("div", { class: "door-shell", html: bigDoorSVG(line, fg, false) });
  }

  // genereert een realistische deur in een kamerscène
  function bigDoorSVG(line, fg, thumb) {
    var m = C.models[state.modelId];
    var sw = fg ? fg.finish.swatch : "#eee";
    var isGrad = sw.indexOf("gradient") >= 0;
    var cols2 = (sw.match(/#[0-9a-fA-F]{3,6}/g) || ["#ddd", "#ccc"]);
    var base = isGrad ? cols2[0] : sw;
    var base2 = isGrad ? (cols2[1] || cols2[0]) : shade(sw, -10);
    var isDark = luma(base) < 95;
    var mat = fg ? materialOf(fg) : "matte";

    var frameCol = "#e7e3da";
    if (line.frame.options && state.frameOptId) {
      var fo = state.frameOptId;
      frameCol = fo === "black-mat" ? "#1c1c1e" : fo.indexOf("oak") >= 0 ? "#c49a5f" : "#eceae4";
    }
    var handleLeft = state.hinge === "links";
    var u = "g" + Math.abs(hashStr((fg ? fg.finish.id : "") + state.modelId + (state.frameOptId || "") + (state.lockColor || "")));

    var invisible = line.invisible;
    var dx = invisible ? 18 : 20, dy = invisible ? 14 : 16, dw = invisible ? 164 : 160, dh = invisible ? 312 : 308;

    var T = window.TEXTURES || {};
    var texKey = fg && fg.finish ? fg.finish.id : null;
    var hasTex = !!(texKey && T[texKey] && !(m.glass && m.grid));

    var s = '<svg viewBox="0 0 200 400" class="big-svg" preserveAspectRatio="xMidYMid meet">';
    s += '<defs>';
    if (hasTex) s += '<pattern id="ptd' + u + '" patternUnits="userSpaceOnUse" x="' + dx + '" y="' + dy + '" width="' + dw + '" height="' + dh + '"><image href="' + T[texKey] + '" x="0" y="0" width="' + dw + '" height="' + dh + '" preserveAspectRatio="xMidYMid slice"/></pattern>';
    if (T.floor) s += '<pattern id="ptf' + u + '" patternUnits="userSpaceOnUse" x="0" y="332" width="200" height="68"><image href="' + T.floor + '" x="0" y="0" width="200" height="68" preserveAspectRatio="xMidYMid slice"/></pattern>';
    if (T.wall) s += '<pattern id="ptw' + u + '" patternUnits="userSpaceOnUse" x="0" y="0" width="200" height="332"><image href="' + T.wall + '" x="0" y="0" width="200" height="332" preserveAspectRatio="xMidYMid slice"/></pattern>';
    s += '<linearGradient id="wall' + u + '" x1="0" y1="0" x2="0.3" y2="1"><stop offset="0" stop-color="#f1eee8"/><stop offset="1" stop-color="#e4e0d8"/></linearGradient>';
    s += '<linearGradient id="floor' + u + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d6c7b0"/><stop offset="1" stop-color="#c6b499"/></linearGradient>';
    // deur-basisgradient (lichtval van linksboven)
    s += '<linearGradient id="door' + u + '" x1="0" y1="0" x2="1" y2="0.25"><stop offset="0" stop-color="' + shade(base, 12) + '"/><stop offset="0.45" stop-color="' + base + '"/><stop offset="1" stop-color="' + base2 + '"/></linearGradient>';
    // sheen-overlay (diagonale glans)
    s += '<linearGradient id="sheen' + u + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="rgba(255,255,255,0.16)"/><stop offset="0.35" stop-color="rgba(255,255,255,0)"/><stop offset="1" stop-color="rgba(0,0,0,0.05)"/></linearGradient>';
    s += '<linearGradient id="glass' + u + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e6eef1"/><stop offset="0.5" stop-color="#c2d4da"/><stop offset="1" stop-color="#f0f5f6"/></linearGradient>';
    // materiaal-textuurfilters
    if (mat === "wood") {
      s += '<filter id="tex' + u + '" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.16 0.012" numOctaves="4" seed="4" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.5 0"/></filter>';
    } else if (mat === "marble") {
      s += '<filter id="tex' + u + '"><feTurbulence type="fractalNoise" baseFrequency="0.022 0.03" numOctaves="5" seed="9" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0.25  0 0 0 0 0.27  0 0 0 0 0.3  0 0 0 0.9 -0.35"/></filter>';
    } else if (mat === "concrete") {
      s += '<filter id="tex' + u + '"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.06 0"/></filter>';
    }
    s += '</defs>';

    // kamer (foto-textuur indien beschikbaar)
    s += '<rect x="0" y="0" width="200" height="332" fill="' + (T.wall ? "url(#ptw" + u + ")" : "url(#wall" + u + ")") + '"/>';
    s += '<rect x="0" y="0" width="200" height="332" fill="rgba(255,255,255,0.10)"/>';
    s += '<rect x="0" y="332" width="200" height="68" fill="' + (T.floor ? "url(#ptf" + u + ")" : "url(#floor" + u + ")") + '"/>';
    if (!T.floor) for (var fp = 0; fp < 4; fp++) s += '<line x1="0" y1="' + (344 + fp * 15) + '" x2="200" y2="' + (344 + fp * 15) + '" stroke="rgba(120,90,60,0.12)" stroke-width="1"/>';
    s += '<rect x="0" y="328" width="200" height="7" fill="#f5f2ec"/>'; // plint
    // vloerreflectie van de deur
    s += '<rect x="' + dx + '" y="332" width="' + dw + '" height="26" fill="' + base + '" opacity="0.16"/>';
    // slagschaduw
    s += '<ellipse cx="106" cy="335" rx="90" ry="6" fill="rgba(0,0,0,0.16)"/>';

    // kader
    if (!invisible) {
      s += '<rect x="10" y="10" width="180" height="322" rx="2" fill="' + shade(frameCol, 6) + '"/>';
      s += '<rect x="13" y="13" width="174" height="319" rx="1.5" fill="' + frameCol + '"/>';
      s += '<rect x="10" y="10" width="180" height="322" rx="2" fill="none" stroke="rgba(0,0,0,.08)"/>';
    } else {
      s += '<rect x="' + (dx - 3) + '" y="' + (dy - 2) + '" width="' + (dw + 6) + '" height="' + (dh + 4) + '" rx="1.5" fill="rgba(0,0,0,.06)"/>';
    }

    // deurblad basis: foto-textuur indien beschikbaar, anders gegenereerd materiaal
    if (hasTex) {
      s += '<rect x="' + dx + '" y="' + dy + '" width="' + dw + '" height="' + dh + '" rx="1.5" fill="url(#ptd' + u + ')"/>';
    } else {
      s += '<rect x="' + dx + '" y="' + dy + '" width="' + dw + '" height="' + dh + '" rx="1.5" fill="url(#door' + u + ')"/>';
      if (mat === "wood" || mat === "marble" || mat === "concrete") {
        var op = mat === "wood" ? 0.5 : mat === "marble" ? 0.75 : 0.5;
        s += '<rect x="' + dx + '" y="' + dy + '" width="' + dw + '" height="' + dh + '" rx="1.5" filter="url(#tex' + u + ')" opacity="' + op + '"/>';
      }
    }
    if (!hasTex && mat === "wood") {
      for (var wp = 1; wp < 3; wp++) s += '<line x1="' + (dx + wp * dw / 3) + '" y1="' + dy + '" x2="' + (dx + wp * dw / 3) + '" y2="' + (dy + dh) + '" stroke="rgba(60,40,20,0.10)" stroke-width="1"/>';
    }
    if (!hasTex && mat === "marble") {
      s += '<path d="M' + (dx + 20) + ',' + (dy + 40) + ' q40,30 90,10 t60,40" stroke="rgba(90,95,105,0.35)" stroke-width="1.4" fill="none"/>';
      s += '<path d="M' + (dx + 10) + ',' + (dy + 160) + ' q60,-20 110,30 t40,20" stroke="rgba(90,95,105,0.28)" stroke-width="1.2" fill="none"/>';
    }
    // glans + randlicht
    s += '<rect x="' + dx + '" y="' + dy + '" width="' + dw + '" height="' + dh + '" rx="1.5" fill="url(#sheen' + u + ')"/>';
    s += '<rect x="' + dx + '" y="' + dy + '" width="4" height="' + dh + '" fill="rgba(255,255,255,.14)"/>';

    // model-detail
    var cx = dx, cy = dy, cw = dw, ch = dh;
    if (m.glass && m.grid) {
      var stC = isDark ? "#0e0e0f" : "#1f2124";
      var gcols = m.grid[0], grows = m.grid[1];
      var gx = cx + 10, gy = cy + 10, gw2 = (cw - 20) / gcols, gh2 = (ch - 20) / grows;
      s += '<rect x="' + gx + '" y="' + gy + '" width="' + (cw - 20) + '" height="' + (ch - 20) + '" fill="url(#glass' + u + ')" stroke="' + stC + '" stroke-width="5"/>';
      s += '<polygon points="' + (gx + 8) + ',' + gy + ' ' + (gx + 40) + ',' + gy + ' ' + (gx + 12) + ',' + (gy + ch - 20) + ' ' + gx + ',' + (gy + ch - 20) + '" fill="rgba(255,255,255,0.18)"/>';
      for (var c = 1; c < gcols; c++) s += '<line x1="' + (gx + c * gw2) + '" y1="' + gy + '" x2="' + (gx + c * gw2) + '" y2="' + (gy + ch - 20) + '" stroke="' + stC + '" stroke-width="5"/>';
      for (var r = 1; r < grows; r++) s += '<line x1="' + gx + '" y1="' + (gy + r * gh2) + '" x2="' + (gx + cw - 20) + '" y2="' + (gy + r * gh2) + '" stroke="' + stC + '" stroke-width="5"/>';
    } else if (m.lines) {
      var lc = isDark ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.15)";
      var lc2 = isDark ? "rgba(0,0,0,.25)" : "rgba(255,255,255,.35)";
      for (var i = 0; i < m.lines; i++) {
        if (m.orient === "h") {
          var yy = cy + 55 + i * ((ch - 110) / Math.max(1, m.lines));
          s += '<line x1="' + (cx + 16) + '" y1="' + yy + '" x2="' + (cx + cw - 16) + '" y2="' + yy + '" stroke="' + lc + '" stroke-width="2.5"/>';
          s += '<line x1="' + (cx + 16) + '" y1="' + (yy + 1.5) + '" x2="' + (cx + cw - 16) + '" y2="' + (yy + 1.5) + '" stroke="' + lc2 + '" stroke-width="1"/>';
        } else {
          var xx = cx + 38 + i * ((cw - 76) / Math.max(1, m.lines));
          s += '<line x1="' + xx + '" y1="' + (cy + 14) + '" x2="' + xx + '" y2="' + (cy + ch - 14) + '" stroke="' + lc + '" stroke-width="2.5"/>';
          s += '<line x1="' + (xx + 1.5) + '" y1="' + (cy + 14) + '" x2="' + (xx + 1.5) + '" y2="' + (cy + ch - 14) + '" stroke="' + lc2 + '" stroke-width="1"/>';
        }
      }
    }

    // scharnieren (zichtbaar enkel bij niet-verdoken)
    if (!invisible) {
      var hxs = handleLeft ? dx + dw - 3 : dx - 1;
      [dy + 30, dy + dh / 2, dy + dh - 40].forEach(function (hy) {
        s += '<rect x="' + hxs + '" y="' + hy + '" width="4" height="20" rx="1" fill="rgba(0,0,0,0.18)"/>';
      });
    }

    // kruk / greep
    var isGreep = line.handleType === "greep";
    if (state.handleId !== "geen") {
      var hcol = state.lockColor === "zwart" ? "#1b1b1d" : "#a7a199";
      var hcolD = state.lockColor === "zwart" ? "#000" : "#7d766c";
      if (isGreep) {
        var gx2 = handleLeft ? dx + 12 : dx + dw - 18;
        s += '<rect x="' + gx2 + '" y="145" width="6" height="100" rx="3" fill="' + hcol + '"/>';
        s += '<rect x="' + gx2 + '" y="145" width="2" height="100" fill="' + hcolD + '"/>';
      } else {
        var rox = handleLeft ? dx + 13 : dx + dw - 13;
        var barX = handleLeft ? rox : rox - 24;
        s += '<ellipse cx="' + rox + '" cy="209" rx="6" ry="7" fill="' + hcolD + '"/>';
        s += '<rect x="' + barX + '" y="205" width="24" height="6" rx="3" fill="' + hcol + '"/>';
        s += '<rect x="' + barX + '" y="205" width="24" height="2" rx="1" fill="rgba(255,255,255,0.25)"/>';
      }
    }
    s += "</svg>";
    return s;
  }

  // compacte deur-tegel voor keuzemenu's (afwerking, kleur, lijn)
  function tileDoorSVG(fg, modelId, line) {
    var m = C.models[modelId] || C.models.vlak;
    var sw = fg ? fg.finish.swatch : "#eee";
    var isGrad = sw.indexOf("gradient") >= 0;
    var cols2 = (sw.match(/#[0-9a-fA-F]{3,6}/g) || ["#ddd", "#ccc"]);
    var base = isGrad ? cols2[0] : sw;
    var base2 = isGrad ? (cols2[1] || cols2[0]) : shade(sw, -10);
    var isDark = luma(base) < 95;
    var mat = fg ? materialOf(fg) : "matte";
    var u = "t" + Math.abs(hashStr((fg ? fg.finish.id : "") + modelId + (line ? line.id : "")));
    var W = 88, H = 150, dx = 8, dy = 6, dw = W - 16, dh = H - 12;

    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="tile-svg" preserveAspectRatio="xMidYMid meet">';
    s += '<defs>';
    s += '<linearGradient id="d' + u + '" x1="0" y1="0" x2="1" y2="0.25"><stop offset="0" stop-color="' + shade(base, 12) + '"/><stop offset="0.5" stop-color="' + base + '"/><stop offset="1" stop-color="' + base2 + '"/></linearGradient>';
    s += '<linearGradient id="sh' + u + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="rgba(255,255,255,0.18)"/><stop offset="0.4" stop-color="rgba(255,255,255,0)"/><stop offset="1" stop-color="rgba(0,0,0,0.06)"/></linearGradient>';
    s += '<linearGradient id="gl' + u + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e6eef1"/><stop offset="1" stop-color="#c2d4da"/></linearGradient>';
    if (mat === "wood") s += '<filter id="x' + u + '"><feTurbulence type="fractalNoise" baseFrequency="0.16 0.012" numOctaves="4" seed="4" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.5 0"/></filter>';
    else if (mat === "marble") s += '<filter id="x' + u + '"><feTurbulence type="fractalNoise" baseFrequency="0.03 0.04" numOctaves="5" seed="9" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0.25 0 0 0 0 0.27 0 0 0 0 0.3 0 0 0 0.9 -0.35"/></filter>';
    else if (mat === "concrete") s += '<filter id="x' + u + '"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.06 0"/></filter>';
    var T = window.TEXTURES || {};
    var texKey = fg && fg.finish ? fg.finish.id : null;
    var hasTex = !!(texKey && T[texKey] && !(m.glass && m.grid));
    if (hasTex) s += '<pattern id="pt' + u + '" patternUnits="userSpaceOnUse" x="' + dx + '" y="' + dy + '" width="' + dw + '" height="' + dh + '"><image href="' + T[texKey] + '" x="0" y="0" width="' + dw + '" height="' + dh + '" preserveAspectRatio="xMidYMid slice"/></pattern>';
    s += '</defs>';
    s += '<rect x="0" y="0" width="' + W + '" height="' + H + '" rx="6" fill="#efece6"/>';
    if (hasTex) {
      s += '<rect x="' + dx + '" y="' + dy + '" width="' + dw + '" height="' + dh + '" rx="2" fill="url(#pt' + u + ')"/>';
    } else {
      s += '<rect x="' + dx + '" y="' + dy + '" width="' + dw + '" height="' + dh + '" rx="2" fill="url(#d' + u + ')"/>';
      if (mat === "wood" || mat === "marble" || mat === "concrete") {
        var op = mat === "marble" ? 0.75 : 0.5;
        s += '<rect x="' + dx + '" y="' + dy + '" width="' + dw + '" height="' + dh + '" rx="2" filter="url(#x' + u + ')" opacity="' + op + '"/>';
      }
    }
    s += '<rect x="' + dx + '" y="' + dy + '" width="' + dw + '" height="' + dh + '" rx="2" fill="url(#sh' + u + ')"/>';
    // model
    if (m.glass && m.grid) {
      var stC = isDark ? "#111" : "#23262a";
      var gc = m.grid[0], gr = m.grid[1], gx = dx + 6, gy = dy + 6, gw = (dw - 12) / gc, gh = (dh - 12) / gr;
      s += '<rect x="' + gx + '" y="' + gy + '" width="' + (dw - 12) + '" height="' + (dh - 12) + '" fill="url(#gl' + u + ')" stroke="' + stC + '" stroke-width="3"/>';
      for (var c = 1; c < gc; c++) s += '<line x1="' + (gx + c * gw) + '" y1="' + gy + '" x2="' + (gx + c * gw) + '" y2="' + (gy + dh - 12) + '" stroke="' + stC + '" stroke-width="3"/>';
      for (var r = 1; r < gr; r++) s += '<line x1="' + gx + '" y1="' + (gy + r * gh) + '" x2="' + (gx + dw - 6) + '" y2="' + (gy + r * gh) + '" stroke="' + stC + '" stroke-width="3"/>';
    } else if (m.lines) {
      var lc = isDark ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.15)";
      for (var i = 0; i < m.lines; i++) {
        if (m.orient === "h") { var yy = dy + 24 + i * ((dh - 48) / Math.max(1, m.lines)); s += '<line x1="' + (dx + 8) + '" y1="' + yy + '" x2="' + (dx + dw - 8) + '" y2="' + yy + '" stroke="' + lc + '" stroke-width="1.5"/>'; }
        else { var xx = dx + 18 + i * ((dw - 36) / Math.max(1, m.lines)); s += '<line x1="' + xx + '" y1="' + (dy + 6) + '" x2="' + xx + '" y2="' + (dy + dh - 6) + '" stroke="' + lc + '" stroke-width="1.5"/>'; }
      }
    }
    // krukje
    s += '<circle cx="' + (dx + dw - 8) + '" cy="' + (dy + dh / 2) + '" r="2.5" fill="' + (isDark ? "#ddd" : "#8a8378") + '"/>';
    s += "</svg>";
    return s;
  }

  // kleur-helpers
  function hexToRgb(hx) { hx = hx.replace("#", ""); if (hx.length === 3) hx = hx.split("").map(function (c) { return c + c; }).join(""); return [parseInt(hx.slice(0, 2), 16), parseInt(hx.slice(2, 4), 16), parseInt(hx.slice(4, 6), 16)]; }
  function luma(hx) { try { var r = hexToRgb(hx); return 0.299 * r[0] + 0.587 * r[1] + 0.114 * r[2]; } catch (e) { return 200; } }
  function shade(hx, amt) { try { var r = hexToRgb(hx).map(function (v) { return Math.max(0, Math.min(255, v + amt)); }); return "#" + r.map(function (v) { return ("0" + v.toString(16)).slice(-2); }).join(""); } catch (e) { return hx; } }
  function hashStr(s) { var h2 = 0; for (var i = 0; i < s.length; i++) { h2 = (h2 << 5) - h2 + s.charCodeAt(i); h2 |= 0; } return h2; }

  function coreName(line) { var c = line.cores.filter(function (x) { return x.id === state.coreId; })[0]; return c ? c.name : "—"; }
  function glassName(line) { var g = line.glassOptions.filter(function (x) { return x.id === state.glassId; })[0]; return g ? g.name : "—"; }
  function swingName(line) { var s = line.swings.filter(function (x) { return x.id === state.swing; })[0]; return s ? s.name : "—"; }
  function frameName(line) {
    if (line.frame.options) { var o = line.frame.options.filter(function (x) { return x.id === state.frameOptId; })[0]; return o ? o.name : line.frame.name; }
    return line.frame.name;
  }
  function lockName() { var l = C.locks.filter(function (x) { return x.id === state.lockId; })[0]; return l ? l.name : "—"; }
  function handleName() { var hd = C.handles.filter(function (x) { return x.id === state.handleId; })[0]; return hd ? hd.name : "—"; }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  /* ---- samenvatting-balk (sticky) -------------------------------------- */
  function updateSummary() {
    var bar = $("#summary-bar");
    if (!bar) return;
    var line = state.lineId ? lineById(state.lineId) : null;
    if (!line) { bar.classList.remove("show"); return; }
    bar.classList.add("show");
    var fg = activeFinish();
    $("#sum-line").textContent = line.name;
    $("#sum-detail").textContent = [
      fg ? fg.finish.name : "",
      C.models[state.modelId] ? C.models[state.modelId].name : "",
      ((line.customHeight ? state.customHeight : state.height) || "?") + "×" + (state.width || "?") + "cm",
    ].filter(Boolean).join(" · ");
    $("#sum-price").textContent = euro(calcTotal(line));
    var vl = $("#sum-vat"); if (vl) vl.textContent = "richtprijs " + vatLabel();
  }

  /* ---- offerte versturen ----------------------------------------------- */
  function submitQuote() {
    var msg = $("#quote-msg");
    var naam = ($("#f-naam") || {}).value || "";
    var email = ($("#f-email") || {}).value || "";
    var akkoord = ($("#f-akkoord") || {}).checked;
    if (!naam.trim() || !email.trim()) { msg.className = "quote-msg err"; msg.textContent = "Vul minstens je naam en e-mail in."; return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { msg.className = "quote-msg err"; msg.textContent = "Vul een geldig e-mailadres in."; return; }
    if (!akkoord) { msg.className = "quote-msg err"; msg.textContent = "Vink het akkoord aan om verder te gaan."; return; }

    var line = lineById(state.lineId);
    var payload = {
      klant: {
        naam: naam, email: email,
        tel: ($("#f-tel") || {}).value || "", postcode: ($("#f-postcode") || {}).value || "",
        bericht: ($("#f-bericht") || {}).value || "",
      },
      configuratie: buildConfigObject(line),
      totaal: calcTotal(line),
      totaalTekst: euro(calcTotal(line)),
    };

    msg.className = "quote-msg"; msg.textContent = "Bezig met versturen…";
    fetch("lead.php", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    }).then(function (r) { return r.json().catch(function () { return { ok: false }; }); })
      .then(function (res) {
        if (res && res.ok) { msg.className = "quote-msg ok"; msg.textContent = "Bedankt! Je aanvraag is verstuurd. We nemen snel contact op."; }
        else { fallbackMailto(payload, msg); }
      })
      .catch(function () { fallbackMailto(payload, msg); });
  }

  function fallbackMailto(payload, msg) {
    // geen server-mail geconfigureerd → open e-mailclient met ingevulde info
    var c = payload.configuratie;
    var body = "Offerte-aanvraag binnendeur (Group Thys)\n\n" +
      "Klant: " + payload.klant.naam + " <" + payload.klant.email + ">\n" +
      "Tel: " + payload.klant.tel + "  Postcode: " + payload.klant.postcode + "\n\n" +
      Object.keys(c).map(function (k) { return k + ": " + c[k]; }).join("\n") +
      "\n\nTotaal richtprijs: " + payload.totaalTekst +
      "\n\nBericht: " + payload.klant.bericht;
    var href = "mailto:?subject=" + encodeURIComponent("Offerte-aanvraag binnendeur") + "&body=" + encodeURIComponent(body);
    msg.className = "quote-msg ok";
    msg.innerHTML = "Je aanvraag is klaar. <a href='" + href + "'>Klik hier om ze per e-mail te versturen</a> (of print de pagina).";
  }

  function buildConfigObject(line) {
    var fg = activeFinish();
    var o = {
      Productlijn: line.name,
      Afwerking: fg ? fg.finish.name : "—",
      Model: C.models[state.modelId].name,
      Hoogte: (line.customHeight ? state.customHeight : state.height) + " cm",
      Breedte: state.width + " cm",
      Scharnierzijde: cap(state.hinge),
      Deurkast: frameName(line),
      Slot: lockName() + " (" + cap(state.lockColor) + ")",
      "Kruk/greep": handleName(),
      Aantal: state.qty,
    };
    if (line.cores.length > 1) o.Kern = coreName(line);
    if (line.glassOptions) o.Glas = glassName(line);
    if (line.swings) o.Draairichting = swingName(line);
    var ex = Object.keys(state.extras).filter(function (id) { return state.extras[id]; })
      .map(function (id) { return C.extras.filter(function (e) { return e.id === id; })[0].name + " ×" + state.extras[id]; });
    if (ex.length) o.Toebehoren = ex.join(", ");
    return o;
  }

  /* ====================================================================== *
   *  WINKELMANDJE
   * ====================================================================== */
  function renderCart() {
    var kids = [h("h2", {}, ["Je winkelmandje"])];
    if (!state.cart.length) {
      kids.push(h("div", { class: "empty-state" }, [
        h("div", { class: "es-ic" }, ["🛒"]),
        h("p", {}, ["Je mandje is nog leeg."]),
        h("button", { class: "btn primary", onclick: function () { goView("config"); } }, ["Stel je eerste deur samen →"]),
      ]));
      return card("", kids);
    }
    kids.push(h("div", { class: "cart-list" }, state.cart.map(function (it) {
      return h("div", { class: "cart-item" }, [
        h("div", { class: "ci-thumb", html: it.thumb }, []),
        h("div", { class: "ci-body" }, [
          h("div", { class: "ci-title" }, [it.lineName]),
          h("div", { class: "ci-sub" }, [it.label]),
          h("div", { class: "ci-actions" }, [
            h("button", { class: "link-btn", onclick: function () { loadCartItem(it.uid); } }, ["✎ Wijzig"]),
            h("button", { class: "link-btn danger", onclick: function () { removeCartItem(it.uid); } }, ["🗑 Verwijder"]),
          ]),
        ]),
        h("div", { class: "ci-right" }, [
          h("div", { class: "ci-qty" }, [
            h("button", { class: "rnd sm", onclick: function () { it.qty = Math.max(1, it.qty - 1); render(); } }, ["−"]),
            h("span", {}, [String(it.qty)]),
            h("button", { class: "rnd sm", onclick: function () { it.qty += 1; render(); } }, ["+"]),
          ]),
          h("div", { class: "ci-price" }, [euro(cartItemTotal(it))]),
        ]),
      ]);
    })));

    var tot = cartTotal();
    kids.push(h("div", { class: "cart-summary" }, [
      state.audience === "aannemer"
        ? h("div", { class: "cs-line" }, [h("span", {}, ["Subtotaal excl. btw"]), h("span", {}, [fmt(toExcl(tot))])]) : null,
      state.audience === "aannemer"
        ? h("div", { class: "cs-line" }, [h("span", {}, ["Btw 21%"]), h("span", {}, [fmt(tot - toExcl(tot))])]) : null,
      h("div", { class: "cs-line total" }, [h("span", {}, ["Totaal incl. btw"]), h("span", {}, [fmt(tot)])]),
      h("p", { class: "cs-note" }, ["Levering/plaatsing en eventuele kortingen worden bevestigd bij de bestelling."]),
      h("div", { class: "cart-cta" }, [
        h("button", { class: "btn ghost", onclick: function () { goView("config"); } }, ["← Deur toevoegen"]),
        h("button", { class: "btn primary lg", onclick: function () { goView("checkout"); } }, ["Bestellen →"]),
      ]),
    ]));
    return card("", kids);
  }

  /* ====================================================================== *
   *  CHECKOUT / BESTELLING
   * ====================================================================== */
  function renderCheckout() {
    if (!state.cart.length) { state.view = "cart"; return renderCart(); }
    var co = state.checkout;
    var kids = [h("h2", {}, ["Je bestelling afronden"])];

    kids.push(h("div", { class: "checkout-grid" }, [
      h("div", { class: "co-form" }, [
        h("h3", {}, ["Jouw gegevens"]),
        h("div", { class: "form-grid" }, [
          cofield("voornaam", "Voornaam", "text", true),
          cofield("naam", "Naam", "text", true),
          cofield("email", "E-mail", "email", true),
          cofield("tel", "Telefoon", "tel", true),
        ]),
        h("h3", {}, ["Levering"]),
        h("div", { class: "opt-grid" }, [
          delivOpt("levering", "🚚 Leveren", "Aan huis geleverd"),
          delivOpt("afhalen", "🏬 Afhalen", "In de toonzaal"),
        ]),
        co.delivery !== "afhalen" ? h("div", { class: "form-grid" }, [
          cofield("straat", "Straat + nr.", "text", true),
          cofield("postcode", "Postcode", "text", true),
          cofield("gemeente", "Gemeente", "text", true),
          cofield("land", "Land", "text", false),
        ]) : null,
        h("textarea", { id: "co-opmerking", placeholder: "Opmerking bij je bestelling (optioneel)", rows: "3", oninput: function (e) { co.opmerking = e.target.value; } }, [co.opmerking || ""]),
        h("label", { class: "chk" }, [
          h("input", { type: "checkbox", id: "co-akkoord", checked: co.akkoord ? "checked" : null, onchange: function (e) { co.akkoord = e.target.checked; } }),
          h("span", {}, [" Ik ga akkoord met de verwerking van mijn gegevens en de algemene voorwaarden."]),
        ]),
        h("div", { id: "co-msg", class: "quote-msg" }, []),
        h("div", { class: "btn-row" }, [
          h("button", { class: "btn ghost", onclick: function () { goView("cart"); } }, ["← Terug naar mandje"]),
          h("button", { class: "btn primary lg", onclick: submitOrder }, ["Bestelling plaatsen"]),
        ]),
        h("p", { class: "disclaimer" }, ["Dit is een testversie: je plaatst een bestelaanvraag zonder online betaling. Betaling (bv. via Bancontact/Mollie) kan bij livegang op Combell worden toegevoegd."]),
      ]),
      h("aside", { class: "co-summary" }, [
        h("h3", {}, ["Overzicht"]),
        h("div", { class: "co-items" }, state.cart.map(function (it) {
          return h("div", { class: "co-item" }, [
            h("div", { class: "coi-thumb", html: it.thumb }, []),
            h("div", {}, [h("strong", {}, [it.lineName + " ×" + it.qty]), h("br"), h("small", {}, [it.finishName])]),
            h("span", { class: "coi-price" }, [euro(cartItemTotal(it))]),
          ]);
        })),
        cartTotalBlock(),
      ]),
    ]));
    return card("", kids);
  }
  function cofield(id, label, type, req) {
    var co = state.checkout;
    return h("div", { class: "field" }, [
      h("label", {}, [label + (req ? " *" : "")]),
      h("input", { id: "co-" + id, type: type, value: co[id] || "", oninput: function (e) { co[id] = e.target.value; } }, []),
    ]);
  }
  function delivOpt(id, t, d) {
    var co = state.checkout;
    if (!co.delivery) co.delivery = "levering";
    return h("button", { class: "opt" + (co.delivery === id ? " sel" : ""), onclick: function () { co.delivery = id; render(); } }, [h("strong", {}, [t]), h("br"), h("small", {}, [d])]);
  }
  function cartTotalBlock() {
    var tot = cartTotal();
    return h("div", { class: "cart-summary" }, [
      state.audience === "aannemer" ? h("div", { class: "cs-line" }, [h("span", {}, ["Excl. btw"]), h("span", {}, [fmt(toExcl(tot))])]) : null,
      state.audience === "aannemer" ? h("div", { class: "cs-line" }, [h("span", {}, ["Btw 21%"]), h("span", {}, [fmt(tot - toExcl(tot))])]) : null,
      h("div", { class: "cs-line total" }, [h("span", {}, ["Totaal incl. btw"]), h("span", {}, [fmt(tot)])]),
    ]);
  }

  function submitOrder() {
    var co = state.checkout, msg = $("#co-msg");
    var need = ["voornaam", "naam", "email", "tel"];
    if (co.delivery !== "afhalen") need = need.concat(["straat", "postcode", "gemeente"]);
    for (var i = 0; i < need.length; i++) {
      if (!(co[need[i]] || "").trim()) { msg.className = "quote-msg err"; msg.textContent = "Vul alle verplichte velden in."; return; }
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(co.email || "")) { msg.className = "quote-msg err"; msg.textContent = "Vul een geldig e-mailadres in."; return; }
    if (!co.akkoord) { msg.className = "quote-msg err"; msg.textContent = "Bevestig de voorwaarden om te bestellen."; return; }

    var payload = {
      type: "bestelling",
      klant: co,
      items: state.cart.map(function (it) { return { omschrijving: it.label, aantal: it.qty, prijsIncl: cartItemTotal(it), config: it.cfg }; }),
      totaalIncl: cartTotal(),
      totaalTekst: fmt(cartTotal()),
    };
    msg.className = "quote-msg"; msg.textContent = "Bezig met plaatsen…";
    fetch("order.php", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      .then(function (r) { return r.json().catch(function () { return { ok: false }; }); })
      .then(function (res) { finishOrder(res && res.ordernr); })
      .catch(function () { finishOrder(null); });
  }
  function finishOrder(ordernr) {
    state.order = {
      nr: ordernr || ("TEST-" + (1000 + Math.floor(state._seq * 137 % 9000))),
      total: fmt(cartTotal()),
      email: state.checkout.email,
      items: state.cart.slice(),
      delivery: state.checkout.delivery,
    };
    state.cart = [];
    state.view = "done";
    render();
  }

  function renderOrderDone() {
    var o = state.order || {};
    return card("", [
      h("div", { class: "order-done" }, [
        h("div", { class: "od-check" }, ["✓"]),
        h("h2", {}, ["Bedankt voor je bestelling!"]),
        h("p", { class: "lead" }, ["Je bestelling is geregistreerd onder nummer "]),
        h("div", { class: "od-nr" }, [o.nr || "—"]),
        h("p", {}, ["We sturen een bevestiging naar " + (o.email || "je e-mailadres") + ". " +
          (o.delivery === "afhalen" ? "Je kan je deuren afhalen in de toonzaal na bevestiging." : "We nemen contact op voor de levering.")]),
        h("div", { class: "od-total" }, ["Totaal: " + (o.total || "")]),
        h("div", { class: "btn-row" }, [
          h("button", { class: "btn primary", onclick: function () { state.step = 0; goView("config"); } }, ["Nog een deur samenstellen"]),
          h("button", { class: "btn ghost", onclick: function () { window.print(); } }, ["🖨 Print bevestiging"]),
        ]),
      ]),
    ]);
  }

  /* ====================================================================== *
   *  KEUZEHULP (buying guide) — helpt particulieren kiezen
   * ====================================================================== */
  function renderGuide() {
    var kids = [
      h("div", { class: "guide-hero" }, [
        h("h2", {}, ["Keuzehulp: zo kies je de juiste binnendeur"]),
        h("p", { class: "lead" }, ["Geen expert? Geen probleem. We leggen in klare taal uit waar je op let — kern, geluid, maatnemen en draairichting — zodat je met een gerust hart kiest."]),
        h("button", { class: "btn primary", onclick: function () { state.step = 1; goView("config"); } }, ["Liever meteen advies op maat? Start de configurator →"]),
      ]),
    ];

    // 1. Deurkern vergelijken
    kids.push(h("section", { class: "guide-sec" }, [
      h("h3", {}, ["1. De kern bepaalt gewicht, geluid en prijs"]),
      h("p", { class: "gs-intro" }, ["Elke deur bestaat uit een kaderhout met een kern. Het type kern bepaalt hoe stevig, stil en duur de deur is."]),
      h("div", { class: "core-compare" }, [
        coreCard("Honingraat", "honingraat", "Lichte kartonnen celstructuur.", ["Voordeligst", "Licht"], ["Minder geluidsisolatie", "Gevoeliger voor stoten"], 2),
        coreCard("Tubespaan", "tubespaan", "Stevige kern met luchtkanalen.", ["Beste prijs/kwaliteit", "Geluidsdempend (dB 32)", "Stevig & schokvast"], [], 4),
        coreCard("Volspaan", "volspaan", "Massieve, volle spaanplaat.", ["Beste geluidsisolatie", "Brandwerend mogelijk"], ["Zwaarder", "Duurder"], 5),
      ]),
      h("p", { class: "gs-tip" }, ["💡 Onze tip: voor de meeste woningen is tubespaan de gulden middenweg. Kies volspaan bij slaapkamers/bureau waar stilte telt of waar een brandwerende deur nodig is."]),
    ]));

    // 2. Geluid
    kids.push(h("section", { class: "guide-sec" }, [
      h("h3", {}, ["2. Hoeveel geluidsisolatie heb je nodig?"]),
      h("div", { class: "db-scale" }, [
        dbRow("Berging / technische ruimte", "Honingraat volstaat", 25, "#c9c4ba"),
        dbRow("Leefruimte / gang", "Tubespaan (dB 32)", 32, "#8bbf2a"),
        dbRow("Slaapkamer / bureau", "Tubespaan of volspaan", 36, "#17615f"),
        dbRow("Home cinema / muziek", "Volspaan, dichte deur", 40, "#0e4948"),
      ]),
      h("p", { class: "gs-tip" }, ["💡 Een zwaardere, dichtere deur dempt meer geluid. Een goede aansluiting van kast en dichting is minstens even belangrijk als de deur zelf."]),
    ]));

    // 3. Opmeten
    kids.push(h("section", { class: "guide-sec" }, [
      h("h3", {}, ["3. Correct opmeten in 3 stappen"]),
      h("div", { class: "measure-grid" }, [
        measureStep("1", "📏", "Meet de breedte", "Meet de muuropening op 3 hoogtes (boven, midden, onder) en noteer de kleinste maat."),
        measureStep("2", "📐", "Meet de hoogte", "Meet links, midden en rechts van vloer tot bovenkant opening. Noteer de kleinste maat."),
        measureStep("3", "🧱", "Meet de muurdikte", "Meet de dikte van de muur op enkele plaatsen — die bepaalt de breedte van de deurkast."),
      ]),
      h("div", { class: "measure-tool" }, [renderMeasureTool()]),
    ]));

    // 4. Draairichting
    kids.push(h("section", { class: "guide-sec" }, [
      h("h3", {}, ["4. Draairichting: links of rechts?"]),
      h("p", { class: "gs-intro" }, ["Ga staan aan de kant waar de deur naar je toe opent. Zitten de scharnieren links? Dan is het een linksdraaiende deur. Rechts? Dan rechtsdraaiend."]),
      h("div", { class: "swing-demo" }, [
        swingCard("links", "Linksdraaiend", "Scharnieren links, kruk rechts."),
        swingCard("rechts", "Rechtsdraaiend", "Scharnieren rechts, kruk links."),
      ]),
    ]));

    // 5. FAQ
    kids.push(h("section", { class: "guide-sec" }, [
      h("h3", {}, ["5. Veelgestelde vragen"]),
      faq("Welke deur voor een badkamer of toilet?", "Kies bij voorkeur een vochtbestendige uitvoering en een WC-/vrij-bezetslot. Onze 'te verven' deuren voor hoge modellen gebruiken vochtwerend MDF."),
      faq("Wat betekent 'verdoken scharnieren'?", "De scharnieren zitten onzichtbaar weggewerkt in de deur en kast. Dat geeft een strakke, moderne look zonder zichtbaar beslag."),
      faq("Wat is een magnetisch slot?", "Bij het sluiten trekt een magneet in de sluitplaat de schoot aan. Geen kletterend geluid en een net, vlak resultaat."),
      faq("Moet ik zelf schilderen?", "Alleen bij de 'te verven' deuren. Alle andere afwerkingen (mat, hout, beton, staal-glas) zijn kant-en-klaar afgewerkt."),
      faq("Kan ik plafondhoge deuren krijgen?", "Ja. Met de Loft-lijnen ga je tot 231,5 cm en met Endless Loft tot 300 cm, volledig op maat."),
    ]));

    kids.push(h("div", { class: "guide-cta" }, [
      h("h3", {}, ["Klaar om te kiezen?"]),
      h("button", { class: "btn primary lg", onclick: function () { state.step = 1; goView("config"); } }, ["Start de configurator met advies →"]),
    ]));

    return card("guide", kids);
  }

  function coreCard(name, coreType, desc, pros, cons, sound) {
    return h("div", { class: "core-card" }, [
      h("div", { class: "core-cross", html: coreCrossSVG(coreType) }, []),
      h("h4", {}, [name]),
      h("p", {}, [desc]),
      h("div", { class: "sound-meter" }, [
        h("span", { class: "sm-lbl" }, ["Geluid"]),
        h("div", { class: "sm-bar" }, [h("i", { style: "width:" + (sound * 20) + "%" }, [])]),
      ]),
      h("ul", { class: "pros" }, pros.map(function (p) { return h("li", {}, ["✓ " + p]); })),
      h("ul", { class: "cons" }, cons.map(function (c) { return h("li", {}, ["– " + c]); })),
    ]);
  }
  function coreCrossSVG(type) {
    var s = '<svg viewBox="0 0 120 60">';
    s += '<rect x="2" y="8" width="116" height="44" rx="2" fill="#e9e3d6" stroke="#c9b98f"/>';
    s += '<rect x="8" y="8" width="6" height="44" fill="#c9a25f"/><rect x="106" y="8" width="6" height="44" fill="#c9a25f"/>';
    if (type === "honingraat") {
      for (var x = 20; x < 104; x += 12) for (var y = 12; y < 50; y += 10) s += '<polygon points="' + x + ',' + y + ' ' + (x + 6) + ',' + (y + 3) + ' ' + (x + 6) + ',' + (y + 8) + ' ' + x + ',' + (y + 11) + ' ' + (x - 6) + ',' + (y + 8) + ' ' + (x - 6) + ',' + (y + 3) + '" fill="none" stroke="#d8b98a" stroke-width="0.8"/>';
    } else if (type === "tubespaan") {
      for (var xx = 22; xx < 104; xx += 11) s += '<rect x="' + xx + '" y="12" width="6" height="36" rx="3" fill="#ffffff" stroke="#cbb98a" stroke-width="0.8"/>';
    } else {
      s += '<rect x="18" y="12" width="86" height="36" fill="#d7c4a0"/>';
    }
    s += "</svg>";
    return s;
  }
  function dbRow(place, rec, db, col) {
    return h("div", { class: "db-row" }, [
      h("span", { class: "db-place" }, [place]),
      h("div", { class: "db-track" }, [h("i", { style: "width:" + ((db - 20) / 22 * 100) + "%;background:" + col }, [db + " dB"])]),
      h("span", { class: "db-rec" }, [rec]),
    ]);
  }
  function measureStep(n, ic, t, d) {
    return h("div", { class: "measure-step" }, [
      h("div", { class: "ms-num" }, [n]),
      h("div", { class: "ms-ic" }, [ic]),
      h("strong", {}, [t]),
      h("p", {}, [d]),
    ]);
  }
  // interactieve opmeethulp: muuropening → aanbevolen deurbreedte
  function renderMeasureTool() {
    var wrap = h("div", { class: "mt-inner" }, []);
    function build() {
      wrap.innerHTML = "";
      var opening = state._mtOpening || 830;
      // mapping muuropening → deurbreedte (op basis van catalogus: opening ≈ breedte + ~76mm marge)
      var doorW = Math.round((opening - 76) / 10) * 10;
      var nearest = [630, 680, 730, 780, 830, 880, 930, 980, 1030].reduce(function (a, b) { return Math.abs(b - doorW) < Math.abs(a - doorW) ? b : a; });
      wrap.appendChild(h("label", { class: "mt-lbl" }, ["Muuropening (breedte): " + opening + " mm"]));
      wrap.appendChild(h("input", { type: "range", min: 700, max: 1100, step: 5, value: opening, oninput: function (e) { state._mtOpening = +e.target.value; build(); } }, []));
      wrap.appendChild(h("div", { class: "mt-result" }, [
        h("span", {}, ["Aanbevolen deurbreedte:"]),
        h("strong", {}, [(nearest / 10) + " cm"]),
      ]));
    }
    build();
    return h("div", {}, [h("h4", {}, ["🔧 Snelle opmeethulp"]), wrap, h("p", { class: "mt-note" }, ["Indicatief. De exacte maat hangt af van kast en afwerking — twijfel je? Wij helpen je graag."])]);
  }
  function swingCard(dir, t, d) {
    var left = dir === "links";
    var s = '<svg viewBox="0 0 120 90">';
    s += '<rect x="' + (left ? 18 : 84) + '" y="15" width="4" height="60" fill="#17615f"/>'; // scharnierpaal
    s += '<path d="M' + (left ? 22 : 98) + ',18 ' + (left ? "A56 56 0 0 1 78 74" : "A56 56 0 0 0 22 74") + '" fill="none" stroke="#c9c4ba" stroke-dasharray="3 3"/>';
    s += '<rect x="' + (left ? 22 : 38) + '" y="18" width="60" height="8" rx="2" fill="#8bbf2a" transform="rotate(' + (left ? 28 : -28) + ' ' + (left ? 22 : 98) + ' 22)"/>';
    s += '<circle cx="' + (left ? 84 : 34) + '" cy="70" r="3" fill="#17615f"/>';
    s += "</svg>";
    return h("div", { class: "swing-card" }, [h("div", { class: "sw-svg", html: s }, []), h("strong", {}, [t]), h("small", {}, [d])]);
  }
  function faq(q, a) {
    return h("details", { class: "faq" }, [h("summary", {}, [q]), h("p", {}, [a])]);
  }

  /* ---- init ------------------------------------------------------------- */
  render();
})();
