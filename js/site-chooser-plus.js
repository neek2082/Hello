// Site Chooser Plus: compares warehouse sites on cost, sustainability, governance and labour.
(function () {
  var FACTORS = [
    { key: "cost", name: "Cost", color: "var(--c-cost)" },
    { key: "sus", name: "Sustainability", color: "var(--c-sus)" },
    { key: "gov", name: "Governance", color: "var(--c-gov)" },
    { key: "lab", name: "Labour", color: "var(--c-lab)" }
  ];
  var LISTS = {
    sus: [
      ["Renewable energy available (solar, wind or water power)", "Steadier, lower power bills and less carbon."],
      ["Short trips to suppliers and customers", "Less fuel burned and less carbon per delivery."],
      ["Eco-certified (green) buildings available", "Uses less power and water every month."],
      ["Clear local rules on emissions, waste and water", "Fewer surprise fines; easier to plan ahead."],
      ["Good for the local community (jobs, local suppliers)", "Local support and fewer objections to the warehouse."],
      ["Fits the company’s sustainability goals", "Keeps customers and investors who ask for green results."]
    ],
    gov: [
      ["Stable government and policies", "Plans made today will still work in a few years."],
      ["Quick, clear approval for permits", "The warehouse can open on time."],
      ["Fair, open rules with little corruption", "No hidden payments or unfair treatment."],
      ["Useful incentives (tax breaks, grants, free trade zone)", "Lowers the real cost of setting up."],
      ["Reliable legal protection (contracts, property)", "Disagreements can be settled fairly."],
      ["Reliable public services (power supply, roads kept in good repair)", "Fewer stoppages from outages or bad roads."]
    ],
    lab: [
      ["Enough workers living nearby", "Shifts can be filled, even at busy times."],
      ["Workers with the right skills (forklift, warehouse systems)", "Less training time and fewer mistakes."],
      ["Wages the company can afford", "Running costs stay under control."],
      ["Easy to reach by public transport", "More people can take the job and arrive on time."],
      ["Little competition for workers from nearby employers", "Staff are less likely to leave for another job."],
      ["Training support available (schools, government schemes)", "Easier to build up skills over time."]
    ]
  };
  var PROFILES = [
    { id: "lesson", name: "Lesson example", w: { cost: 60, sus: 40, gov: 0, lab: 0 },
      why: "This matches the scoring example in the lesson, which only compares cost and sustainability." },
    { id: "budget", name: "Low-price furniture seller", w: { cost: 60, sus: 10, gov: 15, lab: 15 },
      why: "Low prices are how it wins customers and it makes little profit on each item, so running cost matters most." },
    { id: "medicine", name: "Medicine distributor", w: { cost: 35, sus: 15, gov: 30, lab: 20 },
      why: "Medicines need licences, inspections and strict rules, so clear and reliable government matters a lot. Trained staff are needed to handle stock safely." },
    { id: "green", name: "Global brand with a net-zero promise", w: { cost: 40, sus: 35, gov: 10, lab: 15 },
      why: "It has promised customers and investors to cut carbon, so a site that makes this hard could cost it contracts and reputation." },
    { id: "online", name: "Online shop fulfilment centre", w: { cost: 40, sus: 10, gov: 10, lab: 40 },
      why: "Orders are picked by hand, with big peaks during sales, so finding enough workers decides whether orders go out on time." }
  ];

  function example() {
    return {
      customers: [{ name: "Dealer A", trips: 52 }, { name: "Dealer B", trips: 72 }, { name: "Dealer C", trips: 69 }],
      sites: [
        { name: "Site 1", dist: [53, 72, 73], area: 30000, rent: 7.20, kwh: 70000, water: 400,
          sus: [1,0,1,0,1,0], gov: [1,1,1,1,1,0], lab: [1,1,1,1,1,0] },
        { name: "Site 2", dist: [84, 84, 47], area: 28000, rent: 7.18, kwh: 70500, water: 402,
          sus: [1,0,1,1,1,0], gov: [1,0,1,0,0,0], lab: [1,1,1,1,0,0] },
        { name: "Site 3", dist: [75, 58, 57], area: 29000, rent: 7.19, kwh: 70100, water: 395,
          sus: [1,1,1,0,1,1], gov: [1,1,1,0,1,0], lab: [1,0,1,1,0,0] }
      ],
      rates: { truck: 0.80, power: 0.40, water: 2.00 },
      w: { cost: 60, sus: 40, gov: 0, lab: 0 },
      profile: "lesson", reasonList: null
    };
  }
  function blank() {
    var s = example();
    s.customers.forEach(function (c) { c.trips = ""; });
    s.sites.forEach(function (site) {
      site.dist = site.dist.map(function () { return ""; });
      site.area = site.rent = site.kwh = site.water = "";
      ["sus", "gov", "lab"].forEach(function (k) { site[k] = [0,0,0,0,0,0]; });
    });
    s.rates = { truck: "", power: "", water: "" };
    return s;
  }

  var state = example();
  var $ = function (id) { return document.getElementById(id); };
  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : 0; }
  function money(n) { return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function round$(n) { return "$" + Math.round(n).toLocaleString("en-US"); }
  function plain(n) { return n.toLocaleString("en-US", { maximumFractionDigits: 2 }); }
  function pts(n) { return (Math.round(n * 100) / 100).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 2 }); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function numInput(id, val, label) {
    return '<input type="number" step="any" min="0" inputmode="decimal" id="' + id + '" value="' + esc(val) + '" aria-label="' + esc(label) + '">';
  }
  function fname(k) { return FACTORS.filter(function (f) { return f.key === k; })[0].name; }

  /* ---------- Build inputs ---------- */
  function buildInputs() {
    var c = state.customers, s = state.sites, h = "<thead><tr><th>Site</th>";
    c.forEach(function (cu, j) {
      h += '<th><div class="th-flex"><input type="text" class="name-input" id="cn' + j + '" value="' + esc(cu.name) + '" aria-label="Customer name">' +
        (c.length > 1 ? '<button type="button" class="x" data-remove="' + j + '" aria-label="Remove ' + esc(cu.name) + '">×</button>' : "") + "</div></th>";
    });
    h += "</tr></thead><tbody>";
    s.forEach(function (site, i) {
      h += '<tr><th><input type="text" class="name-input" id="sn' + i + '" value="' + esc(site.name) + '" aria-label="Site name"></th>';
      c.forEach(function (cu, j) { h += "<td>" + numInput("d" + i + "_" + j, site.dist[j], site.name + " to " + cu.name + " in km") + "</td>"; });
      h += "</tr>";
    });
    h += '<tr class="total-row"><td>Return trips per year <span class="unit">(there and back)</span></td>';
    c.forEach(function (cu, j) { h += "<td>" + numInput("t" + j, cu.trips, "Trips per year to " + cu.name) + "</td>"; });
    h += '</tr></tbody><tfoot><tr><td colspan="' + (c.length + 1) + '" class="unit">Distances are in km, one way.</td></tr></tfoot>';
    $("distTable").innerHTML = h;

    var rows = [["area", "Floor area", "m²"], ["rent", "Rent per m² per month", "$"], ["kwh", "Electricity used per month", "kWh"], ["water", "Water used per month", "m³"]];
    var t = "<thead><tr><th>Need</th>";
    s.forEach(function (site, i) { t += '<th class="num-cell sname" data-i="' + i + '">' + esc(site.name) + "</th>"; });
    t += "</tr></thead><tbody>";
    rows.forEach(function (r) {
      t += "<tr><td>" + r[1] + ' <span class="unit">(' + r[2] + ")</span></td>";
      s.forEach(function (site, i) { t += "<td>" + numInput(r[0] + i, site[r[0]], site.name + " " + r[1]) + "</td>"; });
      t += "</tr>";
    });
    $("siteTable").innerHTML = t + "</tbody>";

    var cl = "";
    ["sus", "gov", "lab"].forEach(function (k) {
      var f = FACTORS.filter(function (x) { return x.key === k; })[0];
      cl += '<h4 class="check-title" style="--c:' + f.color + '"><i></i>' + f.name + '</h4><div class="scroll"><table class="check-table"><thead><tr><th>Point</th>';
      s.forEach(function (site, i) { cl += '<th class="sname" data-i="' + i + '" style="text-align:center">' + esc(site.name) + "</th>"; });
      cl += "</tr></thead><tbody>";
      LISTS[k].forEach(function (item, n) {
        cl += "<tr><td>" + item[0] + '<span class="hint">' + item[1] + "</span></td>";
        s.forEach(function (site, i) {
          cl += '<td><input type="checkbox" id="c_' + k + "_" + i + "_" + n + '"' + (site[k][n] ? " checked" : "") + ' aria-label="' + esc(site.name) + ": " + esc(item[0]) + '"></td>';
        });
        cl += "</tr>";
      });
      cl += '<tr class="total-row"><td>Points</td>';
      s.forEach(function (site, i) { cl += '<td id="p_' + k + "_" + i + '"></td>'; });
      cl += "</tr></tbody></table></div>";
    });
    $("checklists").innerHTML = cl;

    $("rTruck").value = state.rates.truck;
    $("rPower").value = state.rates.power;
    $("rWater").value = state.rates.water;
    buildProfiles();
    buildSliders();
  }

  function buildProfiles() {
    var p = "";
    PROFILES.forEach(function (pr) {
      p += '<label class="profile' + (state.profile === pr.id ? " on" : "") + '"><input type="radio" name="profile" value="' + pr.id + '"' + (state.profile === pr.id ? " checked" : "") + ">" +
        "<b>" + esc(pr.name) + '</b><span class="mix">Cost ' + pr.w.cost + "% · Sustainability " + pr.w.sus + "% · Governance " + pr.w.gov + "% · Labour " + pr.w.lab + "%</span></label>";
    });
    $("profiles").innerHTML = p;
  }
  function buildSliders() {
    var h = "";
    FACTORS.forEach(function (f) {
      h += '<div class="sl" style="--c:' + f.color + '"><label for="w_' + f.key + '"><i></i>' + f.name + '</label>' +
        '<input type="range" id="w_' + f.key + '" min="0" max="100" step="5" value="' + state.w[f.key] + '">' +
        '<output id="o_' + f.key + '" for="w_' + f.key + '">' + state.w[f.key] + "%</output></div>";
    });
    $("sliders").innerHTML = h;
  }
  function syncSliders() {
    FACTORS.forEach(function (f) { $("w_" + f.key).value = state.w[f.key]; $("o_" + f.key).textContent = state.w[f.key] + "%"; });
    document.querySelectorAll(".profile").forEach(function (el) {
      var on = el.querySelector("input").value === state.profile;
      el.classList.toggle("on", on); el.querySelector("input").checked = on;
    });
  }

  /* Share 100% in steps of 5, keeping the proportions as close as possible. */
  function split(raw, total) {
    var keys = Object.keys(raw), sum = keys.reduce(function (a, k) { return a + raw[k]; }, 0);
    var units = Math.round(total / 5), out = {}, used = 0, rem = [];
    keys.forEach(function (k) {
      var exact = sum > 0 ? raw[k] / sum * units : units / keys.length;
      out[k] = Math.floor(exact); used += out[k]; rem.push([k, exact - out[k]]);
    });
    rem.sort(function (a, b) { return b[1] - a[1]; });
    for (var i = 0; used < units; i++, used++) out[rem[i % rem.length][0]]++;
    keys.forEach(function (k) { out[k] *= 5; });
    return out;
  }
  function toHundred(raw) { return split(raw, 100); }
  function moveSlider(key, v) {
    var raw = {};
    FACTORS.forEach(function (f) { if (f.key !== key) raw[f.key] = state.w[f.key]; });
    var w = split(raw, 100 - v);
    w[key] = v;
    state.w = w;
  }

  /* ---------- Calculations ---------- */
  function calc() {
    var c = state.customers, r = state.rates;
    var res = state.sites.map(function (site) {
      var km = 0;
      c.forEach(function (cu, j) { km += num(site.dist[j]) * num(cu.trips); });
      km *= 2;
      var o = { km: km, transport: km * num(r.truck), rent: num(site.area) * num(site.rent) * 12,
        power: num(site.kwh) * num(r.power) * 12, water: num(site.water) * num(r.water) * 12 };
      o.total = o.transport + o.rent + o.power + o.water;
      o.count = {}; o.pts = {};
      ["sus", "gov", "lab"].forEach(function (k) {
        o.count[k] = site[k].filter(Boolean).length;
        o.pts[k] = Math.min(5, o.count[k]);
      });
      return o;
    });
    var totals = res.map(function (x) { return x.total; });
    res.forEach(function (x) {
      var cheaper = totals.filter(function (t) { return t < x.total - 0.005; }).length;
      x.pts.cost = Math.max(0, 5 - 0.5 * cheaper);
    });
    return res;
  }
  function scoreWith(res, w) {
    return res.map(function (x) {
      var parts = {}, total = 0;
      FACTORS.forEach(function (f) { parts[f.key] = x.pts[f.key] * w[f.key] / 100; total += parts[f.key]; });
      return { parts: parts, total: total };
    });
  }
  function leaders(vals) {
    var best = Math.max.apply(null, vals);
    return vals.map(function (v, i) { return Math.abs(v - best) < 1e-9 ? i : -1; }).filter(function (i) { return i >= 0; });
  }
  function names(idx) {
    var n = idx.map(function (i) { return state.sites[i].name; });
    return n.length < 2 ? n[0] : n.slice(0, -1).join(", ") + " and " + n[n.length - 1];
  }
  function costScaled(v) {
    // set cost to v%, other factors keep their share of the rest
    var w = { cost: v }, others = ["sus", "gov", "lab"], sum = 0;
    others.forEach(function (k) { sum += state.w[k]; });
    others.forEach(function (k) { w[k] = sum === 0 ? (100 - v) / 3 : state.w[k] / sum * (100 - v); });
    return w;
  }

  /* ---------- Render ---------- */
  function render() {
    var s = state.sites, res = calc(), w = state.w;
    var filled = res.some(function (x) { return x.total > 0; });
    document.querySelectorAll(".sname").forEach(function (th) { th.textContent = s[+th.dataset.i].name; });

    var minTotal = Math.min.apply(null, res.map(function (x) { return x.total; }));
    var cost = "<thead><tr><th>Site</th><th class='num-cell'>Transport</th><th class='num-cell'>Rent</th><th class='num-cell'>Electricity</th><th class='num-cell'>Water</th><th class='num-cell'>Total per year</th><th class='num-cell'>Cost points</th></tr></thead><tbody>";
    res.forEach(function (x, i) {
      var cheapest = filled && Math.abs(x.total - minTotal) < 0.005;
      cost += "<tr" + (cheapest ? ' class="total-row"' : "") + "><td>" + esc(s[i].name) + (cheapest ? '<span class="badge hide-when-hidden">Cheapest</span>' : "") + "</td>" +
        ["transport", "rent", "power", "water", "total"].map(function (k) { return '<td class="num-cell answer">' + money(x[k]) + "</td>"; }).join("") +
        '<td class="num-cell answer">' + pts(x.pts.cost) + "</td></tr>";
    });
    $("costTable").innerHTML = cost + "</tbody>";

    var c = state.customers, r = state.rates, wk = "";
    res.forEach(function (x, i) {
      var site = s[i];
      var parts = c.map(function (cu, j) { return plain(num(site.dist[j])) + " × " + plain(num(cu.trips)); }).join(" + ");
      wk += "<div><h4>" + esc(site.name) + "</h4>" +
        "<p>Distance: 2 × (" + parts + ") = " + plain(x.km) + " km</p>" +
        "<p>Transport: " + plain(x.km) + " km × " + money(num(r.truck)) + " = " + money(x.transport) + "</p>" +
        "<p>Rent: " + plain(num(site.area)) + " m² × " + money(num(site.rent)) + " × 12 months = " + money(x.rent) + "</p>" +
        "<p>Electricity: " + plain(num(site.kwh)) + " kWh × " + money(num(r.power)) + " × 12 months = " + money(x.power) + "</p>" +
        "<p>Water: " + plain(num(site.water)) + " m³ × " + money(num(r.water)) + " × 12 months = " + money(x.water) + "</p>" +
        "<p><strong>Total: " + money(x.total) + " per year</strong></p></div>";
    });
    $("working").innerHTML = wk + "<p class='unit'>Distances are doubled because each truck makes the trip there and back.</p>";

    res.forEach(function (x, i) {
      ["sus", "gov", "lab"].forEach(function (k) { $("p_" + k + "_" + i).textContent = x.count[k] + " ticked → " + x.pts[k] + " points"; });
    });

    syncSliders();
    $("sumLine").textContent = "Total: " + FACTORS.reduce(function (a, f) { return a + w[f.key]; }, 0) + "%. Moving one slider shares the change across the others.";
    var pr = PROFILES.filter(function (p) { return p.id === state.profile; })[0];
    if (pr) $("reason").innerHTML = "<strong>Why this mix:</strong> " + esc(pr.why);
    else if (state.reasonList) $("reason").innerHTML = "<strong>Why this mix, based on your answers:</strong><ul>" + state.reasonList.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul>";
    else $("reason").innerHTML = "<strong>Your own mix.</strong> Be ready to explain why each factor counts as much as it does for this company.";

    var sc = scoreWith(res, w), top = leaders(sc.map(function (x) { return x.total; }));
    var head = "<thead><tr><th>Site</th>";
    FACTORS.forEach(function (f) { head += "<th class='num-cell'>" + f.name + "<span class='unit'>counts " + w[f.key] + "%</span></th>"; });
    head += "<th class='num-cell'>Total score<span class='unit'>out of 5</span></th></tr></thead><tbody>";
    sc.forEach(function (x, i) {
      var win = filled && top.indexOf(i) >= 0;
      head += "<tr" + (win ? ' class="total-row"' : "") + "><td>" + esc(s[i].name) + (win ? '<span class="badge hide-when-hidden">Best overall</span>' : "") + "</td>";
      FACTORS.forEach(function (f) {
        head += '<td class="num-cell answer">' + pts(res[i].pts[f.key]) + ' <span class="unit">→ ' + pts(x.parts[f.key]) + "</span></td>";
      });
      head += '<td class="num-cell answer">' + pts(x.total) + "</td></tr>";
    });
    $("scoreTable").innerHTML = head + '</tbody><tfoot><tr><td colspan="6" class="unit">Each cell shows points out of 5, then → points after weighting.</td></tr></tfoot>';

    $("legend").innerHTML = FACTORS.map(function (f) { return '<span style="--c:' + f.color + '">' + f.name + "</span>"; }).join("");
    var b = "";
    sc.forEach(function (x, i) {
      b += '<div class="bar-row"><div class="bar-name">' + esc(s[i].name) + '</div><div class="bar-track" role="img" aria-label="' + esc(s[i].name) + " scores " + pts(x.total) + ' out of 5">';
      FACTORS.forEach(function (f) { b += '<div style="--c:' + f.color + ";width:" + (x.parts[f.key] / 5 * 100) + '%"></div>'; });
      b += '</div><div class="bar-val">' + pts(x.total) + "</div></div>";
    });
    b += '<div class="scale"><div></div><div><span>0</span><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span></div><div></div></div>';
    $("bars").innerHTML = b;

    if (!filled) {
      $("winner").innerHTML = '<div class="eyebrow">Result</div><div class="big">Waiting for figures</div><p>Fill in the site details in step 1 to see which site comes out on top.</p>';
      $("insights").innerHTML = "<li>Results appear here once the site details are filled in.</li>";
      $("summary").value = "";
      return;
    }
    var cheap = leaders(res.map(function (x) { return -x.total; }));
    var tie = top.length > 1;
    var winTitle = tie ? "It’s a tie: " + names(top) : names(top);
    var ins = [], lead;

    if (!tie && cheap.length === 1 && cheap[0] === top[0]) {
      lead = names(top) + " is the cheapest site and also scores best once the other factors are counted.";
      ins.push(names(top) + " wins on cost and holds its lead on the other factors, so the choice is clear.");
    } else {
      var wi = top[0], ci = cheap[0];
      var gap = res[wi].total - res[ci].total;
      var best = null;
      FACTORS.forEach(function (f) {
        var d = sc[wi].parts[f.key] - sc[ci].parts[f.key];
        if (f.key !== "cost" && (!best || d > best.d)) best = { k: f.key, d: d };
      });
      lead = "On cost alone, " + names(cheap) + " is the cheapest. Once the other factors are counted, " + winTitle.replace("It’s a tie: ", "") + (tie ? " tie for first place." : " comes out on top.");
      if (!tie) {
        ins.push(names([wi]) + " costs " + round$(gap) + " more per year than " + names([ci]) + ".");
        if (best && best.d > 0) ins.push("It makes up for that mainly through " + fname(best.k).toLowerCase() + ": it earns " + pts(best.d) + " more weighted points there than " + names([ci]) + ".");
      }
    }
    // biggest-mover factor
    var big = FACTORS.slice().sort(function (a, b) { return w[b.key] - w[a.key]; })[0];
    ins.push(big.name + " counts the most here (" + w[big.key] + "%), so it has the biggest say in the result.");
    // tipping point on cost
    var key = top.join(","), change = null;
    for (var step = 1; step <= 20 && change === null; step++) {
      [w.cost + step * 5, w.cost - step * 5].forEach(function (v) {
        if (change !== null || v < 0 || v > 100) return;
        var t = leaders(scoreWith(res, costScaled(v)).map(function (x) { return x.total; }));
        if (t.join(",") !== key) change = { v: v, who: t };
      });
    }
    ins.push(change ? "If cost counted for " + change.v + "% instead (with the other factors sharing the rest in the same proportions), " + names(change.who) + (change.who.length > 1 ? " would tie." : " would win.") :
      "The winner stays the same however much cost counts, so this choice is safe.");
    ins.push("Try the other company types in step 4. A different company can lead to a different site, which is why the weightage has to fit the business.");
    $("insights").innerHTML = ins.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("");

    $("winner").innerHTML = '<div class="eyebrow">Best overall site</div><div class="big">' + esc(winTitle) + "</div><p>" + esc(lead) + "</p>";

    // Recommendation summary
    var why = pr ? pr.why : (state.reasonList ? state.reasonList.join(" ") : "[Explain why each factor counts as much as it does for this company.]");
    var mix = FACTORS.map(function (f) { return f.name.toLowerCase() + " " + w[f.key] + "%"; }).join(", ");
    var txt = "Recommendation: " + (tie ? "the sites " + names(top) + " are tied; a further factor is needed to decide between them." : names(top) + ".") + "\n\n" +
      "How much each factor counts: " + mix + ". " + why + "\n\n" +
      "Scores out of 5: " + sc.map(function (x, i) { return s[i].name + " " + pts(x.total); }).join(", ") + ".\n\n" +
      ins.slice(0, ins.length - 1).join(" ");
    $("summary").value = txt;
  }

  /* ---------- Events ---------- */
  document.addEventListener("input", function (e) {
    var id = e.target.id, v = e.target.value, m;
    if ((m = id.match(/^d(\d+)_(\d+)$/))) state.sites[+m[1]].dist[+m[2]] = v;
    else if ((m = id.match(/^t(\d+)$/))) state.customers[+m[1]].trips = v;
    else if ((m = id.match(/^cn(\d+)$/))) state.customers[+m[1]].name = v;
    else if ((m = id.match(/^sn(\d+)$/))) state.sites[+m[1]].name = v || "Site " + (+m[1] + 1);
    else if ((m = id.match(/^(area|rent|kwh|water)(\d+)$/))) state.sites[+m[2]][m[1]] = v;
    else if ((m = id.match(/^c_(sus|gov|lab)_(\d+)_(\d+)$/))) state.sites[+m[2]][m[1]][+m[3]] = e.target.checked ? 1 : 0;
    else if (id === "rTruck") state.rates.truck = v;
    else if (id === "rPower") state.rates.power = v;
    else if (id === "rWater") state.rates.water = v;
    else if ((m = id.match(/^w_(\w+)$/))) { moveSlider(m[1], +v); state.profile = null; state.reasonList = null; }
    else if (e.target.name === "profile") {
      var p = PROFILES.filter(function (x) { return x.id === v; })[0];
      state.w = Object.assign({}, p.w); state.profile = p.id; state.reasonList = null;
    }
    else return;
    render();
  });
  document.addEventListener("change", function (e) {
    if (e.target.type === "checkbox" || e.target.type === "radio") e.target.dispatchEvent(new Event("input", { bubbles: true }));
  });

  $("btnSuggest").addEventListener("click", function () {
    var a = [+$("q1").value, +$("q2").value, +$("q3").value, +$("q4").value];
    var raw = { cost: [0, 2, 4, 6][a[0]], sus: [0, 1, 2, 4][a[1]], gov: [0, 1, 2, 4][a[2]], lab: [0, 1, 2, 4][a[3]] };
    state.w = toHundred(raw); state.profile = null;
    state.reasonList = [
      ["", "The budget is flexible, so cost counts less than usual.", "The budget is normal, so cost still counts for a good share.", "The budget is very tight, so cost counts the most."][a[0]],
      ["", "Customers rarely ask for green targets, so sustainability counts a little.", "Green targets come up sometimes, so sustainability counts a fair amount.", "Green targets are in contracts or promises, so sustainability counts a lot."][a[1]],
      ["", "The goods need no special permits, so governance counts a little.", "Some rules and permits apply, so governance counts a fair amount.", "Strict rules and permits apply, so clear, reliable government counts a lot."][a[2]],
      ["", "Machines do most of the work, so labour counts a little.", "A fair number of workers are needed, so labour counts a fair amount.", "Most picking is done by hand, so finding workers counts a lot."][a[3]]
    ];
    render();
  });

  $("distTable").addEventListener("click", function (e) {
    var j = e.target.getAttribute("data-remove");
    if (j === null) return;
    state.customers.splice(+j, 1);
    state.sites.forEach(function (s) { s.dist.splice(+j, 1); });
    buildInputs(); render();
  });
  $("btnAddCust").addEventListener("click", function () {
    if (state.customers.length >= 8) return;
    state.customers.push({ name: "Customer " + String.fromCharCode(65 + state.customers.length), trips: "" });
    state.sites.forEach(function (s) { s.dist.push(""); });
    buildInputs(); render();
  });
  $("btnExample").addEventListener("click", function () {
    state = example(); buildInputs(); render();
    $("notice").textContent = "The lesson example is loaded. Governance and labour ticks are sample answers for practice.";
  });
  $("btnClear").addEventListener("click", function () {
    var keepW = state.w, keepP = state.profile, keepR = state.reasonList;
    state = blank(); state.w = keepW; state.profile = keepP; state.reasonList = keepR;
    buildInputs(); render();
    $("notice").textContent = "All figures and ticks are cleared. Type in the details for your exercise in step 1.";
  });
  $("btnHide").addEventListener("click", function () {
    var on = document.body.classList.toggle("hide-answers");
    this.textContent = on ? "Show answers" : "Hide answers";
  });
  $("btnWorking").addEventListener("click", function () {
    var box = $("working"); box.hidden = !box.hidden;
    this.textContent = box.hidden ? "Show how it was worked out" : "Hide the working";
  });
  $("btnCopy").addEventListener("click", function () {
    var ta = $("summary"), done = function () { $("copied").textContent = "Copied"; setTimeout(function () { $("copied").textContent = ""; }, 2000); };
    try {
      navigator.clipboard.writeText(ta.value).then(done, function () { ta.select(); $("copied").textContent = "Text selected. Press Ctrl+C (or Cmd+C) to copy."; });
    } catch (err) { ta.select(); $("copied").textContent = "Text selected. Press Ctrl+C (or Cmd+C) to copy."; }
  });

  buildInputs();
  render();
})();
