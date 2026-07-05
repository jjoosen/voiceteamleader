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

  /* ---- state ------------------------------------------------------------ */
  var state = {
    step: 0,
    audience: "gezin", // gezin (particulier) | aannemer (vakman)
    advice: {},        // antwoorden adviesmotor
    lineId: null,
    finishId: null,
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
  function calcUnit(line) {
    return calcLeaf(line) + calcFrame(line) + calcHandle() + calcLock();
  }
  function calcTotal(line) {
    return calcUnit(line) * state.qty + calcExtras();
  }

  /* ====================================================================== *
   *  RENDERING
   * ====================================================================== */
  var app = $("#app");

  function render() {
    var steps = [renderIntro, renderAdvice, renderLine, renderFinish, renderModel,
                 renderSize, renderHardware, renderExtras, renderResult];
    app.innerHTML = "";
    var content = steps[state.step]();
    // stappen met live preview naast de configuratie (afwerking t/m extra's)
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
    renderModeSwitch();
    updateSummary();
    window.scrollTo({ top: 0, behavior: "smooth" });
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
    var fg = finishById(state.finishId);
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
      return h("div", {
        class: "line-card" + (state.lineId === line.id ? " sel" : "") + (isBest ? " best" : ""),
        onclick: function () { selectLine(line.id); },
      }, [
        isBest ? h("div", { class: "ribbon" }, ["Aanbevolen"]) : null,
        h("div", { class: "line-badge" }, [line.badge]),
        h("h3", {}, [line.name]),
        h("p", {}, [line.tagline]),
        h("div", { class: "line-meta" }, [
          h("span", {}, ["vanaf " + euro(priceFrom)]),
          line.invisible ? h("span", { class: "tag" }, ["verdoken"]) : null,
          line.attrs.maxHeight >= 300 ? h("span", { class: "tag" }, ["tot 300cm"]) :
            line.attrs.maxHeight >= 231 ? h("span", { class: "tag" }, ["tot 231cm"]) : null,
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

  function selectLine(id) {
    if (state.lineId === id) return;
    var line = lineById(id);
    state.lineId = id;
    // reset afhankelijke keuzes naar zinnige defaults
    state.finishId = firstFinishOf(line);
    state.coreId = line.cores[0].id;
    state.modelId = line.models[0];
    state.height = line.heights ? line.heights[0] : null;
    state.customHeight = line.customHeight ? line.customHeight.min : null;
    state.width = line.widths[Math.min(2, line.widths.length - 1)];
    state.swing = line.swings ? line.swings[0].id : null;
    state.glassId = line.glassOptions ? line.glassOptions[0].id : null;
    state.frameOptId = line.frame.options ? line.frame.options[0].id : null;
    // default kruk passend bij afwerking
    state.handleId = defaultHandle(line);
    render();
  }
  function defaultHandle(line) {
    if (line.handleType === "greep") return "steel-02-black";
    return "milano-inox";
  }

  /* ---- STAP 3 : afwerking ---------------------------------------------- */
  function renderFinish() {
    var line = lineById(state.lineId);
    var kids = [h("h2", {}, ["Kies je afwerking"]), h("p", { class: "sub" }, [line.name])];

    line.finishGroups.forEach(function (gid) {
      var grp = C.finishGroups.filter(function (g) { return g.id === gid; })[0];
      if (!grp) return;
      var finishes = grp.finishes.filter(function (f) {
        return !line.finishFilter || line.finishFilter.indexOf(f.id) >= 0;
      });
      if (!finishes.length) return;
      kids.push(h("div", { class: "finish-group" }, [
        h("h3", {}, [grp.name]),
        h("p", { class: "grp-blurb" }, [grp.blurb]),
        h("div", { class: "swatch-grid" }, finishes.map(function (f) {
          return h("button", {
            class: "swatch" + (state.finishId === f.id ? " sel" : ""),
            onclick: function () { state.finishId = f.id; render(); },
          }, [
            h("span", { class: "chip", style: "background:" + f.swatch }, []),
            h("span", { class: "sw-name" }, [f.name]),
          ]);
        })),
      ]));
    });

    // core (indien meerdere)
    if (line.cores.length > 1) {
      kids.push(h("div", { class: "finish-group" }, [
        h("h3", {}, ["Deurkern"]),
        h("div", { class: "opt-grid" }, line.cores.map(function (c) {
          return h("button", {
            class: "opt" + (state.coreId === c.id ? " sel" : ""),
            onclick: function () { state.coreId = c.id; render(); },
          }, [h("strong", {}, [c.name]), h("br"), h("small", {}, [c.desc])]);
        })),
      ]));
    }

    kids.push(btnRow([backBtn(), nextBtn("Volgende →", function () { state.step = 4; render(); }, !state.finishId)]));
    return card("", kids);
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
    var fg = finishById(state.finishId);
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

    // offerteformulier
    kids.push(h("div", { class: "quote-box", id: "quote" }, [
      h("h3", {}, ["Vraag je vrijblijvende offerte aan"]),
      h("div", { class: "form-grid" }, [
        field("naam", "Naam", "text", true),
        field("email", "E-mail", "email", true),
        field("tel", "Telefoon", "tel", false),
        field("postcode", "Postcode", "text", false),
      ]),
      h("textarea", { id: "f-bericht", placeholder: "Extra info of vraag (optioneel)", rows: "3" }, []),
      h("label", { class: "chk" }, [h("input", { type: "checkbox", id: "f-akkoord" }), h("span", {}, [" Ik ga akkoord dat mijn gegevens gebruikt worden om deze aanvraag te behandelen."])]),
      h("div", { class: "quote-actions" }, [
        h("button", { class: "btn primary lg", onclick: submitQuote }, ["Verstuur offerte-aanvraag"]),
        h("button", { class: "btn ghost", onclick: function () { window.print(); } }, ["🖨 Print / bewaar als PDF"]),
        h("button", { class: "btn ghost", onclick: function () { state.step = 0; render(); } }, ["↻ Opnieuw beginnen"]),
      ]),
      h("div", { id: "quote-msg", class: "quote-msg" }, []),
    ]));

    return card("", kids);
  }

  function field(id, label, type, req) {
    return h("div", { class: "field" }, [
      h("label", {}, [label + (req ? " *" : "")]),
      h("input", { id: "f-" + id, type: type }, []),
    ]);
  }
  function specRow(k, v) { return h("div", { class: "spec-row" }, [h("span", { class: "k" }, [k]), h("span", { class: "v" }, [v])]); }
  function priceLine(k, v) { return h("div", { class: "pl" }, [h("span", {}, [k]), h("span", {}, [euro(v)])]); }

  // grote deur-preview
  function bigDoor(line, fg) {
    var m = C.models[state.modelId];
    var color = fg ? fg.finish.swatch : "#eee";
    var frameCol = "#d8d3c8";
    if (line.frame.options && state.frameOptId) {
      var fo = state.frameOptId;
      frameCol = fo === "black-mat" ? "#1c1c1e" : fo.indexOf("oak") >= 0 ? "#c49a5f" : "#e7e3da";
    }
    var handleLeft = state.hinge === "links"; // kruk aan tegenovergestelde zijde
    var svg = '<svg viewBox="0 0 200 400" class="big-svg" preserveAspectRatio="xMidYMid meet">';
    svg += '<rect x="6" y="4" width="188" height="392" rx="3" fill="' + frameCol + '"/>';
    svg += '<rect x="16" y="12" width="168" height="376" rx="2" fill="' + (fg && fg.finish.swatch.indexOf("gradient") >= 0 ? "#ccc" : color) + '"/>';
    // gradient fill via foreignless: use pattern fallback → fill rect with css handled outside; here approximate
    if (fg && fg.finish.swatch.indexOf("gradient") >= 0) {
      svg += '<rect x="16" y="12" width="168" height="376" rx="2" fill="url(#wood)"/>';
      svg += '<defs><linearGradient id="wood" x1="0" y1="0" x2="1" y2="0">' + gradStops(fg.finish.swatch) + '</linearGradient></defs>';
    }
    if (m.glass && m.grid) {
      var cols = m.grid[0], rows = m.grid[1];
      var x0 = 26, y0 = 22, gw2 = 148 / cols, gh2 = 356 / rows;
      svg += '<rect x="' + x0 + '" y="' + y0 + '" width="148" height="356" fill="#cfe0e6" opacity="0.8" stroke="#222" stroke-width="4"/>';
      for (var c = 1; c < cols; c++) svg += '<line x1="' + (x0 + c * gw2) + '" y1="' + y0 + '" x2="' + (x0 + c * gw2) + '" y2="' + (y0 + 356) + '" stroke="#222" stroke-width="4"/>';
      for (var r = 1; r < rows; r++) svg += '<line x1="' + x0 + '" y1="' + (y0 + r * gh2) + '" x2="' + (x0 + 148) + '" y2="' + (y0 + r * gh2) + '" stroke="#222" stroke-width="4"/>';
    } else if (m.lines) {
      for (var i = 0; i < m.lines; i++) {
        if (m.orient === "h") {
          var yy = 70 + i * (260 / Math.max(1, m.lines));
          svg += '<line x1="30" y1="' + yy + '" x2="170" y2="' + yy + '" stroke="rgba(0,0,0,.18)" stroke-width="2"/>';
        } else {
          var xx = 50 + i * (100 / Math.max(1, m.lines));
          svg += '<line x1="' + xx + '" y1="24" x2="' + xx + '" y2="376" stroke="rgba(0,0,0,.18)" stroke-width="2"/>';
        }
      }
    }
    // kruk
    var hx = handleLeft ? 30 : 170;
    var isGreep = line.handleType === "greep";
    if (state.handleId !== "geen") {
      if (isGreep) svg += '<rect x="' + (hx - 3) + '" y="150" width="6" height="90" rx="3" fill="#2a2a2a"/>';
      else svg += '<rect x="' + (handleLeft ? hx : hx - 22) + '" y="205" width="22" height="6" rx="3" fill="#8a8378"/>';
    }
    svg += "</svg>";
    return h("div", { class: "door-shell", html: svg });
  }
  function gradStops(g) {
    var m = g.match(/#[0-9a-fA-F]{3,6}/g) || ["#ccc", "#bbb"];
    return '<stop offset="0%" stop-color="' + m[0] + '"/><stop offset="100%" stop-color="' + (m[1] || m[0]) + '"/>';
  }

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
    var fg = finishById(state.finishId);
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
    var fg = finishById(state.finishId);
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

  /* ---- init ------------------------------------------------------------- */
  render();
})();
