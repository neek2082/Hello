// Warehouse Practice (WMS): students run a shared practice warehouse like a real warehouse management system.
// Students and lecturers sign in with the accounts the lecturer hands out (WMS_Student_001…, WMS_Faci_001…).
// Each student account has a fixed warehouse (Students 001–006 = Warehouse 1, 007–012 = Warehouse 2…) and a
// place (1–6), which decides their 3 purchase orders and 3 sales orders. Lecturer accounts see every warehouse.
// Each student receives and puts away every purchase-order line, picks every sales-order line, then packs and
// ships each sales order. Data lives in the WMS's own Firebase Realtime Database, reached with plain web requests.
(function () {
  // Address of the WMS's own Firebase Realtime Database (project "my-second-project-72735", Singapore).
  var DB_URL = "https://my-second-project-72735-default-rtdb.asia-southeast1.firebasedatabase.app";
  // The project's web key for signing in. It is meant to be public: what each account may do is decided
  // by the database rules (firebase/wms.rules.json), not by this key.
  var API_KEY = "";
  var LOGIN_DOMAIN = "wms.example"; // turns usernames into account names; ".example" can never receive email

  var MAX_WAREHOUSES = 10; // 60 student accounts, 6 to a warehouse
  var PLACES = 6;       // students per warehouse

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

  // Signed-in reading and writing (js/firebase-login.js). Where things are kept:
  //   roster/<account id>        who an account is: { role: "student" or "faci", name, w: "w1"…, p: 1–6 }
  //   wms/log/w<n>/<entry>       Warehouse n's transaction log (add-only)
  var login = API_KEY && window.FirebaseLogin ? FirebaseLogin({ apiKey: API_KEY, domain: LOGIN_DOMAIN, saveKey: "wmsLogin" }) : null;
  var db = login ? FirebaseData(DB_URL, login) : null;
  function send(method, path, body) {
    if (method === "GET") return db.get(path);
    if (method === "PUT") return db.put(path, body);
    if (method === "POST") return db.post(path, body);
    return db.update(path, body);
  }
  function watch(path, fn, onStatus) { return db.watch(path, fn, onStatus); }

  /* ---------- Page ---------- */

  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function clock(ms) { return ms ? new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : ""; }
  function stamp(ms) { return ms ? new Date(ms).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""; }
  function isoDate(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }

  var stopWatching = null, me = blankMe(), wlog = {}, cls = null;
  var view = "dash", sel = "", pending = {}, msg = null; // student's current screen, selected document, last system message
  var msgSeq = 0; // each new system message gets the next number

  function blankMe() { return { kind: "", w: 0, p: 0, name: "", uid: "" }; }
  function base() { return "wms"; }

  function status(msg) {
    $("status").textContent = msg || "";
    $("status").hidden = !msg;
  }
  function show(id) { ["intro", "student", "teacher"].forEach(function (s) { $(s).hidden = s !== id; }); }
  function stop() {
    if (stopWatching) stopWatching();
    stopWatching = null;
  }

  // Back to the start page. Students and lecturers stay signed in unless signOut is true.
  function leave(signOut) {
    stop();
    if (signOut && login) login.signOut();
    me = blankMe();
    cls = null;
    wlog = {};
    view = "dash";
    sel = "";
    pending = {};
    msg = null;
    showIntro();
  }

  /* ----- Start screen: sign in ----- */

  function showIntro() {
    show("intro");
    var u = login && login.user();
    $("signInForm").hidden = !login || !!u;
    $("signedIn").hidden = !u;
    if (u) $("signedInName").textContent = u.username;
  }

  // Who this account is, from the roster the lecturer set up: a lecturer, or a student with a warehouse and place.
  function enterAs(u) {
    status("Opening…");
    return send("GET", "roster/" + u.uid).then(function (r) {
      if (!r) throw new Error("This account isn't set up for the WMS. Please ask your lecturer.");
      status("");
      me = blankMe();
      me.uid = u.uid;
      me.name = r.name || u.username;
      if (r.role === "faci") {
        me.kind = "lecturer";
        openTeacher();
      } else {
        me.kind = "student";
        me.w = Number(String(r.w).replace(/\D/g, ""));
        me.p = Number(r.p);
        openStudent();
      }
    });
  }

  function setupIntro() {
    if (!login) {
      $("offlineNote").hidden = false;
      $("signInForm").hidden = true;
    }
    $("signInForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var name = $("loginName").value.trim(), pass = $("loginPass").value;
      if (!name || !pass) { status("Please enter your username and password."); return; }
      $("signInBtn").disabled = true;
      status("Signing in…");
      login.signIn(name, pass).then(function (u) {
        $("loginPass").value = "";
        return enterAs(u);
      }).catch(function (err) {
        status(err.message === "refused" ? "This account can't open the WMS. Please ask your lecturer." : err.message || "Couldn't sign in.");
      }).then(function () { $("signInBtn").disabled = false; });
    });
    $("continueBtn").addEventListener("click", function () {
      enterAs(login.user()).catch(function (err) { status(err.message); if (!login.user()) showIntro(); });
    });
    $("introSignOut").addEventListener("click", function () { leave(true); });
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
    show("student");
    view = "dash";
    sel = "";
    msg = null;
    $("sWho").textContent = me.name;
    $("sWhere").textContent = "Warehouse " + me.w + " · Place " + me.p;
    stopWatching = watch(base() + "/log/w" + me.w, function (log) {
      // An empty log after work was done means the lecturer reset the warehouses.
      if (!log && Object.keys(wlog).length) {
        view = "dash";
        sel = "";
        pending = {};
        msg = { seq: ++msgSeq, kind: "info", text: "Your lecturer reset the warehouses. Everything starts again from the beginning." };
      }
      wlog = log || {};
      renderStudent();
    }, status);
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
    var entry = { t: step, p: me.p, name: me.name, uid: me.uid, doc: docId, line: 0, sku: sku, qty: isFinite(qty) ? qty : 0, bin: bin, at: SERVER_TIME };
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
      msg = { seq: ++msgSeq, kind: "warn", text: err.message === "refused" ? "Not saved: the system refused it. Try signing out and in again." : err.message };
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
    $("leaveStudent").addEventListener("click", function () { leave(true); status("You have signed out."); });
  }

  /* ----- Lecturer ----- */

  function openTeacher() {
    stop();
    cls = { log: {}, roster: {} };
    // The list of accounts (who is in which warehouse) is read once; the transaction logs are followed live.
    send("GET", "roster").then(function (roster) {
      cls.roster = roster || {};
      renderTeacher();
    }).catch(function (err) { status("Couldn't load the student list. " + (err.message === "refused" ? "This account isn't a lecturer account." : err.message)); });
    stopWatching = watch(base() + "/log", function (log) {
      cls.log = log || {};
      renderTeacher();
    }, status);
    renderTeacher();
  }

  // Every student account, in warehouse and place order, with their progress from the log.
  function studentRows(c) {
    var people = Object.keys(c.roster || {}).map(function (id) { return c.roster[id]; })
      .filter(function (r) { return r && r.role === "student" && r.w && r.p >= 1 && r.p <= PLACES; })
      .map(function (r) { return { w: Number(String(r.w).replace(/\D/g, "")), p: Number(r.p), name: r.name }; })
      .sort(function (a, b) { return a.w - b.w || a.p - b.p; });
    var replays = {};
    return people.map(function (s) {
      var r = replays[s.w] || (replays[s.w] = replay(c.log && c.log["w" + s.w]));
      s.steps = r.steps[s.p] || 0;
      s.docs = docsClosed(r, s.p);
      s.errors = r.errors[s.p] || 0;
      s.first = r.first[s.p];
      s.last = r.last[s.p];
      return s;
    });
  }

  function renderTeacher() {
    show("teacher");
    var c = cls;
    var rows = studentRows(c), started = rows.filter(function (s) { return s.last; }).length;
    var finished = rows.filter(function (s) { return s.steps === STEPS_EACH; }).length;
    $("tCounts").textContent = started + " of " + rows.length + " students started · " + finished + " finished all " + STEPS_EACH +
      " steps · " + MAX_WAREHOUSES + " warehouses";
    var html = "";
    for (var w = 1; w <= MAX_WAREHOUSES; w++) {
      var log = (c.log && c.log["w" + w]) || {}, r = replay(log);
      var mine = rows.filter(function (s) { return s.w === w; });
      var done = mine.filter(function (s) { return s.steps === STEPS_EACH; }).length;
      var active = mine.some(function (s) { return s.last; });
      html += '<li class="wm-card wm-house"><h3>Warehouse ' + w + ' <span class="wm-hint">' + (active ? done + " of " + mine.length + " finished" : "Not started") + "</span></h3>" +
        '<div class="wm-scroll"><table class="wm-table"><thead><tr><th>Place</th><th>Student</th><th>Steps</th><th>Documents closed</th><th>Refused entries</th><th>Last activity</th></tr></thead><tbody>' +
        (mine.length ? mine.map(function (s) {
          return "<tr><td>" + s.p + "</td><td>" + esc(s.name) + "</td><td>" + s.steps + "/" + STEPS_EACH + (s.steps === STEPS_EACH ? " ✓" : "") +
            "</td><td>" + s.docs + "/" + DOCS_EACH + "</td><td>" + s.errors + "</td><td>" + (s.last ? stamp(s.last) : '<span class="wm-hint">Not started</span>') + "</td></tr>";
        }).join("") : '<tr><td colspan="6">No student accounts in this warehouse.</td></tr>') + "</tbody></table></div>" +
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
    var any = Object.keys(c.log || {}).length > 0;
    $("tSummary").disabled = !rows.length;
    $("tLog").disabled = !any;
    $("tReset").disabled = !any;
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
    for (var w = 1; w <= MAX_WAREHOUSES; w++) {
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
    $("tSummary").addEventListener("click", function () { if (cls) downloadFile("wms-students-" + today() + ".csv", summaryCsv(cls)); });
    $("tLog").addEventListener("click", function () { if (cls) downloadFile("wms-transactions-" + today() + ".csv", logCsv(cls)); });
    $("tReset").addEventListener("click", function () {
      if (!window.confirm("Reset all warehouses? Every transaction is removed and all stock goes back to the start, ready for the next class. Download the results first if you need them. This can't be undone.")) return;
      send("PUT", base() + "/log", null).then(function () {
        status("All warehouses were reset.");
      }, function (err) {
        status("Couldn't reset the warehouses. " + (err.message === "refused" ? "This account isn't a lecturer account." : err.message));
      });
    });
    $("tSignOut").addEventListener("click", function () { leave(true); status("You have signed out."); });
  }

  setupIntro();
  setupStudent();
  setupTeacher();
  if (login && login.user()) {
    // Signed in on this device before: go straight back to the warehouse or the board.
    enterAs(login.user()).catch(function (err) { status(err.message === "refused" ? "This account can't open the WMS. Please ask your lecturer." : err.message); showIntro(); });
  } else {
    showIntro();
  }
})();
