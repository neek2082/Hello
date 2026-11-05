// Warehouse Site Selector: compare 3 sites by yearly cost and 5 other factors the user chooses.
// Cost points = lowest cost ÷ this site's cost × 5. Other-factor points = ratings weighted by importance.
// Total = cost points × cost % + other-factor points × other %.

(function () {
  var SITE_COUNT = 3, FACTOR_COUNT = 5;

  // Ideas students can tap to fill a factor box.
  var IDEAS = [
    "Educated workforce", "Stable government", "Government incentives", "Renewable energy",
    "Transport carbon footprint", "Near customers", "Near port / airport", "Good roads & utilities",
    "Low flood / disaster risk", "Effect on the community", "Green building", "Room to expand"
  ];

  var LEVELS = ["", "Low", "Some", "Medium", "High", "Critical"];
  var RATING_WORDS = ["", "Poor", "Weak", "Fair", "Good", "Excellent"];

  // Built-in suggestion rules: words to look for in a factor's name → suggested level and a reason.
  // The first rule that matches wins, so the order matters.
  var RULES = [
    { words: ["stable", "stability", "political", "corruption", "law and order", "safety", "security"], level: 5,
      why: "If the government or safety situation changes, the warehouse could be forced to close. This is very hard to fix later." },
    { words: ["flood", "disaster", "earthquake", "risk", "climate", "weather"], level: 4,
      why: "One flood or disaster can stop the whole operation, so this risk matters a lot." },
    { words: ["workforce", "worker", "labour", "labor", "staff", "skill", "educated", "talent", "manpower", "hire"], level: 4,
      why: "A warehouse needs reliable, trained people every day. Without them, nothing moves." },
    { words: ["customer", "market", "near", "proximity", "distance", "seaport", "harbour", "harbor", "airport", "rail", "road", "highway", "access", "location"], level: 4,
      why: "Being close to customers and transport links means faster delivery and lower costs every day." },
    { words: ["infrastructure", "utilit", "power", "electric", "water", "internet"], level: 4,
      why: "The site needs dependable power, water and connections to run every day." },
    { words: ["incentive", "grant", "subsid", "tax", "rebate", "support"], level: 3,
      why: "Helpful money or tax savings, but they can end after a few years." },
    { words: ["carbon", "emission", "fuel"], level: 3,
      why: "Lower transport emissions help the environment and often cut fuel costs too." },
    { words: ["renewable", "solar", "energy", "green power"], level: 3,
      why: "Good for the environment and reputation, and can lower power bills over time." },
    { words: ["community", "social", "neighbour", "neighbor", "local job", "noise", "traffic"], level: 3,
      why: "Good relations with neighbours avoid complaints and delays." },
    { words: ["policy", "regulation", "rules", "permit", "zoning", "law"], level: 3,
      why: "Clear, friendly rules make it easier to build and run the site." },
    { words: ["expand", "growth", "space", "future"], level: 3,
      why: "Room to grow saves the cost of moving again later." },
    { words: ["green building", "certif", "insulation", "rainwater", "building"], level: 2,
      why: "Nice to have, but usually easier to add or upgrade later than other factors." }
  ];
  function suggestFor(name) {
    var n = name.toLowerCase();
    if (!n.trim()) return null;
    for (var r = 0; r < RULES.length; r++) {
      for (var w = 0; w < RULES[r].words.length; w++) {
        if (n.indexOf(RULES[r].words[w]) >= 0) return { level: RULES[r].level, why: RULES[r].why };
      }
    }
    return { level: 3, why: "No built-in advice for this one, so it starts at Medium. Decide for yourself if it should be higher or lower." };
  }

  var factors, importance, reasons, sites;
  function freshState() {
    factors = [];
    importance = [];
    reasons = [];
    for (var k = 0; k < FACTOR_COUNT; k++) { factors.push(""); importance.push(3); reasons.push(""); }
    sites = [];
    for (var i = 0; i < SITE_COUNT; i++) {
      sites.push({ name: "Site " + (i + 1), cost: "", ratings: ["", "", "", "", ""] });
    }
  }
  freshState();

  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function fmtMoney(n) { return "$" + Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 }); }
  function fmt(n) { return (Math.round(n * 100) / 100).toFixed(2); }
  function pct(x) { return (Math.round(x * 1000) / 10) + "%"; }
  function siteName(i) { return sites[i].name.trim() || "Site " + (i + 1); }
  function factorName(k) { return factors[k].trim() || "Factor " + (k + 1); }
  function weightsPct() {
    var tot = importance.reduce(function (a, b) { return a + b; }, 0);
    return importance.map(function (v) { return v / tot; });
  }

  /* ---------- Build inputs ---------- */
  function buildCostInputs() {
    $("costInputs").innerHTML = sites.map(function (s, i) {
      return '<div class="site-box">' +
        '<label for="sn' + i + '">Site name</label>' +
        '<input type="text" class="name-input" id="sn' + i + '" data-i="' + i + '" data-f="name" value="' + esc(s.name) + '">' +
        '<label for="sc' + i + '">Total yearly cost ($)</label>' +
        '<input type="number" min="0" step="any" inputmode="decimal" id="sc' + i + '" data-i="' + i + '" data-f="cost" placeholder="e.g. 250000" value="' + esc(s.cost) + '">' +
        '<div class="score-line">Cost points: <b id="costScore' + i + '">–</b></div>' +
        "</div>";
    }).join("");
  }

  function buildIdeaChips() {
    var used = factors.map(function (f) { return f.trim().toLowerCase(); });
    $("ideaChips").innerHTML = IDEAS.map(function (idea) {
      var isUsed = used.indexOf(idea.toLowerCase()) >= 0;
      return '<button type="button" class="chip' + (isUsed ? " used" : "") + '" data-idea="' + esc(idea) + '"' +
        (isUsed ? ' aria-disabled="true"' : "") + ">" + (isUsed ? "✓ " : "+ ") + esc(idea) + "</button>";
    }).join("");
  }

  function buildFactorInputs() {
    $("factorInputs").innerHTML = factors.map(function (f, k) {
      return '<label>Factor ' + (k + 1) +
        '<span class="field-row"><input type="text" data-k="' + k + '" data-f="factor" value="' + esc(f) + '" placeholder="Type or tap an idea" aria-label="Factor ' + (k + 1) + '">' +
        (f ? '<button type="button" class="clear-x" data-clear="' + k + '" aria-label="Clear factor ' + (k + 1) + '">×</button>' : "") +
        "</span></label>";
    }).join("");
  }

  function buildImportanceRows() {
    $("importanceRows").innerHTML = factors.map(function (f, k) {
      var btns = "";
      for (var v = 1; v <= 5; v++) {
        btns += '<button type="button" class="level" data-imp="' + k + '" data-v="' + v + '" aria-pressed="' + (importance[k] === v) + '">' + LEVELS[v] + "</button>";
      }
      return '<div class="imp-row"><div class="imp-top">' +
        '<div class="imp-name" id="iname' + k + '">' + esc(factorName(k)) + "</div>" +
        '<div class="levels" role="group" aria-label="Importance of ' + esc(factorName(k)) + '">' + btns + "</div>" +
        '<div class="imp-pct" id="ipct' + k + '"></div></div>' +
        '<p class="why" id="iwhy' + k + '"' + (reasons[k] ? "" : " hidden") + ">Tip: " + esc(reasons[k]) + "</p></div>";
    }).join("");
  }

  function buildRatingTable() {
    $("ratingBody").innerHTML = factors.map(function (f, k) {
      var cells = sites.map(function (s, i) {
        var opts = '<option value="">–</option>';
        for (var n = 5; n >= 1; n--) {
          opts += '<option value="' + n + '"' + (String(s.ratings[k]) === String(n) ? " selected" : "") + ">" + n + " · " + RATING_WORDS[n] + "</option>";
        }
        return '<td><select data-i="' + i + '" data-k="' + k + '" data-f="rating" aria-label="' + esc(siteName(i)) + " rating for " + esc(factorName(k)) + '">' + opts + "</select></td>";
      }).join("");
      return '<tr><td id="fname' + k + '">' + esc(factorName(k)) + '</td><td id="fpct' + k + '"></td>' + cells + "</tr>";
    }).join("");
  }

  /* ---------- Calculate ---------- */
  function costScores() {
    var vals = sites.map(function (s) { return s.cost === "" ? null : Number(s.cost); });
    var ok = function (v) { return v !== null && isFinite(v) && v > 0; };
    var filled = vals.filter(ok);
    if (!filled.length) return vals.map(function () { return null; });
    var min = Math.min.apply(null, filled);
    return vals.map(function (v) { return ok(v) ? (min / v) * 5 : null; });
  }

  function otherScore(i, wp) {
    var r = sites[i].ratings;
    if (r.some(function (x) { return x === ""; })) return null;
    return r.reduce(function (sum, x, k) { return sum + Number(x) * wp[k]; }, 0);
  }

  function update() {
    var w = Number($("weight").value) / 100;
    $("econPct").textContent = Math.round(w * 100);
    $("otherPct").textContent = Math.round((1 - w) * 100);
    $("econBar").style.width = (w * 100) + "%";
    $("otherBar").style.width = ((1 - w) * 100) + "%";

    var wp = weightsPct();
    factors.forEach(function (_, k) {
      $("ipct" + k).textContent = pct(wp[k]);
      $("fpct" + k).textContent = LEVELS[importance[k]] + " · " + pct(wp[k]);
      $("iname" + k).textContent = factorName(k);
      $("fname" + k).textContent = factorName(k);
    });
    var top = wp.indexOf(Math.max.apply(null, wp));
    var allSame = wp.every(function (x) { return Math.abs(x - wp[0]) < 1e-9; });
    $("importanceNote").textContent = allSame
      ? "All factors are equally important right now (20% each)."
      : "Most important: " + factorName(top) + " (" + pct(wp[top]) + " of the other-factor points).";

    var cs = costScores();
    var missingCost = cs.filter(function (c) { return c === null; }).length;
    $("costNote").textContent = missingCost
      ? "Fill in all " + SITE_COUNT + " costs to see the full comparison (" + missingCost + " still empty)."
      : "All costs entered. Points are worked out automatically.";

    var os = sites.map(function (_, i) { return otherScore(i, wp); });
    sites.forEach(function (s, i) {
      $("costScore" + i).textContent = cs[i] === null ? "–" : fmt(cs[i]);
      $("avg" + i).textContent = os[i] === null ? "Rate all 5" : fmt(os[i]);
      document.querySelectorAll(".site-col-" + i).forEach(function (el) { el.textContent = siteName(i); });
    });

    var rows = sites.map(function (s, i) {
      var we = cs[i] === null ? null : cs[i] * w;
      var ws = os[i] === null ? null : os[i] * (1 - w);
      return { i: i, name: siteName(i), cost: s.cost, c: cs[i], we: we, o: os[i], ws: ws,
        total: (we === null || ws === null) ? null : we + ws };
    });

    var complete = rows.every(function (r) { return r.total !== null; });
    var best = complete ? Math.max.apply(null, rows.map(function (r) { return r.total; })) : null;
    var winners = complete ? rows.filter(function (r) { return Math.abs(r.total - best) < 1e-9; }) : [];
    var dash = function (v) { return v === null ? "–" : fmt(v); };

    $("resultsBody").innerHTML = rows.map(function (r) {
      var win = winners.indexOf(r) >= 0;
      return "<tr" + (win ? ' class="winner-row"' : "") + "><td>" + (win ? "🏆 " : "") + esc(r.name) + "</td>" +
        "<td>" + (r.cost === "" ? "–" : fmtMoney(r.cost)) + "</td>" +
        "<td>" + dash(r.c) + "</td><td>" + dash(r.we) + "</td><td>" + dash(r.o) + "</td><td>" + dash(r.ws) + "</td>" +
        "<td><b>" + dash(r.total) + "</b></td></tr>";
    }).join("");

    var box = $("winnerBox");
    if (!complete) {
      var needRatings = os.some(function (g) { return g === null; });
      box.className = "winner waiting";
      box.innerHTML = "<p>To see the winner, " + [
        missingCost ? "enter the yearly cost for all three sites" : "",
        needRatings ? "rate every site on all 5 factors in step 3c" : ""
      ].filter(Boolean).join(" and ") + ".</p>";
    } else if (winners.length > 1) {
      box.className = "winner";
      box.innerHTML = '<div class="eyebrow">It’s a tie</div><div class="big">' +
        winners.map(function (r) { return esc(r.name); }).join(" and ") + " — " + fmt(best) + " / 5</div>" +
        "<p>Try moving the slider in step 1, or review your importance levels, to break the tie.</p>";
    } else {
      var r = winners[0];
      var sorted = rows.slice().sort(function (a, b) { return b.total - a.total; });
      var gap = sorted[0].total - sorted[1].total;
      var reason = r.we >= r.ws ? "mainly thanks to its lower cost" : "mainly thanks to its strength on the other factors";
      var bestK = 0, bestV = -1;
      sites[r.i].ratings.forEach(function (x, k) { var v = Number(x) * wp[k]; if (v > bestV) { bestV = v; bestK = k; } });
      box.className = "winner";
      box.innerHTML = '<div class="eyebrow">Recommended site</div>' +
        '<div class="big">🏆 ' + esc(r.name) + " wins with " + fmt(r.total) + " out of 5</div>" +
        "<p>It is " + fmt(gap) + " points ahead of " + esc(sorted[1].name) + ", " + reason +
        ". Its biggest strength among the other factors is <b>" + esc(factorName(bestK)) + "</b>.</p>";
    }
  }

  function rebuild() {
    buildCostInputs(); buildIdeaChips(); buildFactorInputs();
    buildImportanceRows(); buildRatingTable(); update();
  }

  /* ---------- Events ---------- */
  document.addEventListener("input", function (e) {
    var t = e.target, f = t.getAttribute("data-f");
    if (t.id === "weight") { update(); return; }
    if (f === "name") sites[+t.dataset.i].name = t.value;
    else if (f === "cost") sites[+t.dataset.i].cost = t.value;
    else if (f === "factor") {
      var k = +t.dataset.k;
      factors[k] = t.value; reasons[k] = "";
      $("iwhy" + k).hidden = true;
      buildIdeaChips();
    } else return;
    update();
  });

  document.addEventListener("change", function (e) {
    var t = e.target, f = t.getAttribute("data-f");
    if (f === "factor") { rebuild(); return; } // redraws the clear (×) buttons and table labels
    if (f !== "rating") return;
    sites[+t.dataset.i].ratings[+t.dataset.k] = t.value;
    update();
  });

  document.addEventListener("click", function (e) {
    var t = e.target.closest("button");
    if (!t) return;
    if (t.dataset.idea && !t.classList.contains("used")) {
      var k = factors.findIndex(function (f) { return !f.trim(); });
      if (k === -1) { $("factorNote").textContent = "All 5 boxes are full. Clear one (×) to add this idea."; return; }
      $("factorNote").textContent = "";
      factors[k] = t.dataset.idea;
      rebuild();
    } else if (t.dataset.clear !== undefined) {
      var c = +t.dataset.clear;
      factors[c] = ""; reasons[c] = ""; importance[c] = 3;
      sites.forEach(function (s) { s.ratings[c] = ""; });
      $("factorNote").textContent = "";
      rebuild();
    } else if (t.dataset.imp !== undefined) {
      importance[+t.dataset.imp] = +t.dataset.v;
      buildImportanceRows(); update();
    }
  });

  $("suggestBtn").addEventListener("click", function () {
    if (factors.every(function (f) { return !f.trim(); })) {
      $("importanceNote").textContent = "Type or pick your factors in step 3a first.";
      return;
    }
    factors.forEach(function (f, k) {
      var s = suggestFor(f);
      if (s) { importance[k] = s.level; reasons[k] = s.why; }
    });
    buildImportanceRows(); update();
  });

  $("resetWeight").addEventListener("click", function () { $("weight").value = 60; update(); });

  $("example").addEventListener("click", function () {
    factors = ["Educated workforce", "Stable government", "Government incentives", "Renewable energy", "Transport carbon footprint"];
    factors.forEach(function (f, k) { var s = suggestFor(f); importance[k] = s.level; reasons[k] = s.why; });
    var ex = [
      { cost: 420000, ratings: [4, 5, 3, 4, 3] },
      { cost: 365000, ratings: [3, 3, 4, 2, 3] },
      { cost: 480000, ratings: [5, 4, 5, 5, 4] }
    ];
    ex.forEach(function (x, i) {
      sites[i].name = "Site " + (i + 1);
      sites[i].cost = String(x.cost);
      sites[i].ratings = x.ratings.map(String);
    });
    $("weight").value = 60;
    $("factorNote").textContent = "";
    rebuild();
  });

  $("clear").addEventListener("click", function () {
    freshState();
    $("weight").value = 60;
    $("factorNote").textContent = "";
    rebuild();
  });

  rebuild();
})();
