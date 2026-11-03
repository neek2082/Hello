// Warehouse Practice (WMS): students run a shared practice warehouse like a real warehouse management system.
// A lecturer starts a class for set lesson days; students join with the class code and are given
// a warehouse (6 students each) and a place (1–6), which decides their 3 purchase orders and 3 sales orders.
// Each student receives and puts away every purchase-order line, picks every sales-order line, then packs and
// ships each sales order. Data lives in the WMS's own Firebase Realtime Database, reached with plain web requests.
(function () {
  // Address of the WMS's own Firebase Realtime Database (project "my-second-project-72735", Singapore).
  var DB_URL = "https://my-second-project-72735-default-rtdb.asia-southeast1.firebasedatabase.app";

  var MAX_WAREHOUSES = 5;
  var PLACES = 6;       // students per warehouse
  var MAX_DAYS = 14;    // longest lesson window a class can have (the database rules check this too)
  var CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  var SAVE_KEY = "wmsClass";
  var DAY = 24 * 60 * 60 * 1000;

  /* ---------- Lesson data: edit these lists to change the products and orders ---------- */

  // The product catalogue. Each product lives in one bin (aisle-rack-level, e.g. A-02-1).
  // "start" is how many cartons are in that bin before anyone works.
  var SKUS = [
    { code: "BEV-101", name: "Mineral water 1.5L, 12-pack", bin: "A-01-1", start: 8 },
    { code: "BEV-102", name: "Green tea 500ml, 24-pack", bin: "A-01-2", start: 12 },
    { code: "BEV-103", name: "Orange juice 1L, 12-pack", bin: "A-02-1", start: 20 },
    { code: "SNK-201", name: "Potato chips 150g, 20-pack", bin: "B-01-1", start: 10 },
    { code: "SNK-202", name: "Chocolate bar 45g, 48-pack", bin: "B-01-2", start: 26 },
    { code: "SNK-203", name: "Rice crackers 100g, 24-pack", bin: "B-02-1", start: 6 },
    { code: "GRO-301", name: "Instant noodles, 30-pack", bin: "C-01-1", start: 35 },
    { code: "GRO-302", name: "Jasmine rice 5kg, 4-bag", bin: "C-01-2", start: 6 },
    { code: "GRO-303", name: "Cooking oil 2L, 6-pack", bin: "C-02-1", start: 35 },
    { code: "HOU-401", name: "Tissue box, 10-pack", bin: "D-01-1", start: 6 },
    { code: "HOU-402", name: "Dish soap 750ml, 12-pack", bin: "D-01-2", start: 6 }
  ];

  // ORDER_SETS[0] is for place 1 in every warehouse, ORDER_SETS[1] for place 2, and so on.
  // "in" = purchase order (goods arriving from a supplier), "out" = sales order (goods going to a store).
  // Each line is [SKU code, quantity].
  var ORDER_SETS = [
    [
      { id: "PO-1011", type: "in", partner: "FreshCo Beverages", lines: [["SNK-203", 8], ["BEV-103", 12]] },
      { id: "PO-1012", type: "in", partner: "Golden Grains", lines: [["BEV-101", 10], ["BEV-102", 4]] },
      { id: "PO-1013", type: "in", partner: "Pacific Foods", lines: [["SNK-203", 4], ["HOU-401", 10]] },
      { id: "SO-2011", type: "out", partner: "Mart 7 Tampines", lines: [["SNK-201", 4], ["BEV-101", 8]] },
      { id: "SO-2012", type: "out", partner: "FairBuy Bishan", lines: [["GRO-301", 5], ["BEV-102", 4]] },
      { id: "SO-2013", type: "out", partner: "Daily Needs Yishun", lines: [["GRO-303", 4], ["GRO-301", 10]] }
    ],
    [
      { id: "PO-1021", type: "in", partner: "Island Snacks Ltd", lines: [["BEV-102", 12], ["SNK-201", 12]] },
      { id: "PO-1022", type: "in", partner: "CleanHome Supplies", lines: [["HOU-401", 10], ["BEV-101", 10]] },
      { id: "PO-1023", type: "in", partner: "Lion City Traders", lines: [["GRO-301", 5], ["BEV-101", 4]] },
      { id: "SO-2021", type: "out", partner: "QuickShop Jurong", lines: [["GRO-303", 6], ["BEV-103", 8]] },
      { id: "SO-2022", type: "out", partner: "CornerMart Bedok", lines: [["BEV-103", 4], ["GRO-303", 10]] },
      { id: "SO-2023", type: "out", partner: "ValueStore Clementi", lines: [["SNK-202", 12], ["GRO-303", 5]] }
    ],
    [
      { id: "PO-1031", type: "in", partner: "Golden Grains", lines: [["BEV-102", 10], ["HOU-401", 12]] },
      { id: "PO-1032", type: "in", partner: "Pacific Foods", lines: [["SNK-201", 4], ["SNK-203", 10]] },
      { id: "PO-1033", type: "in", partner: "FreshCo Beverages", lines: [["BEV-102", 4], ["HOU-401", 10]] },
      { id: "SO-2031", type: "out", partner: "FairBuy Bishan", lines: [["SNK-201", 12], ["GRO-302", 10]] },
      { id: "SO-2032", type: "out", partner: "Daily Needs Yishun", lines: [["GRO-301", 8], ["SNK-203", 10]] },
      { id: "SO-2033", type: "out", partner: "Mart 7 Tampines", lines: [["GRO-302", 6], ["SNK-203", 5]] }
    ],
    [
      { id: "PO-1041", type: "in", partner: "CleanHome Supplies", lines: [["BEV-103", 4], ["SNK-201", 10]] },
      { id: "PO-1042", type: "in", partner: "Lion City Traders", lines: [["SNK-202", 8], ["GRO-303", 6]] },
      { id: "PO-1043", type: "in", partner: "Island Snacks Ltd", lines: [["GRO-302", 10], ["SNK-202", 4]] },
      { id: "SO-2041", type: "out", partner: "CornerMart Bedok", lines: [["BEV-102", 8], ["GRO-303", 5]] },
      { id: "SO-2042", type: "out", partner: "ValueStore Clementi", lines: [["SNK-203", 8], ["BEV-103", 8]] },
      { id: "SO-2043", type: "out", partner: "QuickShop Jurong", lines: [["BEV-101", 10], ["BEV-102", 10]] }
    ],
    [
      { id: "PO-1051", type: "in", partner: "Pacific Foods", lines: [["SNK-203", 12], ["HOU-402", 6]] },
      { id: "PO-1052", type: "in", partner: "FreshCo Beverages", lines: [["HOU-401", 10], ["GRO-302", 8]] },
      { id: "PO-1053", type: "in", partner: "Golden Grains", lines: [["BEV-102", 6], ["HOU-402", 8]] },
      { id: "SO-2051", type: "out", partner: "Daily Needs Yishun", lines: [["HOU-402", 4], ["BEV-102", 12]] },
      { id: "SO-2052", type: "out", partner: "Mart 7 Tampines", lines: [["SNK-202", 12], ["HOU-401", 8]] },
      { id: "SO-2053", type: "out", partner: "FairBuy Bishan", lines: [["SNK-202", 12], ["GRO-301", 6]] }
    ],
    [
      { id: "PO-1061", type: "in", partner: "Lion City Traders", lines: [["BEV-101", 6], ["GRO-302", 5]] },
      { id: "PO-1062", type: "in", partner: "Island Snacks Ltd", lines: [["HOU-401", 8], ["BEV-102", 4]] },
      { id: "PO-1063", type: "in", partner: "CleanHome Supplies", lines: [["SNK-201", 5], ["SNK-202", 12]] },
      { id: "SO-2061", type: "out", partner: "ValueStore Clementi", lines: [["SNK-201", 8], ["GRO-301", 8]] },
      { id: "SO-2062", type: "out", partner: "QuickShop Jurong", lines: [["BEV-102", 8], ["BEV-103", 8]] },
      { id: "SO-2063", type: "out", partner: "CornerMart Bedok", lines: [["GRO-303", 5], ["SNK-202", 8]] }
    ]
  ];

  /* ---------- Warehouse rules ---------- */

  // Every warehouse keeps a log of transactions, added to and never changed. Stock is worked out by replaying
  // the log in order, so every screen agrees and two students can never overwrite each other's change:
  // if two students try to pick the last cartons at the same moment, the one logged first gets them and the
  // other is told the bin doesn't have enough.
  //
  // The steps, as in a real warehouse:
  //   purchase order line: receive at dock R1 ("rcv"), then put away into the product's bin ("put")
  //   sales order line:    pick from the product's bin ("pick")
  //   sales order:         pack and ship from dock S1 once every line is picked ("ship")
  function skuByCode(code) { for (var i = 0; i < SKUS.length; i++) if (SKUS[i].code === code) return SKUS[i]; return null; }
  function orderSet(place) { return ORDER_SETS[(place - 1) % ORDER_SETS.length]; }
  function docById(place, id) { return orderSet(place).filter(function (o) { return o.id === id; })[0] || null; }
  var STEPS_EACH = ORDER_SETS[0].reduce(function (n, o) { return n + (o.type === "in" ? 2 * o.lines.length : o.lines.length + 1); }, 0);
  var DOCS_EACH = ORDER_SETS[0].length;

  function replay(log) {
    var bin = {}, dock = {}, done = {}, results = {}, errors = {}, steps = {}, first = {}, last = {}, keys = Object.keys(log || {}).sort();
    SKUS.forEach(function (s) { bin[s.code] = s.start; dock[s.code] = 0; });
    for (var p = 1; p <= PLACES; p++) { done[p] = {}; errors[p] = 0; steps[p] = 0; }
    keys.forEach(function (key) {
      var e = log[key], p = e.p;
      if (!done[p]) return;
      if (!first[p] || e.at < first[p]) first[p] = e.at;
      if (!last[p] || e.at > last[p]) last[p] = e.at;
      var res = apply(e, done[p]);
      results[key] = res;
      if (res === "err") errors[p]++;
      if (res === "ok") steps[p]++;
    });
    function apply(e, d) {
      if (e.t === "err") return "err";
      var doc = docById(e.p, e.doc);
      if (!doc) return "err";
      if (e.t === "ship") {
        if (doc.type !== "out" || !doc.lines.every(function (l, i) { return d[doc.id + "/" + i + "/pick"]; })) return "err";
        if (d[doc.id + "/ship"]) return "dup";
        d[doc.id + "/ship"] = true;
        return "ok";
      }
      var line = doc.lines[e.line], sku = line && skuByCode(line[0]);
      if (!sku || e.sku !== line[0] || e.qty !== line[1]) return "err";
      var id = doc.id + "/" + e.line + "/" + e.t;
      if (e.t === "rcv" && doc.type === "in") {
        if (d[id]) return "dup";
        dock[sku.code] += line[1];
      } else if (e.t === "put" && doc.type === "in") {
        if (!d[doc.id + "/" + e.line + "/rcv"] || e.bin !== sku.bin) return "err";
        if (d[id]) return "dup";
        dock[sku.code] -= line[1];
        bin[sku.code] += line[1];
      } else if (e.t === "pick" && doc.type === "out") {
        if (e.bin !== sku.bin) return "err";
        if (d[id]) return "dup";
        if (bin[sku.code] < line[1]) return "short";
        bin[sku.code] -= line[1];
      } else {
        return "err";
      }
      d[id] = true;
      return "ok";
    }
    return { bin: bin, dock: dock, done: done, results: results, errors: errors, steps: steps, first: first, last: last, keys: keys };
  }

  function docClosed(r, p, doc) {
    var d = r.done[p];
    return doc.type === "in" ? doc.lines.every(function (l, i) { return d[doc.id + "/" + i + "/put"]; }) : !!d[doc.id + "/ship"];
  }
  function docsClosed(r, p) { return orderSet(p).filter(function (o) { return docClosed(r, p, o); }).length; }

  // Status words, as a WMS would show them.
  function docStatus(r, p, doc) {
    var d = r.done[p], n = doc.lines.length, count = function (step) { return doc.lines.filter(function (l, i) { return d[doc.id + "/" + i + "/" + step]; }).length; };
    if (doc.type === "in") {
      var rc = count("rcv"), pt = count("put");
      return pt === n ? "Closed" : rc === n ? "Received" : rc ? "Receiving" : "Open";
    }
    var pk = count("pick");
    return d[doc.id + "/ship"] ? "Shipped" : pk === n ? "Picked" : pk ? "Picking" : "Released";
  }

  // The bins in the warehouse, from the product list: aisles A, B, …; racks 01, 02, …; levels 1, 2, ….
  var LAYOUT = (function () {
    var aisles = {}, maxRack = 1, maxLevel = 1;
    SKUS.forEach(function (s) {
      var m = s.bin.split("-");
      aisles[m[0]] = true;
      maxRack = Math.max(maxRack, Number(m[1]));
      maxLevel = Math.max(maxLevel, Number(m[2]));
    });
    return { aisles: Object.keys(aisles).sort(), racks: maxRack, levels: maxLevel };
  })();

  // Check that every warehouse can always finish: stock at the start plus all receipts covers all shipments.
  (function checkData() {
    var need = {};
    SKUS.forEach(function (s) { need[s.code] = s.start; });
    for (var p = 1; p <= PLACES; p++) {
      orderSet(p).forEach(function (o) {
        o.lines.forEach(function (l) {
          if (!(l[0] in need)) window.console && console.warn("WMS data: unknown SKU " + l[0] + " in " + o.id);
          need[l[0]] += o.type === "in" ? l[1] : -l[1];
        });
      });
    }
    Object.keys(need).forEach(function (c) {
      if (need[c] < 0) window.console && console.warn("WMS data: " + c + " can run out for good (short by " + -need[c] + ").");
    });
  })();

  /* ---------- Database ---------- */

  function copy(o) { return o === undefined ? undefined : JSON.parse(JSON.stringify(o)); }
  function keysOf(path) { return path.split("/").filter(Boolean); }
  function setPath(root, path, value) {
    var keys = keysOf(path);
    if (!keys.length) return value;
    var top = root && typeof root === "object" ? root : {}, o = top;
    for (var i = 0; i < keys.length - 1; i++) {
      if (!o[keys[i]] || typeof o[keys[i]] !== "object") o[keys[i]] = {};
      o = o[keys[i]];
    }
    if (value === null) delete o[keys[keys.length - 1]];
    else o[keys[keys.length - 1]] = value;
    return top;
  }
  function applyUpdate(root, base, obj) {
    Object.keys(obj).forEach(function (k) { root = setPath(root, base + "/" + k, obj[k]); });
    return root;
  }

  var SERVER_TIME = { ".sv": "timestamp" }; // the database fills in its own clock

  function at(path) { return DB_URL.replace(/\/+$/, "") + "/" + path + ".json"; }
  function send(method, path, body) {
    return fetch(at(path), { method: method, body: body === undefined ? undefined : JSON.stringify(body) }).then(function (res) {
      if (res.status === 401) throw new Error("refused");
      if (!res.ok) throw new Error("The server refused the request (error " + res.status + ").");
      return res.json();
    });
  }
  function watch(path, fn, onStatus) {
    var data = null, es = new EventSource(at(path));
    function handle(e, isPatch) {
      var msg = JSON.parse(e.data);
      data = isPatch ? applyUpdate(data || {}, msg.path, msg.data) : setPath(data, msg.path, msg.data);
      fn(copy(data));
    }
    es.addEventListener("put", function (e) { handle(e, false); });
    es.addEventListener("patch", function (e) { handle(e, true); });
    es.addEventListener("cancel", function () { onStatus("This class can no longer be read."); });
    es.onopen = function () { onStatus(""); };
    es.onerror = function () { onStatus("Connection lost. Trying to reconnect…"); };
    return function () { es.close(); };
  }

  /* ---------- Page ---------- */

  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function randomId(n, chars) {
    chars = chars || "abcdefghijklmnopqrstuvwxyz0123456789";
    var out = "";
    for (var i = 0; i < n; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
  }
  function nameKey(s) { return String(s).trim().toLowerCase().replace(/\s+/g, " "); }
  function day(ms) { return new Date(ms).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" }); }
  function clock(ms) { return ms ? new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : ""; }
  function stamp(ms) { return ms ? new Date(ms).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""; }
  function isoDate(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function parseDate(s, endOfDay) {
    var p = s.split("-").map(Number);
    return endOfDay ? new Date(p[0], p[1] - 1, p[2], 23, 59, 59, 999).getTime() : new Date(p[0], p[1] - 1, p[2]).getTime();
  }
  function openText(info) { return day(info.start) + " to " + day(info.end); }

  var stopWatching = null, me = blankMe(), info = null, wlog = {}, cls = null;
  var view = "dash", sel = "", pending = {}, msg = null; // student's current screen, selected document, last system message
  var msgSeq = 0; // each new system message gets the next number

  function blankMe() { return { kind: "", code: "", w: 0, p: 0, name: "", id: randomId(12) }; }
  function base() { return "wmsClasses/" + me.code; }

  function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(me)); } catch (e) { /* not saved */ } }
  function loadSaved() { try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { return null; } }
  function forget() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* nothing saved */ } }

  function status(msg) {
    $("status").textContent = msg || "";
    $("status").hidden = !msg;
  }
  function show(id) { ["intro", "student", "teacher"].forEach(function (s) { $(s).hidden = s !== id; }); }
  function stop() {
    if (stopWatching) stopWatching();
    stopWatching = null;
  }

  function leave(keepSaved) {
    stop();
    if (!keepSaved) forget();
    me = blankMe();
    info = null;
    cls = null;
    wlog = {};
    view = "dash";
    sel = "";
    pending = {};
    msg = null;
    showIntro();
  }

  /* ----- Start screen ----- */

  function showIntro() {
    show("intro");
    var saved = loadSaved();
    $("rejoin").hidden = !(saved && saved.code);
    if (saved && saved.code) {
      $("rejoinText").textContent = saved.kind === "lecturer"
        ? "You were running WMS class " + saved.code + "."
        : "You were in WMS class " + saved.code + " as " + saved.name + " (Warehouse " + saved.w + ", place " + saved.p + ").";
    }
  }

  function setupIntro() {
    var opts = "";
    for (var n = 1; n <= MAX_WAREHOUSES; n++) opts += '<option value="' + n + '"' + (n === MAX_WAREHOUSES ? " selected" : "") + ">" + n + " (up to " + n * PLACES + " students)</option>";
    $("tWarehouses").innerHTML = opts;
    var today = new Date();
    $("tFirst").value = isoDate(today);
    $("tLast").value = isoDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 3));
    $("tFirst").addEventListener("change", function () {
      if (!$("tFirst").value) return;
      var p = $("tFirst").value.split("-").map(Number);
      $("tLast").value = isoDate(new Date(p[0], p[1] - 1, p[2] + 3));
    });
    var fromLink = new URLSearchParams(location.search).get("code");
    if (fromLink) $("sCode").value = fromLink.toUpperCase();

    $("studentForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var code = $("sCode").value.trim().toUpperCase(), name = $("sName").value.trim();
      if (!/^[A-Z2-9]{6}$/.test(code)) { status("A class code is 6 letters and numbers, like K7Q2PX."); return; }
      joinClass(code, name);
    });
    $("teacherForm").addEventListener("submit", function (e) {
      e.preventDefault();
      createClass($("tName").value.trim(), Number($("tWarehouses").value), $("tFirst").value, $("tLast").value);
    });
    $("rejoinBtn").addEventListener("click", function () {
      me = loadSaved();
      status("");
      if (me.kind === "lecturer") openTeacher();
      else openStudent();
    });
    $("forgetBtn").addEventListener("click", function () { forget(); showIntro(); });
  }

  function freshCode(triesLeft) {
    var code = randomId(6, CODE_CHARS);
    return send("GET", "wmsClasses/" + code + "/info").then(function (found) {
      if (found === null) return code;
      if (triesLeft > 1) return freshCode(triesLeft - 1);
      throw new Error("Couldn't find a free code. Please try again.");
    });
  }

  function createClass(name, warehouses, first, lastDay) {
    var start = parseDate(first, false), end = parseDate(lastDay, true);
    if (!(end > start)) { status("The last lesson day must be on or after the first one."); return; }
    if (end - start > MAX_DAYS * DAY) { status("A class can be open for at most " + MAX_DAYS + " days."); return; }
    status("Creating the class…");
    freshCode(5).then(function (code) {
      me = blankMe();
      me.kind = "lecturer";
      me.code = code;
      me.name = name;
      return send("PUT", base() + "/info", { created: SERVER_TIME, hostId: me.id, hostName: name, warehouses: warehouses, start: start, end: end })
        .then(function () { status(""); openTeacher(); });
    }).catch(function (err) {
      status(err.message === "refused"
        ? "The class couldn't be created: the database refused access. Check that the WMS rules are published in the WMS's Firebase project."
        : err.message);
    });
  }

  // Seats are filled in order: Warehouse 1 places 1–6, then Warehouse 2, and so on.
  // A student who joins again with the same name gets their old place back.
  function joinClass(code, name, triesLeft) {
    triesLeft = triesLeft === undefined ? 15 : triesLeft;
    status("Looking for class " + code + "…");
    Promise.all([send("GET", "wmsClasses/" + code + "/info"), send("GET", "wmsClasses/" + code + "/seats")]).then(function (found) {
      var inf = found[0], seats = found[1] || {};
      if (!inf) throw new Error("No WMS class with the code " + code + " was found.");
      var now = Date.now();
      if (now < inf.start || now > inf.end) throw new Error("Class " + code + " is open from " + openText(inf) + ".");
      var mine = null, free = null;
      for (var w = 1; w <= inf.warehouses && !mine; w++) {
        for (var p = 1; p <= PLACES; p++) {
          var s = seats["w" + w] && seats["w" + w]["p" + p];
          if (s && nameKey(s.name) === nameKey(name)) { mine = { w: w, p: p, name: s.name }; break; }
          if (!s && !free) free = { w: w, p: p };
        }
      }
      function enter(seat) {
        me = blankMe();
        me.kind = "student";
        me.code = code;
        me.w = seat.w;
        me.p = seat.p;
        me.name = seat.name || name;
        status("");
        openStudent();
      }
      if (mine) { enter(mine); return; }
      if (!free) throw new Error("All " + inf.warehouses * PLACES + " places in this class are taken. Please ask your lecturer.");
      return send("PUT", "wmsClasses/" + code + "/seats/w" + free.w + "/p" + free.p, { name: name, at: SERVER_TIME }).then(function () { enter(free); }, function (err) {
        if (err.message === "refused" && triesLeft > 1) {
          // Someone took that place first: wait a moment (a different time for each student) and try the next one.
          return new Promise(function (done) { setTimeout(done, 100 + Math.random() * 400); }).then(function () { return joinClass(code, name, triesLeft - 1); });
        }
        throw err;
      });
    }).catch(function (err) {
      status(err.message === "refused" ? "The class didn't accept you. It may be closed: check the lesson dates with your lecturer." : err.message || "Couldn't reach the server.");
    });
  }

  /* ----- Student ----- */

  var VIEWS = [
    { key: "dash", name: "Dashboard", icon: '<path d="M3 3h8v8H3zM13 3h8v5h-8zM13 10h8v11h-8zM3 13h8v8H3z"/>' },
    { key: "in", name: "Receiving", icon: '<path d="M3 10h18v11H3z"/><path d="M12 2v7M9 6l3 3 3-3"/>' },
    { key: "put", name: "Put-away", icon: '<path d="M3 21V4h18v17M3 11h18M3 17h18"/><path d="M8 7h3"/>' },
    { key: "out", name: "Picking", icon: '<path d="M3 10h18v11H3z"/><path d="M12 9V2M9 5l3-3 3 3"/>' },
    { key: "ship", name: "Pack & ship", icon: '<path d="M2 6h12v10H2zM14 9h4l4 4v3h-8z"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>' },
    { key: "inv", name: "Inventory", icon: '<path d="M4 21h16M5 21V9h6v12M13 21V5h6v16"/>' },
    { key: "map", name: "Warehouse map", icon: '<path d="M3 5l6-2 6 2 6-2v16l-6 2-6-2-6 2z"/><path d="M9 3v16M15 5v16"/>' },
    { key: "log", name: "Transactions", icon: '<path d="M5 3h14v18H5z"/><path d="M8 8h8M8 12h8M8 16h5"/>' }
  ];
  function viewName(key) { return VIEWS.filter(function (v) { return v.key === key; })[0].name; }
  function svgIcon(path) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">' + path + "</svg>";
  }

  function openStudent() {
    stop();
    save();
    show("student");
    view = "dash";
    sel = "";
    msg = null;
    $("sWho").textContent = me.name;
    $("sWhere").textContent = "Warehouse " + me.w + " · Class " + me.code;
    send("GET", base() + "/info").then(function (inf) {
      if (!inf) { leave(); status("This class no longer exists."); return; }
      info = inf;
      stopWatching = watch(base() + "/log/w" + me.w, function (log) {
        wlog = log || {};
        renderStudent();
      }, status);
      // Notice if the lecturer deletes the class.
      var stopInfo = watch(base() + "/info", function (v) {
        if (v === null && me.kind === "student") { stopInfo(); leave(); status("This class has ended: the lecturer deleted it."); }
      }, function () {});
      var prevStop = stopWatching;
      stopWatching = function () { prevStop(); stopInfo(); };
    }).catch(function (err) { status(err.message); });
    renderStudent();
  }

  // The student's open work, used for the menu counts, the dashboard and the task lists.
  function tasks(r) {
    var p = me.p, d = r.done[p], t = { receive: [], put: [], pick: [], ship: [] };
    orderSet(p).forEach(function (o) {
      if (o.type === "in") {
        if (o.lines.some(function (l, i) { return !d[o.id + "/" + i + "/rcv"]; })) t.receive.push(o);
        o.lines.forEach(function (l, i) {
          if (d[o.id + "/" + i + "/rcv"] && !d[o.id + "/" + i + "/put"]) t.put.push({ doc: o, line: i, key: o.id + "/" + i });
        });
      } else if (!d[o.id + "/ship"]) {
        if (o.lines.every(function (l, i) { return d[o.id + "/" + i + "/pick"]; })) t.ship.push(o);
        else t.pick.push(o);
      }
    });
    return t;
  }

  function renderStudent() {
    var r = replay(wlog), t = tasks(r);
    var counts = { "in": t.receive.length, put: t.put.length, out: t.pick.length, ship: t.ship.length };
    $("wmNav").innerHTML = VIEWS.map(function (v) {
      return '<li><button type="button" data-view="' + v.key + '"' + (v.key === view ? ' class="wm-on" aria-current="page"' : "") + ">" + svgIcon(v.icon) +
        "<span>" + v.name + "</span>" + (counts[v.key] ? '<span class="wm-count">' + counts[v.key] + "</span>" : "") + "</button></li>";
    }).join("");

    // Pending posts: tell the student what happened once their transaction comes back in the log.
    Object.keys(pending).forEach(function (key) {
      var res = r.results[key];
      if (!res) return;
      var pend = pending[key];
      delete pending[key];
      if (res === "ok") msg = { seq: ++msgSeq, kind: "ok", text: pend.okText };
      else if (res === "short") msg = { seq: ++msgSeq, kind: "warn", text: pend.shortText };
      else if (res === "dup") msg = { seq: ++msgSeq, kind: "warn", text: "Already done: a second copy of this transaction was ignored." };
      else msg = { seq: ++msgSeq, kind: "warn", text: "The system didn't accept that transaction." };
    });

    $("crumb").textContent = "WMS › " + viewName(view) + (sel ? " › " + sel.split("/")[0] : "");
    var next = document.createElement("div");
    next.innerHTML = ({ dash: viewDash, "in": viewReceive, put: viewPut, out: viewPick, ship: viewShip, inv: viewInventory, map: viewMap, log: viewLog })[view](r, t);
    // When a classmate's work updates the screen, only redraw what changed, and never touch the form the student
    // is typing in, so they keep their text, their cursor and their place.
    if (!patch($("view"), next)) $("view").replaceChildren.apply($("view"), Array.prototype.slice.call(next.childNodes));
  }

  // Make the page's elements match the new ones, replacing only parts that differ. A form that looks the same
  // (same boxes) is kept as it is. Returns false if the layout changed too much, so the caller redraws all of it.
  function patch(oldEl, newEl) {
    var a = oldEl.childNodes, b = newEl.childNodes;
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) {
      var o = a[i], n = b[i];
      if (o.isEqualNode(n)) continue;
      var hasForm = o.nodeType === 1 && (o.tagName === "FORM" || o.querySelector("form"));
      if (!hasForm) { oldEl.replaceChild(n.cloneNode(true), o); continue; }
      if (o.tagName !== n.tagName) return false;
      if (o.tagName === "FORM") {
        if (o.outerHTML !== n.outerHTML) return false; // different boxes: redraw everything
        continue;
      }
      for (var k = o.attributes.length - 1; k >= 0; k--) o.removeAttribute(o.attributes[k].name);
      for (var m = 0; m < n.attributes.length; m++) o.setAttribute(n.attributes[m].name, n.attributes[m].value);
      if (!patch(o, n)) return false;
    }
    return true;
  }

  function message() {
    return msg ? '<p class="wm-msg wm-msg-' + msg.kind + '" role="status" data-seq="' + msg.seq + '">' + msg.text + "</p>" : "";
  }
  function tag(text, kind) { return '<span class="wm-tag' + (kind ? " wm-tag-" + kind : "") + '">' + text + "</span>"; }
  function statusTag(s) {
    return tag(s, s === "Closed" || s === "Shipped" ? "dark" : s === "Open" || s === "Released" ? "" : "yellow");
  }
  function head(title, right) {
    return '<div class="wm-head"><h1>' + title + "</h1>" + (right || "") + "</div>";
  }
  function flow(steps, now) {
    var i = steps.indexOf(now);
    return '<ol class="wm-flow">' + steps.map(function (s, n) {
      return '<li class="' + (n < i ? "wm-done" : n === i ? "wm-now" : "") + '">' + s + "</li>";
    }).join("") + "</ol>";
  }
  function docList(docs, r, empty) {
    if (!docs.length) return '<p class="wm-hint">' + empty + "</p>";
    return '<ul class="wm-docs">' + docs.map(function (o) {
      var st = docStatus(r, me.p, o);
      return '<li><button type="button" data-doc="' + o.id + '"' + (o.id === sel ? ' class="wm-on" aria-current="true"' : "") + ">" +
        '<span class="wm-code">' + o.id + "</span><span>" + esc(o.partner) + "</span>" + statusTag(st) + "</button></li>";
    }).join("") + "</ul>";
  }

  function viewDash(r, t) {
    var name = me.name.split(" ")[0], hour = new Date().getHours();
    var hello = (hour < 12 ? "Good morning, " : hour < 18 ? "Good afternoon, " : "Good evening, ") + esc(name);
    var list = [];
    t.put.forEach(function (x) {
      var l = x.doc.lines[x.line], s = skuByCode(l[0]);
      list.push([tag("Put away", "yellow"), '<b class="wm-code">' + x.doc.id + "</b> · " + esc(s.name) + " × " + l[1] + ' → bin <b class="wm-code">' + s.bin + "</b>", "put", x.key]);
    });
    t.pick.forEach(function (o) { list.push([tag("Pick"), '<b class="wm-code">' + o.id + "</b> · " + esc(o.partner) + " · " + o.lines.length + " lines", "out", o.id]); });
    t.ship.forEach(function (o) { list.push([tag("Ship", "dark"), '<b class="wm-code">' + o.id + "</b> · " + esc(o.partner) + " · picked", "ship", o.id]); });
    t.receive.forEach(function (o) { list.push([tag("Receive"), '<b class="wm-code">' + o.id + "</b> · " + esc(o.partner) + " · " + o.lines.length + " lines", "in", o.id]); });
    var done = !list.length;
    return head(hello, tag("Warehouse " + me.w, "dark")) +
      '<div class="wm-kpis">' +
      kpi("Purchase orders to receive", t.receive.length) + kpi("Waiting put-away", t.put.length) +
      kpi("Sales orders to pick", t.pick.length) + kpi("Ready to ship", t.ship.length) + "</div>" +
      '<div class="wm-two"><div class="wm-panel"><h2>My tasks</h2>' +
      (done ? '<p class="wm-msg wm-msg-ok">All your documents are closed. Nothing left to do. You can still look around the warehouse.</p>'
        : '<ul class="wm-tasks">' + list.map(function (x) {
          return '<li><button type="button" data-go="' + x[2] + '" data-sel="' + x[3] + '">' + x[0] + "<span>" + x[1] + "</span></button></li>";
        }).join("") + "</ul>") +
      '</div><div class="wm-panel"><h2>Warehouse activity</h2>' + activity(r, 8) + "</div></div>";
  }
  function kpi(label, n) { return '<div class="wm-kpi"><small>' + label + "</small><b>" + n + "</b></div>"; }

  function viewReceive(r, t) {
    var docs = orderSet(me.p).filter(function (o) { return o.type === "in"; });
    var o = sel && docById(me.p, sel.split("/")[0]);
    if (!o || o.type !== "in") o = null;
    var out = head("Receiving") + '<div class="wm-two"><div class="wm-panel"><h2>Purchase orders</h2>' + docList(docs, r, "") + "</div>";
    if (!o) return out + '<div class="wm-panel"><p class="wm-hint">Choose a purchase order to receive its goods at dock R1.</p></div></div>';
    var d = r.done[me.p], st = docStatus(r, me.p, o), open = o.lines.some(function (l, i) { return !d[o.id + "/" + i + "/rcv"]; });
    return out + '<div class="wm-panel">' + head(o.id + " · " + esc(o.partner), statusTag(st)) +
      flow(["Open", "Receiving", "Received", "Closed"], st) +
      '<div class="wm-scroll"><table class="wm-table"><thead><tr><th>Line</th><th>SKU</th><th>Ordered</th><th>Received</th><th>Status</th><th>Description</th></tr></thead><tbody>' +
      o.lines.map(function (l, i) {
        var got = d[o.id + "/" + i + "/rcv"], s = skuByCode(l[0]);
        return "<tr" + (got ? "" : ' class="wm-current"') + "><td>" + (i + 1) + '</td><td class="wm-code">' + l[0] + "</td><td>" + l[1] + "</td><td>" + (got ? l[1] : 0) +
          "</td><td>" + (got ? tag("Received", "dark") : tag("Open")) + "</td><td>" + esc(s.name) + "</td></tr>";
      }).join("") + "</tbody></table></div>" +
      (open ? '<form class="wm-form" data-step="rcv"><label class="wm-field">SKU<input id="fSku" class="wm-code" required autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="e.g. BEV-103"></label>' +
        '<label class="wm-field">Quantity received<input id="fQty" type="number" min="0" max="999" step="1" inputmode="numeric" required></label>' +
        '<button type="submit" class="btn btn-primary">Confirm receipt</button></form>'
        : '<p class="wm-hint">All lines received. The goods are waiting at dock R1: go to <button type="button" class="wm-link" data-go="put" data-sel="">Put-away</button>.</p>') +
      message() + "</div></div>";
  }

  function viewPut(r, t) {
    var x = t.put.filter(function (y) { return y.key === sel; })[0] || t.put[0];
    if (x) sel = x.key;
    var out = head("Put-away") + '<div class="wm-two"><div class="wm-panel"><h2>Waiting at dock R1</h2>';
    out += t.put.length ? '<ul class="wm-docs">' + t.put.map(function (y) {
      var l = y.doc.lines[y.line], s = skuByCode(l[0]);
      return '<li><button type="button" data-sel="' + y.key + '"' + (y === x ? ' class="wm-on" aria-current="true"' : "") + '><span class="wm-code">' + y.doc.id + "</span><span>" +
        esc(s.name) + " × " + l[1] + "</span>" + tag(s.bin, "yellow") + "</button></li>";
    }).join("") + "</ul>" : '<p class="wm-hint">Nothing waiting. Receive a purchase order first; its goods then wait here.</p>';
    out += message() + "</div>";
    if (!x) return out + '<div class="wm-panel"><h2>Warehouse map</h2>' + map(r, {}) + "</div></div>";
    var l = x.doc.lines[x.line], s = skuByCode(l[0]), go = {};
    go[s.bin] = "go";
    return out + '<div class="wm-panel"><h2>Put away ' + l[1] + " × " + esc(s.name) + "</h2>" +
      '<table class="wm-table wm-facts"><tbody><tr><th>Document</th><td class="wm-code">' + x.doc.id + " line " + (x.line + 1) + '</td></tr><tr><th>SKU</th><td class="wm-code">' + s.code +
      "</td></tr><tr><th>Quantity</th><td>" + l[1] + ' cartons</td></tr><tr><th>Suggested bin</th><td class="wm-code">' + s.bin + "</td></tr></tbody></table>" +
      map(r, go) +
      '<form class="wm-form" data-step="put"><label class="wm-field">Bin you put it in<input id="fBin" class="wm-code" required autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="e.g. A-02-1"></label>' +
      '<button type="submit" class="btn btn-primary">Confirm put-away</button></form></div></div>';
  }

  function viewPick(r, t) {
    var docs = orderSet(me.p).filter(function (o) { return o.type === "out"; });
    var o = sel && docById(me.p, sel.split("/")[0]);
    if (!o || o.type !== "out") o = null;
    var out = head("Picking") + '<div class="wm-two"><div class="wm-panel"><h2>Sales orders</h2>' + docList(docs, r, "") + "</div>";
    if (!o) return out + '<div class="wm-panel"><p class="wm-hint">Choose a sales order to see its pick list and walk route.</p></div></div>';
    var d = r.done[me.p], st = docStatus(r, me.p, o);
    var rows = o.lines.map(function (l, i) { return { l: l, i: i, s: skuByCode(l[0]) }; }).sort(function (a, b) { return a.s.bin < b.s.bin ? -1 : 1; });
    var route = {}, n = 0, open = false;
    rows.forEach(function (x) { if (!d[o.id + "/" + x.i + "/pick"]) { route[x.s.bin] = ++n; open = true; } });
    return out + '<div class="wm-panel">' + head(o.id + " · " + esc(o.partner), statusTag(st)) +
      flow(["Released", "Picking", "Picked", "Shipped"], st) +
      '<div class="wm-scroll"><table class="wm-table"><thead><tr><th>Bin</th><th>SKU</th><th>Qty</th><th>In bin</th><th>Picked</th><th>Description</th></tr></thead><tbody>' +
      rows.map(function (x) {
        var got = d[o.id + "/" + x.i + "/pick"];
        return "<tr" + (got ? "" : ' class="wm-current"') + '><td class="wm-code">' + x.s.bin + '</td><td class="wm-code">' + x.s.code + "</td><td>" + x.l[1] + "</td><td>" + r.bin[x.s.code] +
          "</td><td>" + (got ? "✓ " + x.l[1] : "—") + "</td><td>" + esc(x.s.name) + "</td></tr>";
      }).join("") + "</tbody></table></div>" +
      (open ? '<form class="wm-form wm-form-3" data-step="pick"><label class="wm-field">Bin<input id="fBin" class="wm-code" required autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="e.g. A-01-1"></label>' +
        '<label class="wm-field">SKU<input id="fSku" class="wm-code" required autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="e.g. BEV-101"></label>' +
        '<label class="wm-field">Quantity picked<input id="fQty" type="number" min="0" max="999" step="1" inputmode="numeric" required></label>' +
        '<button type="submit" class="btn btn-primary">Confirm pick</button></form>'
        : st === "Shipped" ? "" : '<p class="wm-hint">All lines picked. Go to <button type="button" class="wm-link" data-go="ship" data-sel="' + o.id + '">Pack &amp; ship</button>.</p>') +
      message() + (open ? "<h2>Walk route</h2>" + map(r, route) : "") + "</div></div>";
  }

  function viewShip(r, t) {
    var docs = orderSet(me.p).filter(function (o) { return o.type === "out"; });
    return head("Pack & ship") + message() + '<div class="wm-panel"><h2>Sales orders at dock S1</h2><div class="wm-scroll"><table class="wm-table"><thead><tr><th>Order</th><th>Customer</th><th>Lines</th><th>Status</th><th></th></tr></thead><tbody>' +
      docs.map(function (o) {
        var st = docStatus(r, me.p, o);
        return '<tr><td class="wm-code">' + o.id + "</td><td>" + esc(o.partner) + "</td><td>" + o.lines.map(function (l) { return l[1] + " × " + l[0]; }).join(", ") + "</td><td>" + statusTag(st) +
          "</td><td>" + (st === "Picked" ? '<button type="button" class="btn btn-primary" data-ship="' + o.id + '">Pack &amp; ship</button>' : st === "Shipped" ? "" : '<span class="wm-hint">Pick first</span>') + "</td></tr>";
      }).join("") + "</tbody></table></div></div>";
  }

  function viewInventory(r) {
    return head("Inventory") + '<div class="wm-panel"><p class="wm-hint">On hand in each bin, plus cartons received but still waiting at dock R1. Updates live as your classmates work.</p>' +
      '<div class="wm-scroll"><table class="wm-table"><thead><tr><th>SKU</th><th>Description</th><th>Bin</th><th>In bin</th><th>At dock R1</th></tr></thead><tbody>' +
      SKUS.map(function (s) {
        return '<tr><td class="wm-code">' + s.code + "</td><td>" + esc(s.name) + '</td><td class="wm-code">' + s.bin + "</td><td>" + r.bin[s.code] +
          (r.bin[s.code] < 5 ? " " + tag("Low") : "") + "</td><td>" + (r.dock[s.code] || "") + "</td></tr>";
      }).join("") + "</tbody></table></div></div>";
  }

  function viewMap(r) {
    return head("Warehouse map") + '<div class="wm-panel"><p class="wm-hint">Each box is a bin: aisle, rack, level (A-02-1 = aisle A, rack 02, level 1). The yellow bar shows how full it is.</p>' + map(r, {}) + "</div>";
  }

  function viewLog(r) {
    var mine = r.keys.filter(function (k) { return wlog[k].p === me.p; }).reverse();
    return head("Transactions") + '<div class="wm-two"><div class="wm-panel"><h2>My transactions</h2>' +
      (mine.length ? '<div class="wm-scroll"><table class="wm-table"><thead><tr><th>Time</th><th>Transaction</th></tr></thead><tbody>' +
        mine.map(function (k) { return '<tr><td class="wm-code">' + clock(wlog[k].at) + "</td><td>" + describe(wlog[k], r.results[k], true) + "</td></tr>"; }).join("") +
        "</tbody></table></div>" : '<p class="wm-hint">None yet.</p>') +
      '</div><div class="wm-panel"><h2>Whole warehouse</h2>' + activity(r, 30) + "</div></div>";
  }

  // The warehouse floor: receiving dock, aisles of bins, shipping dock. mark: { bin: "go" } or { bin: step number }.
  function map(r, mark) {
    var cap = {};
    SKUS.forEach(function (s) { cap[s.bin] = s; });
    var h = '<div class="wm-scroll"><div class="wm-map" style="grid-template-columns: 56px repeat(' + LAYOUT.aisles.length + ', minmax(76px, 1fr)) 56px">' +
      '<div class="wm-dock">Receiving dock R1</div>';
    LAYOUT.aisles.forEach(function (a) {
      h += '<div class="wm-aisle"><b>Aisle ' + a + "</b>";
      for (var rack = LAYOUT.racks; rack >= 1; rack--) {
        for (var lv = LAYOUT.levels; lv >= 1; lv--) {
          var code = a + "-" + String(rack).padStart(2, "0") + "-" + lv, s = cap[code], m = mark[code];
          var full = s ? Math.min(100, Math.round(r.bin[s.code] / Math.max(s.start * 2, 20) * 100)) : 0;
          h += '<div class="wm-bin' + (s ? "" : " wm-empty") + (m === "go" ? " wm-go" : "") + (typeof m === "number" ? " wm-step" : "") + '"' +
            (typeof m === "number" ? ' data-step="' + m + '"' : "") + '><span class="wm-code">' + code + "</span>" +
            (s ? "<span>" + s.code + " · " + r.bin[s.code] + '</span><span class="wm-fill" style="width:' + full + '%"></span>' : "<span>empty</span>") + "</div>";
        }
      }
      h += "</div>";
    });
    return h + '<div class="wm-dock">Shipping dock S1</div></div></div>';
  }

  function describe(e, res, mine) {
    var who = mine ? "" : "<strong>" + esc(e.name) + "</strong> ";
    if (res === "err" || e.t === "err") return who + "<span class=\"wm-hint\">refused by the system" + (e.why ? ": " + esc(e.why) : "") + "</span>";
    if (res === "short") return who + "tried to pick " + e.qty + " × " + e.sku + " from " + e.bin + " (" + e.doc + "): not enough in the bin";
    if (res === "dup") return who + "repeated " + e.doc + " (ignored)";
    if (e.t === "rcv") return who + "received " + e.qty + " × " + e.sku + " (" + e.doc + ") at dock R1";
    if (e.t === "put") return who + "put away " + e.qty + " × " + e.sku + " to " + e.bin;
    if (e.t === "pick") return who + "picked " + e.qty + " × " + e.sku + " from " + e.bin + " (" + e.doc + ")";
    if (e.t === "ship") return who + "shipped " + e.doc + " from dock S1";
    return who + esc(e.t);
  }
  function activity(r, n) {
    var recent = r.keys.slice(-n).reverse();
    return recent.length ? '<ul class="wm-activity">' + recent.map(function (k) {
      return '<li><span class="wm-time">' + clock(wlog[k].at) + "</span> " + describe(wlog[k], r.results[k], false) + "</li>";
    }).join("") + "</ul>" : '<p class="wm-hint">No activity yet.</p>';
  }

  // Check an entry like a WMS would, then post it. Refused entries are logged too, for the lecturer.
  function submitStep(step, docId) {
    var r = replay(wlog), d = r.done[me.p], t = tasks(r);
    var sku = ($("fSku") ? $("fSku").value : "").trim().toUpperCase(), qty = $("fQty") ? Number($("fQty").value) : 0;
    var bin = ($("fBin") ? $("fBin").value : "").trim().toUpperCase();
    var entry = { t: step, p: me.p, name: me.name, doc: docId, line: 0, sku: sku, qty: isFinite(qty) ? qty : 0, bin: bin, at: SERVER_TIME };
    var why = "", okText = "", shortText = "";
    var doc = docById(me.p, docId);
    if (step === "rcv") {
      var i = -1;
      doc.lines.forEach(function (l, n) { if (i < 0 && l[0] === sku && !d[doc.id + "/" + n + "/rcv"]) i = n; });
      if (i < 0) why = "SKU " + (sku || "(blank)") + " is not an open line on " + doc.id + ".";
      else if (qty !== doc.lines[i][1]) why = "Quantity " + qty + " doesn't match the open quantity on line " + (i + 1) + " (" + doc.lines[i][1] + "). Count again.";
      entry.line = Math.max(i, 0);
      okText = "Received " + qty + " × " + sku + " on " + doc.id + ". It's waiting at dock R1 for put-away.";
    } else if (step === "put") {
      var x = t.put.filter(function (y) { return y.key === sel; })[0], s = skuByCode(x.doc.lines[x.line][0]);
      entry.doc = x.doc.id;
      entry.line = x.line;
      entry.sku = s.code;
      entry.qty = x.doc.lines[x.line][1];
      if (bin !== s.bin) why = "Bin " + (bin || "(blank)") + " doesn't hold " + s.code + ". Put it in " + s.bin + ".";
      okText = "Put away " + entry.qty + " × " + s.code + " to " + s.bin + ". Bin now holds " + (r.bin[s.code] + entry.qty) + ".";
    } else if (step === "pick") {
      var k = -1;
      doc.lines.forEach(function (l, n) { if (k < 0 && l[0] === sku && !d[doc.id + "/" + n + "/pick"]) k = n; });
      var ps = skuByCode(sku);
      if (k < 0) why = "SKU " + (sku || "(blank)") + " is not an open line on " + doc.id + ".";
      else if (bin !== ps.bin) why = "Bin " + (bin || "(blank)") + " doesn't hold " + sku + ". Pick it from " + ps.bin + ".";
      else if (qty !== doc.lines[k][1]) why = "Quantity " + qty + " doesn't match the pick quantity for " + sku + " (" + doc.lines[k][1] + ").";
      else if (r.bin[sku] < qty) {
        msg = { seq: ++msgSeq, kind: "warn", text: "Bin " + bin + " has only " + r.bin[sku] + " of " + sku + " (a classmate picked from it). Wait for a delivery to be put away, then try again." };
        renderStudent();
        return;
      }
      entry.line = Math.max(k, 0);
      okText = "Picked " + qty + " × " + sku + " from " + bin + " for " + doc.id + ".";
      shortText = "Bin " + bin + " ran out of " + sku + ": a classmate picked it first. Wait for a delivery, then try again.";
    } else if (step === "ship") {
      entry.sku = "";
      okText = doc.id + " packed and shipped from dock S1 to " + doc.partner + ".";
    }
    if (why) {
      entry.t = "err";
      entry.why = why;
      msg = { seq: ++msgSeq, kind: "warn", text: why };
    } else {
      msg = { seq: ++msgSeq, kind: "info", text: "Saving…" };
    }
    // A valid entry clears the boxes straight away, ready for the next line; they come back if saving fails.
    var typed = {};
    if (!why) ["fSku", "fQty", "fBin"].forEach(function (id) { if ($(id)) { typed[id] = $(id).value; $(id).value = ""; } });
    renderStudent();
    send("POST", base() + "/log/w" + me.w, entry).then(function (res) {
      if (!why) pending[res.name] = { okText: okText, shortText: shortText };
      renderStudent();
    }, function (err) {
      msg = { seq: ++msgSeq, kind: "warn", text: err.message === "refused" ? "Not saved: the class is closed (open " + openText(info) + ")." : err.message };
      renderStudent();
      Object.keys(typed).forEach(function (id) { if ($(id) && !$(id).value) $(id).value = typed[id]; });
    });
  }

  function setupStudent() {
    $("wmNav").addEventListener("click", function (e) {
      var b = e.target.closest("[data-view]");
      if (!b) return;
      view = b.getAttribute("data-view");
      sel = "";
      msg = null;
      renderStudent();
    });
    $("view").addEventListener("click", function (e) {
      var b = e.target.closest("[data-go], [data-doc], [data-sel], [data-ship]");
      if (!b) return;
      if (b.hasAttribute("data-ship")) { sel = b.getAttribute("data-ship"); submitStep("ship", sel); return; }
      if (b.hasAttribute("data-go")) view = b.getAttribute("data-go");
      sel = b.getAttribute("data-doc") || b.getAttribute("data-sel") || "";
      msg = null;
      renderStudent();
      var first = document.querySelector("#view form input");
      if (first) first.focus();
    });
    $("view").addEventListener("submit", function (e) {
      e.preventDefault();
      var step = e.target.getAttribute("data-step");
      submitStep(step, step === "put" ? "" : sel.split("/")[0]);
    });
    $("leaveStudent").addEventListener("click", function () { leave(true); });
  }

  /* ----- Lecturer ----- */

  function openTeacher() {
    stop();
    save();
    stopWatching = watch(base(), function (c) {
      if (!c || !c.info) {
        var code = me.code;
        leave();
        status("No WMS class with the code " + code + " was found.");
        return;
      }
      cls = c;
      renderTeacher();
    }, status);
  }

  function studentRows(c) {
    var rows = [];
    for (var w = 1; w <= c.info.warehouses; w++) {
      var r = replay(c.log && c.log["w" + w]);
      for (var p = 1; p <= PLACES; p++) {
        var s = c.seats && c.seats["w" + w] && c.seats["w" + w]["p" + p];
        if (!s) continue;
        rows.push({ w: w, p: p, name: s.name, steps: r.steps[p], docs: docsClosed(r, p), errors: r.errors[p], first: r.first[p], last: r.last[p] });
      }
    }
    return rows;
  }

  function renderTeacher() {
    show("teacher");
    var c = cls, now = Date.now();
    $("tTitle").textContent = "WMS class " + me.code;
    $("tCode").textContent = me.code;
    $("tLink").value = location.origin + location.pathname + "?code=" + me.code;
    $("tOpen").textContent = (now < c.info.start ? "Opens " : now > c.info.end ? "Closed. Was open " : "Open ") + openText(c.info) +
      (now < c.info.start ? ". Students can't join before then." : now > c.info.end ? "." : ". Students can join and work now.");
    var rows = studentRows(c), finished = rows.filter(function (s) { return s.steps === STEPS_EACH; }).length;
    $("tCounts").textContent = rows.length + " student" + (rows.length === 1 ? "" : "s") + " joined · " + finished + " finished all " + STEPS_EACH +
      " steps · " + c.info.warehouses + " warehouses (room for " + c.info.warehouses * PLACES + ")";
    var html = "";
    for (var w = 1; w <= c.info.warehouses; w++) {
      var log = (c.log && c.log["w" + w]) || {}, r = replay(log);
      var mine = rows.filter(function (s) { return s.w === w; });
      html += '<li class="wm-card wm-house"><h3>Warehouse ' + w + "</h3>" +
        '<div class="wm-scroll"><table class="wm-table"><thead><tr><th>Place</th><th>Student</th><th>Steps</th><th>Documents closed</th><th>Refused entries</th><th>Last activity</th></tr></thead><tbody>' +
        (mine.length ? mine.map(function (s) {
          return "<tr><td>" + s.p + "</td><td>" + esc(s.name) + "</td><td>" + s.steps + "/" + STEPS_EACH + (s.steps === STEPS_EACH ? " ✓" : "") +
            "</td><td>" + s.docs + "/" + DOCS_EACH + "</td><td>" + s.errors + "</td><td>" + stamp(s.last) + "</td></tr>";
        }).join("") : '<tr><td colspan="6">No students yet.</td></tr>') + "</tbody></table></div>" +
        '<details class="wm-more"><summary>Stock now</summary><div class="wm-scroll"><table class="wm-table"><thead><tr><th>SKU</th><th>Product</th><th>Bin</th><th>In bin</th><th>At dock R1</th></tr></thead><tbody>' +
        SKUS.map(function (s) {
          return '<tr><td class="wm-code">' + s.code + "</td><td>" + esc(s.name) + '</td><td class="wm-code">' + s.bin + "</td><td>" + r.bin[s.code] + "</td><td>" + (r.dock[s.code] || "") + "</td></tr>";
        }).join("") + "</tbody></table></div></details>" +
        '<details class="wm-more"><summary>Latest activity</summary><ul class="wm-activity">' +
        (r.keys.length ? r.keys.slice(-8).reverse().map(function (k) {
          return '<li><span class="wm-time">' + stamp(log[k].at) + "</span> " + describe(log[k], r.results[k], false) + "</li>";
        }).join("") : "<li>No activity yet.</li>") + "</ul></details></li>";
    }
    $("houseGrid").innerHTML = html;
    $("tDelete").hidden = c.info.hostId !== me.id;
    $("tSummary").disabled = !rows.length;
    $("tLog").disabled = !rows.length;
  }

  function csv(rows) {
    function cell(v) {
      v = v === undefined || v === null ? "" : String(v);
      return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    }
    // The mark at the start (a "byte order mark") tells Excel the file is UTF-8, so accented names show correctly.
    return "﻿" + rows.map(function (r) { return r.map(cell).join(","); }).join("\r\n") + "\r\n";
  }
  function iso(ms) { return ms ? new Date(ms).toLocaleString("sv-SE") : ""; } // e.g. 2026-11-02 14:03:00, which spreadsheets read as a date

  function summaryCsv(c) {
    var rows = [["Warehouse", "Place", "Student", "Steps done", "Steps total", "Documents closed", "Documents total", "Refused entries", "First activity", "Last activity"]];
    studentRows(c).forEach(function (s) {
      rows.push([s.w, s.p, s.name, s.steps, STEPS_EACH, s.docs, DOCS_EACH, s.errors, iso(s.first), iso(s.last)]);
    });
    return csv(rows);
  }

  function logCsv(c) {
    var rows = [["Time", "Warehouse", "Place", "Student", "Step", "Document", "Line", "SKU entered", "Qty entered", "Bin entered", "Result", "System message"]];
    var step = { rcv: "Receive", put: "Put away", pick: "Pick", ship: "Pack & ship", err: "Refused" };
    var label = { ok: "Done", err: "Refused", short: "Not enough in bin", dup: "Repeat (ignored)" };
    for (var w = 1; w <= c.info.warehouses; w++) {
      var log = (c.log && c.log["w" + w]) || {}, r = replay(log);
      r.keys.forEach(function (k) {
        var e = log[k], res = r.results[k];
        rows.push([iso(e.at), w, e.p, e.name, step[e.t] || e.t, e.doc, e.t === "ship" ? "" : e.line + 1, e.sku, e.t === "ship" ? "" : e.qty, e.bin, label[res], e.why || ""]);
      });
    }
    return csv(rows);
  }

  function downloadFile(name, text) {
    var url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
    var a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function setupTeacher() {
    var today = function () { return isoDate(new Date()); };
    $("tSummary").addEventListener("click", function () { if (cls) downloadFile("wms-" + me.code + "-students-" + today() + ".csv", summaryCsv(cls)); });
    $("tLog").addEventListener("click", function () { if (cls) downloadFile("wms-" + me.code + "-transactions-" + today() + ".csv", logCsv(cls)); });
    $("tCopy").addEventListener("click", function () {
      var input = $("tLink");
      var done = function () { $("tCopied").textContent = "Link copied"; };
      try {
        navigator.clipboard.writeText(input.value).then(done, function () { input.select(); $("tCopied").textContent = "Press Ctrl+C (or Cmd+C) to copy"; });
      } catch (err) { input.select(); $("tCopied").textContent = "Press Ctrl+C (or Cmd+C) to copy"; }
    });
    $("tDelete").addEventListener("click", function () {
      var code = me.code;
      if (!window.confirm("Delete WMS class " + code + "? All its students, stock and transactions will be removed. Download the results first if you need them. This can't be undone.")) return;
      stop();
      send("PUT", "wmsClasses/" + code, null).then(function () {
        leave();
        status("Class " + code + " was deleted.");
      }, function (err) {
        openTeacher();
        status("Couldn't delete the class. " + (err.message === "refused" ? "Check that the latest database rules are published." : err.message));
      });
    });
    $("tClose").addEventListener("click", function () { leave(true); });
  }

  setupIntro();
  setupStudent();
  setupTeacher();
  showIntro();
})();
