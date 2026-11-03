// Warehouse Practice (WMS): students receive and ship stock in a shared practice warehouse.
// A lecturer starts a class for set lesson days; students join with the class code and are given
// a warehouse (6 students each) and a place (1–6), which decides their 3 receiving and 3 shipping orders.
// Data lives in the same Firebase Realtime Database as the Beer Game, reached with plain web requests (no library).
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

  // The product catalogue. "start" is how many cartons each warehouse has before anyone works.
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
  // Each line is [SKU code, quantity].
  var ORDER_SETS = [
    [
      { id: "IN-1-1", type: "in", partner: "FreshCo Beverages", lines: [["SNK-203", 8], ["BEV-103", 12]] },
      { id: "IN-1-2", type: "in", partner: "Golden Grains", lines: [["BEV-101", 10], ["BEV-102", 4]] },
      { id: "IN-1-3", type: "in", partner: "Pacific Foods", lines: [["SNK-203", 4], ["HOU-401", 10]] },
      { id: "OUT-1-1", type: "out", partner: "Mart 7 Tampines", lines: [["SNK-201", 4], ["BEV-101", 8]] },
      { id: "OUT-1-2", type: "out", partner: "FairBuy Bishan", lines: [["GRO-301", 5], ["BEV-102", 4]] },
      { id: "OUT-1-3", type: "out", partner: "Daily Needs Yishun", lines: [["GRO-303", 4], ["GRO-301", 10]] }
    ],
    [
      { id: "IN-2-1", type: "in", partner: "Island Snacks Ltd", lines: [["BEV-102", 12], ["SNK-201", 12]] },
      { id: "IN-2-2", type: "in", partner: "CleanHome Supplies", lines: [["HOU-401", 10], ["BEV-101", 10]] },
      { id: "IN-2-3", type: "in", partner: "Lion City Traders", lines: [["GRO-301", 5], ["BEV-101", 4]] },
      { id: "OUT-2-1", type: "out", partner: "QuickShop Jurong", lines: [["GRO-303", 6], ["BEV-103", 8]] },
      { id: "OUT-2-2", type: "out", partner: "CornerMart Bedok", lines: [["BEV-103", 4], ["GRO-303", 10]] },
      { id: "OUT-2-3", type: "out", partner: "ValueStore Clementi", lines: [["SNK-202", 12], ["GRO-303", 5]] }
    ],
    [
      { id: "IN-3-1", type: "in", partner: "Golden Grains", lines: [["BEV-102", 10], ["HOU-401", 12]] },
      { id: "IN-3-2", type: "in", partner: "Pacific Foods", lines: [["SNK-201", 4], ["SNK-203", 10]] },
      { id: "IN-3-3", type: "in", partner: "FreshCo Beverages", lines: [["BEV-102", 4], ["HOU-401", 10]] },
      { id: "OUT-3-1", type: "out", partner: "FairBuy Bishan", lines: [["SNK-201", 12], ["GRO-302", 10]] },
      { id: "OUT-3-2", type: "out", partner: "Daily Needs Yishun", lines: [["GRO-301", 8], ["SNK-203", 10]] },
      { id: "OUT-3-3", type: "out", partner: "Mart 7 Tampines", lines: [["GRO-302", 6], ["SNK-203", 5]] }
    ],
    [
      { id: "IN-4-1", type: "in", partner: "CleanHome Supplies", lines: [["BEV-103", 4], ["SNK-201", 10]] },
      { id: "IN-4-2", type: "in", partner: "Lion City Traders", lines: [["SNK-202", 8], ["GRO-303", 6]] },
      { id: "IN-4-3", type: "in", partner: "Island Snacks Ltd", lines: [["GRO-302", 10], ["SNK-202", 4]] },
      { id: "OUT-4-1", type: "out", partner: "CornerMart Bedok", lines: [["BEV-102", 8], ["GRO-303", 5]] },
      { id: "OUT-4-2", type: "out", partner: "ValueStore Clementi", lines: [["SNK-203", 8], ["BEV-103", 8]] },
      { id: "OUT-4-3", type: "out", partner: "QuickShop Jurong", lines: [["BEV-101", 10], ["BEV-102", 10]] }
    ],
    [
      { id: "IN-5-1", type: "in", partner: "Pacific Foods", lines: [["SNK-203", 12], ["HOU-402", 6]] },
      { id: "IN-5-2", type: "in", partner: "FreshCo Beverages", lines: [["HOU-401", 10], ["GRO-302", 8]] },
      { id: "IN-5-3", type: "in", partner: "Golden Grains", lines: [["BEV-102", 6], ["HOU-402", 8]] },
      { id: "OUT-5-1", type: "out", partner: "Daily Needs Yishun", lines: [["HOU-402", 4], ["BEV-102", 12]] },
      { id: "OUT-5-2", type: "out", partner: "Mart 7 Tampines", lines: [["SNK-202", 12], ["HOU-401", 8]] },
      { id: "OUT-5-3", type: "out", partner: "FairBuy Bishan", lines: [["SNK-202", 12], ["GRO-301", 6]] }
    ],
    [
      { id: "IN-6-1", type: "in", partner: "Lion City Traders", lines: [["BEV-101", 6], ["GRO-302", 5]] },
      { id: "IN-6-2", type: "in", partner: "Island Snacks Ltd", lines: [["HOU-401", 8], ["BEV-102", 4]] },
      { id: "IN-6-3", type: "in", partner: "CleanHome Supplies", lines: [["SNK-201", 5], ["SNK-202", 12]] },
      { id: "OUT-6-1", type: "out", partner: "ValueStore Clementi", lines: [["SNK-201", 8], ["GRO-301", 8]] },
      { id: "OUT-6-2", type: "out", partner: "QuickShop Jurong", lines: [["BEV-102", 8], ["BEV-103", 8]] },
      { id: "OUT-6-3", type: "out", partner: "CornerMart Bedok", lines: [["GRO-303", 5], ["SNK-202", 8]] }
    ]
  ];

  /* ---------- Stock rules ---------- */

  // Every warehouse keeps a log of transactions, added to and never changed. Stock is worked out by replaying
  // the log in order, so every screen agrees and two students can never overwrite each other's change:
  // if two students try to ship the last cartons at the same moment, the one logged first gets them and the
  // other is told there isn't enough stock.
  function skuByCode(code) { for (var i = 0; i < SKUS.length; i++) if (SKUS[i].code === code) return SKUS[i]; return null; }
  function orderSet(place) { return ORDER_SETS[(place - 1) % ORDER_SETS.length]; }
  function orderById(place, id) { return orderSet(place).filter(function (o) { return o.id === id; })[0] || null; }
  var LINES_EACH = ORDER_SETS[0].reduce(function (n, o) { return n + o.lines.length; }, 0);
  var ORDERS_EACH = ORDER_SETS[0].length;

  function replay(log) {
    var stock = {}, done = {}, results = {}, errors = {}, first = {}, last = {}, keys = Object.keys(log || {}).sort();
    SKUS.forEach(function (s) { stock[s.code] = s.start; });
    for (var p = 1; p <= PLACES; p++) { done[p] = {}; errors[p] = 0; }
    keys.forEach(function (key) {
      var e = log[key], p = e.p;
      if (!done[p]) return;
      if (!first[p] || e.at < first[p]) first[p] = e.at;
      if (!last[p] || e.at > last[p]) last[p] = e.at;
      var order = orderById(p, e.order), line = order && order.lines[e.line];
      if (e.t === "err" || !line || line[0] !== e.sku || line[1] !== e.qty) {
        errors[p]++;
        results[key] = "err";
        return;
      }
      var id = e.order + "/" + e.line;
      if (done[p][id]) { results[key] = "dup"; return; }
      if (order.type === "out" && stock[line[0]] < line[1]) { results[key] = "short"; return; }
      stock[line[0]] += order.type === "in" ? line[1] : -line[1];
      done[p][id] = key;
      results[key] = "ok";
    });
    return { stock: stock, done: done, results: results, errors: errors, first: first, last: last, keys: keys };
  }

  function linesDone(r, p) { return Object.keys(r.done[p] || {}).length; }
  function ordersDone(r, p) {
    return orderSet(p).filter(function (o) { return o.lines.every(function (l, i) { return r.done[p][o.id + "/" + i]; }); }).length;
  }

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
  var selectedOrder = "", pending = {}, lastResult = "";

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
    selectedOrder = "";
    pending = {};
    lastResult = "";
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

  function openStudent() {
    stop();
    save();
    show("student");
    $("sTitle").textContent = "Warehouse " + me.w + " · " + me.name;
    $("sSub").textContent = "Class " + me.code + " · Place " + me.p + " of " + PLACES;
    send("GET", base() + "/info").then(function (inf) {
      if (!inf) { leave(); status("This class no longer exists."); return; }
      info = inf;
      $("sOpen").textContent = "Open " + openText(inf) + ".";
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
  }

  function renderStudent() {
    var r = replay(wlog), p = me.p, orders = orderSet(p);
    var lines = linesDone(r, p), done = ordersDone(r, p);
    $("sProgress").textContent = lines + " of " + LINES_EACH + " lines · " + done + " of " + ORDERS_EACH + " orders done · " +
      r.errors[p] + " error" + (r.errors[p] === 1 ? "" : "s");
    $("sAllDone").hidden = lines < LINES_EACH;

    $("orderList").innerHTML = orders.map(function (o) {
      var n = o.lines.filter(function (l, i) { return r.done[p][o.id + "/" + i]; }).length;
      var state = n === o.lines.length ? "Done" : n ? n + " of " + o.lines.length + " lines" : "Not started";
      return '<li><button type="button" class="wm-order' + (o.id === selectedOrder ? " wm-selected" : "") + '" data-order="' + o.id + '"' +
        (o.id === selectedOrder ? ' aria-current="true"' : "") + ">" +
        '<span class="wm-order-id">' + o.id + "</span>" +
        '<span class="wm-order-type">' + (o.type === "in" ? "Receive from " : "Ship to ") + esc(o.partner) + "</span>" +
        '<span class="wm-order-state" data-done="' + (n === o.lines.length) + '">' + (n === o.lines.length ? "✓ " : "") + state + "</span></button></li>";
    }).join("");

    // Pending posts: tell the student what happened once their entry comes back in the log.
    Object.keys(pending).forEach(function (key) {
      var res = r.results[key];
      if (!res) return;
      var pend = pending[key];
      delete pending[key];
      if (res === "ok") lastResult = pend.okText;
      else if (res === "short") lastResult = "Not enough stock: a classmate shipped it first. Wait for a delivery, then try again.";
      else if (res === "dup") lastResult = "That line was already done.";
    });

    renderOrder(r);
    renderStock(r);
    renderActivity(r);
  }

  function renderOrder(r) {
    var o = selectedOrder && orderById(me.p, selectedOrder);
    $("orderPanel").hidden = !o;
    if (!o) return;
    var p = me.p, isIn = o.type === "in";
    $("oTitle").textContent = o.id + ": " + (isIn ? "Receiving from " : "Shipping to ") + o.partner;
    $("oHelp").textContent = isIn
      ? "Goods have arrived. For each line, type the product's SKU code (find it in the stock list) and the quantity received, then post it."
      : "A store ordered these goods. For each line, type the product's SKU code (find it in the stock list) and the quantity picked, then post it.";
    var left = 0;
    $("oLines").innerHTML = "<thead><tr><th>Line</th><th>Product</th><th>Bin</th><th>Qty</th><th>Status</th></tr></thead><tbody>" +
      o.lines.map(function (l, i) {
        var sku = skuByCode(l[0]), isDone = !!r.done[p][o.id + "/" + i];
        if (!isDone) left++;
        return "<tr" + (isDone ? "" : ' class="wm-current"') + "><td>" + (i + 1) + "</td><td>" + esc(sku.name) + "</td><td class=\"wm-code\">" + sku.bin + "</td><td>" + l[1] +
          "</td><td>" + (isDone ? "✓ Posted" : "To do") + "</td></tr>";
      }).join("") + "</tbody>";
    $("lineForm").hidden = !left;
    $("oDone").hidden = !!left;
    $("lineLabel").textContent = left === 1 ? "1 line to do" : left + " lines to do, in any order";
    $("postBtn").textContent = isIn ? "Post receipt" : "Post pick";
    $("lineResult").textContent = lastResult;
    $("lineResult").hidden = !lastResult;
  }

  function renderStock(r) {
    $("stockTable").innerHTML = "<thead><tr><th>SKU code</th><th>Product</th><th>Bin</th><th>On hand</th></tr></thead><tbody>" +
      SKUS.map(function (s) {
        var n = r.stock[s.code];
        return "<tr><td class=\"wm-code\">" + s.code + "</td><td>" + esc(s.name) + "</td><td class=\"wm-code\">" + s.bin + "</td><td>" + n + (n < 5 ? ' <span class="wm-low">Low</span>' : "") + "</td></tr>";
      }).join("") + "</tbody>";
  }

  function describe(e, res) {
    var order = orderById(e.p, e.order), isIn = order && order.type === "in";
    if (res === "err") return "entered " + esc(e.sku || "?") + " × " + esc(e.qty) + " on " + esc(e.order) + " (wrong, not posted)";
    if (res === "short") return "tried to pick " + e.qty + " × " + e.sku + " (" + esc(e.order) + "): not enough stock";
    if (res === "dup") return "posted " + esc(e.order) + " line " + (e.line + 1) + " again (ignored)";
    return (isIn ? "received " : "picked ") + e.qty + " × " + e.sku + " (" + e.order + ")";
  }

  function renderActivity(r) {
    var recent = r.keys.slice(-10).reverse();
    $("activity").innerHTML = recent.length ? recent.map(function (k) {
      var e = wlog[k];
      return "<li><span class=\"wm-time\">" + clock(e.at) + "</span> <strong>" + esc(e.name) + "</strong> " + describe(e, r.results[k]) + "</li>";
    }).join("") : "<li>No activity yet.</li>";
  }

  function setupStudent() {
    $("orderList").addEventListener("click", function (e) {
      var btn = e.target.closest("[data-order]");
      if (!btn) return;
      selectedOrder = btn.getAttribute("data-order");
      lastResult = "";
      renderStudent();
      $("lineSku").value = "";
      $("lineQty").value = "";
      if (!$("lineForm").hidden) $("lineSku").focus();
    });
    $("lineForm").addEventListener("submit", function (e) {
      e.preventDefault();
      // Like scanning a carton: the SKU code finds the line it belongs to, then the quantity must match.
      var o = orderById(me.p, selectedOrder), r = replay(wlog);
      var sku = $("lineSku").value.trim().toUpperCase(), qty = Number($("lineQty").value);
      var i = -1;
      o.lines.forEach(function (l, n) { if (i < 0 && l[0] === sku && !r.done[me.p][o.id + "/" + n]) i = n; });
      var line = o.lines[i];
      var entry = { p: me.p, name: me.name, order: o.id, line: Math.max(i, 0), sku: sku, qty: qty, at: SERVER_TIME };
      var match = !!line && qty === line[1];
      if (!match) {
        entry.t = "err";
        lastResult = !line
          ? "That SKU code isn't on a line still to do in this order. Look up the product's code in the stock list."
          : "That quantity doesn't match the line for " + sku + ". Check the order and count again.";
      } else {
        entry.t = o.type;
        if (o.type === "out" && r.stock[sku] < qty) {
          lastResult = "Not enough stock of " + sku + " to pick " + qty + ". Wait for a delivery, then try again.";
          renderStudent();
          return;
        }
        lastResult = "Posting…";
      }
      $("postBtn").disabled = true;
      send("POST", base() + "/log/w" + me.w, entry).then(function (res) {
        if (match) pending[res.name] = { okText: (o.type === "in" ? "Received " : "Picked ") + qty + " × " + sku + ". Stock updated." };
        $("lineSku").value = "";
        $("lineQty").value = "";
        renderStudent();
      }, function (err) {
        lastResult = err.message === "refused" ? "Not saved: the class is closed (open " + openText(info) + ")." : err.message;
        renderStudent();
      }).then(function () { $("postBtn").disabled = false; $("lineSku").focus(); });
      renderStudent();
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
        rows.push({ w: w, p: p, name: s.name, lines: linesDone(r, p), orders: ordersDone(r, p), errors: r.errors[p], first: r.first[p], last: r.last[p] });
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
    var rows = studentRows(c), finished = rows.filter(function (s) { return s.lines === LINES_EACH; }).length;
    $("tCounts").textContent = rows.length + " student" + (rows.length === 1 ? "" : "s") + " joined · " + finished + " finished all " + LINES_EACH +
      " lines · " + c.info.warehouses + " warehouses (room for " + c.info.warehouses * PLACES + ")";
    var html = "";
    for (var w = 1; w <= c.info.warehouses; w++) {
      var log = (c.log && c.log["w" + w]) || {}, r = replay(log);
      var mine = rows.filter(function (s) { return s.w === w; });
      html += '<li class="wm-card wm-house"><h3>Warehouse ' + w + "</h3>" +
        '<div class="wm-scroll"><table class="wm-table"><thead><tr><th>Place</th><th>Student</th><th>Lines</th><th>Orders</th><th>Errors</th><th>Last activity</th></tr></thead><tbody>' +
        (mine.length ? mine.map(function (s) {
          return "<tr><td>" + s.p + "</td><td>" + esc(s.name) + "</td><td>" + s.lines + "/" + LINES_EACH + (s.lines === LINES_EACH ? " ✓" : "") +
            "</td><td>" + s.orders + "/" + ORDERS_EACH + "</td><td>" + s.errors + "</td><td>" + stamp(s.last) + "</td></tr>";
        }).join("") : '<tr><td colspan="6">No students yet.</td></tr>') + "</tbody></table></div>" +
        '<details class="wm-more"><summary>Stock now</summary><div class="wm-scroll"><table class="wm-table"><thead><tr><th>SKU code</th><th>Product</th><th>On hand</th></tr></thead><tbody>' +
        SKUS.map(function (s) { return "<tr><td class=\"wm-code\">" + s.code + "</td><td>" + esc(s.name) + "</td><td>" + r.stock[s.code] + "</td></tr>"; }).join("") +
        "</tbody></table></div></details>" +
        '<details class="wm-more"><summary>Latest activity</summary><ul class="wm-activity">' +
        (r.keys.length ? r.keys.slice(-8).reverse().map(function (k) {
          var e = log[k];
          return "<li><span class=\"wm-time\">" + stamp(e.at) + "</span> <strong>" + esc(e.name) + "</strong> " + describe(e, r.results[k]) + "</li>";
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
    var rows = [["Warehouse", "Place", "Student", "Lines done", "Lines total", "Orders done", "Orders total", "Errors", "First activity", "Last activity"]];
    studentRows(c).forEach(function (s) {
      rows.push([s.w, s.p, s.name, s.lines, LINES_EACH, s.orders, ORDERS_EACH, s.errors, iso(s.first), iso(s.last)]);
    });
    return csv(rows);
  }

  function logCsv(c) {
    var rows = [["Time", "Warehouse", "Place", "Student", "Order", "Line", "Type", "SKU entered", "Qty entered", "Result", "Stock after"]];
    var label = { ok: "Posted", err: "Error (wrong SKU or qty)", short: "Not enough stock", dup: "Duplicate (ignored)" };
    for (var w = 1; w <= c.info.warehouses; w++) {
      var log = (c.log && c.log["w" + w]) || {}, keys = Object.keys(log).sort(), stock = {}, r = replay(log);
      SKUS.forEach(function (s) { stock[s.code] = s.start; });
      keys.forEach(function (k) {
        var e = log[k], res = r.results[k], order = orderById(e.p, e.order);
        if (res === "ok") stock[e.sku] += order.type === "in" ? e.qty : -e.qty;
        rows.push([iso(e.at), w, e.p, e.name, e.order, e.line + 1, order ? (order.type === "in" ? "Receive" : "Ship") : "", e.sku, e.qty, label[res],
          res === "ok" ? stock[e.sku] : ""]);
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
