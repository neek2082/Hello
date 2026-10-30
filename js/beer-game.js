// Beer Game: four players each run one business in a beer supply chain, one week at a time.
// Online games are shared through a Firebase Realtime Database using plain web requests (no library).
(function () {
  // Address of the Firebase Realtime Database, e.g.
  // "https://my-project-default-rtdb.asia-southeast1.firebasedatabase.app".
  // Leave empty until the database exists: practice mode still works without it.
  var DB_URL = "";

  var WEEKS = 20;
  var START_STOCK = 12;
  var START_FLOW = 4;   // cases a week moving through the chain when the game starts
  var STOCK_COST = 0.5; // $ per case in stock, per week
  var OWED_COST = 1;    // $ per case owed but not yet delivered, per week
  var CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  var SAVE_KEY = "beerGame";

  // Closest to the shoppers first. Beer flows down this list; orders flow up it.
  var ROLES = [
    { key: "retailer", name: "Retailer", desc: "The shop. Sells beer to shoppers." },
    { key: "wholesaler", name: "Wholesaler", desc: "Supplies the Retailer." },
    { key: "distributor", name: "Distributor", desc: "Supplies the Wholesaler." },
    { key: "factory", name: "Factory", desc: "Brews the beer. Brewing takes 2 weeks." }
  ];

  // Shoppers buy 4 cases a week, then suddenly 8 from week 5 onwards.
  function customerDemand(week) { return week <= 4 ? 4 : 8; }

  /* ---------- Game rules ---------- */

  function copy(o) { return o === undefined ? undefined : JSON.parse(JSON.stringify(o)); }
  function roleName(key) { return ROLES.filter(function (r) { return r.key === key; })[0].name; }
  function roleIndex(key) { for (var i = 0; i < ROLES.length; i++) if (ROLES[i].key === key) return i; return -1; }

  function initialState() {
    var s = {};
    ROLES.forEach(function (r) {
      s[r.key] = { stock: START_STOCK, owed: 0, arriving1: START_FLOW, arriving2: START_FLOW, incoming: START_FLOW,
        received: 0, demand: 0, shipped: 0, weekCost: 0, total: 0 };
    });
    return s;
  }

  // Start of a week: beer arrives, the new order comes in, and as much as possible is shipped.
  function beginWeek(prev, week) {
    var s = copy(prev);
    ROLES.forEach(function (r) {
      var b = s[r.key];
      b.received = b.arriving1;
      b.stock += b.received;
      b.arriving1 = b.arriving2;
      b.arriving2 = 0;
      b.demand = r.key === "retailer" ? customerDemand(week) : b.incoming;
      var due = b.demand + b.owed;
      b.shipped = Math.min(b.stock, due);
      b.stock -= b.shipped;
      b.owed = due - b.shipped;
    });
    // Beer shipped this week reaches the next business down the chain in 2 weeks.
    for (var i = 1; i < ROLES.length; i++) s[ROLES[i - 1].key].arriving2 += s[ROLES[i].key].shipped;
    return s;
  }

  // End of a week: costs are counted and each order moves one step up the chain.
  function endWeek(prev, orders) {
    var s = copy(prev);
    ROLES.forEach(function (r, i) {
      var b = s[r.key];
      b.weekCost = b.stock * STOCK_COST + b.owed * OWED_COST;
      b.total += b.weekCost;
      if (i + 1 < ROLES.length) s[ROLES[i + 1].key].incoming = orders[r.key];
      else b.arriving2 += orders[r.key]; // the Factory's order is brewed and ready in 2 weeks
    });
    return s;
  }

  // How the computer plays: cover this week's order, and close half the gap back to the starting stock.
  function computerOrder(b) { return Math.max(0, Math.round(b.demand + (START_STOCK - b.stock + b.owed) / 2)); }

  function isComputer(g, key) { return !!(g.cpu && g.cpu[key]) || !(g.players && g.players[key]); }

  function ordersThisWeek(g) { return (g.orders && g.orders["w" + g.week]) || {}; }

  function waitingFor(g) {
    var placed = ordersThisWeek(g);
    return ROLES.filter(function (r) { return !isComputer(g, r.key) && placed[r.key] === undefined; });
  }

  // Everything that changes when a week is finished, as one update. It only depends on the game data,
  // so if two players' browsers both finish the same week they write exactly the same thing.
  function finishWeek(g) {
    var w = g.week, placed = ordersThisWeek(g), orders = {}, record = {}, update = {};
    ROLES.forEach(function (r) {
      orders[r.key] = isComputer(g, r.key) ? computerOrder(g.state[r.key]) : placed[r.key];
    });
    var ended = endWeek(g.state, orders);
    ROLES.forEach(function (r) {
      var b = ended[r.key];
      record[r.key] = { order: orders[r.key], demand: b.demand, received: b.received, shipped: b.shipped,
        stock: b.stock, owed: b.owed, cost: b.weekCost };
    });
    update["history/w" + w] = record;
    if (w >= g.weeks) {
      update.state = ended;
      update.status = "done";
    } else {
      update.state = beginWeek(ended, w + 1);
      update.week = w + 1;
    }
    return update;
  }

  /* ---------- Where games are kept ---------- */

  // Sets a value at a slash-separated path inside an object. A null value removes it.
  function setPath(root, path, value) {
    var keys = path.split("/").filter(Boolean);
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

  // Practice games live only in this browser tab.
  function LocalStore() {
    var data = {}, listeners = {};
    function emit(code) {
      var fn = listeners[code];
      if (fn) setTimeout(function () { fn(copy(data[code] || null)); }, 0);
    }
    return {
      get: function (code) { return Promise.resolve(copy(data[code] || null)); },
      put: function (code, path, value) { data[code] = setPath(data[code], path, copy(value)); emit(code); return Promise.resolve(); },
      update: function (code, obj) { data[code] = applyUpdate(data[code] || {}, "", copy(obj)); emit(code); return Promise.resolve(); },
      watch: function (code, fn) { listeners[code] = fn; emit(code); return function () { delete listeners[code]; }; }
    };
  }

  // Online games are kept in the Firebase Realtime Database, read and written with its web address (REST).
  // The live connection is an EventSource: the database sends a message every time the game changes.
  function FirebaseStore(base) {
    function url(code, path) { return base.replace(/\/+$/, "") + "/beerGames/" + code + (path ? "/" + path : "") + ".json"; }
    function send(method, u, body) {
      return fetch(u, { method: method, body: body === undefined ? undefined : JSON.stringify(body) }).then(function (res) {
        if (!res.ok) throw new Error("The game server refused the request (error " + res.status + ").");
        return res.json();
      });
    }
    return {
      get: function (code) { return send("GET", url(code)); },
      put: function (code, path, value) { return send("PUT", url(code, path), value); },
      update: function (code, obj) { return send("PATCH", url(code), obj); },
      watch: function (code, fn, onStatus) {
        var data = null, es = new EventSource(url(code));
        function handle(e, isPatch) {
          var msg = JSON.parse(e.data);
          data = isPatch ? applyUpdate(data || {}, msg.path, msg.data) : setPath(data, msg.path, msg.data);
          fn(copy(data));
        }
        es.addEventListener("put", function (e) { handle(e, false); });
        es.addEventListener("patch", function (e) { handle(e, true); });
        es.addEventListener("cancel", function () { onStatus("This game can no longer be read."); });
        es.onopen = function () { onStatus(""); };
        es.onerror = function () { onStatus("Connection lost. Trying to reconnect…"); };
        return function () { es.close(); };
      }
    };
  }

  /* ---------- Page ---------- */

  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function money(n) { return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function randomId(n, chars) {
    chars = chars || "abcdefghijklmnopqrstuvwxyz0123456789";
    var out = "";
    for (var i = 0; i < n; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
  }

  var online = DB_URL ? FirebaseStore(DB_URL) : null;
  var store = null, stopWatching = null, game = null, finishingWeek = 0, shownWeek = 0;
  var me = { code: "", role: "", id: randomId(12), name: "", practice: false };

  function save() {
    if (me.practice) return;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(me)); } catch (e) { /* not saved: rejoining needs the code */ }
  }
  function loadSaved() {
    try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { return null; }
  }
  function forget() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* nothing saved */ }
  }

  function status(msg) {
    $("status").textContent = msg || "";
    $("status").hidden = !msg;
  }
  function show(id) {
    ["intro", "lobby", "play", "results"].forEach(function (s) { $(s).hidden = s !== id; });
  }
  function playerName(g, key) {
    if (g.cpu && g.cpu[key]) return "Computer";
    return g.players && g.players[key] ? g.players[key].name : "Computer";
  }

  function openGame(code, useStore) {
    if (stopWatching) stopWatching();
    store = useStore;
    me.code = code;
    finishingWeek = 0;
    shownWeek = 0;
    save();
    stopWatching = store.watch(code, onGame, status);
  }

  function leave() {
    if (stopWatching) stopWatching();
    stopWatching = null;
    game = null;
    if (!me.practice) forget();
    me = { code: "", role: "", id: randomId(12), name: "", practice: false };
    status("");
    showIntro();
  }

  function onGame(g) {
    if (!g) {
      status("No game with the code " + me.code + " was found.");
      if (!me.practice) forget();
      showIntro();
      return;
    }
    game = g;
    if (me.role && g.players && g.players[me.role] && g.players[me.role].id !== me.id) {
      status("Someone else took the " + roleName(me.role) + " role. Please choose another.");
      me.role = "";
      save();
    }
    if (g.status === "lobby") renderLobby(g);
    else if (g.status === "playing") { renderPlay(g); maybeFinishWeek(g); }
    else renderResults(g);
  }

  function maybeFinishWeek(g) {
    if (g.status !== "playing" || waitingFor(g).length || finishingWeek === g.week) return;
    finishingWeek = g.week;
    store.update(me.code, finishWeek(g)).catch(function (err) { finishingWeek = 0; status(err.message); });
  }

  /* ----- Start screen ----- */

  function showIntro() {
    show("intro");
    var saved = loadSaved();
    $("rejoin").hidden = !(online && saved && saved.code);
    if (online && saved && saved.code) {
      $("rejoinText").textContent = "You were in game " + saved.code + (saved.role ? " as the " + roleName(saved.role) : "") + ".";
    }
  }

  function setupIntro() {
    $("practiceRole").innerHTML = ROLES.map(function (r) { return '<option value="' + r.key + '">' + r.name + "</option>"; }).join("");
    if (!online) {
      $("offlineNote").hidden = false;
      document.querySelectorAll("#createForm input, #createForm button, #joinForm input, #joinForm button").forEach(function (el) { el.disabled = true; });
    }
    var fromLink = new URLSearchParams(location.search).get("game");
    if (fromLink) $("joinCode").value = fromLink.toUpperCase();

    $("createForm").addEventListener("submit", function (e) {
      e.preventDefault();
      me.name = $("createName").value.trim();
      me.practice = false;
      createGame(5);
    });
    $("joinForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var code = $("joinCode").value.trim().toUpperCase();
      if (!/^[A-Z2-9]{6}$/.test(code)) { status("A game code is 6 letters and numbers, like K7Q2PX."); return; }
      me.name = $("joinName").value.trim();
      me.practice = false;
      me.role = "";
      status("");
      openGame(code, online);
    });
    $("practiceBtn").addEventListener("click", startPractice);
    $("rejoinBtn").addEventListener("click", function () {
      var saved = loadSaved();
      me = saved;
      me.practice = false;
      status("");
      openGame(saved.code, online);
    });
    $("forgetBtn").addEventListener("click", function () { forget(); showIntro(); });
  }

  function newGame() {
    return { created: Date.now(), hostId: me.id, hostName: me.name, weeks: WEEKS, status: "lobby", week: 0 };
  }

  function createGame(triesLeft) {
    var code = randomId(6, CODE_CHARS);
    status("Creating the game…");
    online.get(code).then(function (existing) {
      if (existing) {
        if (triesLeft > 1) return createGame(triesLeft - 1);
        throw new Error("Couldn't find a free game code. Please try again.");
      }
      return online.put(code, "", newGame()).then(function () {
        status("");
        me.role = "";
        openGame(code, online);
      });
    }).catch(function (err) { status(err.message || "Couldn't reach the game server."); });
  }

  function startPractice() {
    me.practice = true;
    me.name = "You";
    me.role = $("practiceRole").value;
    var g = newGame(), cpu = {};
    g.players = {};
    g.players[me.role] = { name: me.name, id: me.id };
    ROLES.forEach(function (r) { if (r.key !== me.role) cpu[r.key] = true; });
    g.cpu = cpu;
    g.status = "playing";
    g.week = 1;
    g.state = beginWeek(initialState(), 1);
    var local = LocalStore();
    status("");
    local.put("PRACTICE", "", g).then(function () { openGame("PRACTICE", local); });
  }

  /* ----- Lobby ----- */

  function renderLobby(g) {
    show("lobby");
    $("lobbyCode").textContent = me.code;
    $("shareLink").value = location.origin + location.pathname + "?game=" + me.code;
    var players = g.players || {};
    $("roleList").innerHTML = ROLES.map(function (r) {
      var p = players[r.key], who;
      if (p && p.id === me.id) who = "<strong>You</strong>";
      else if (p) who = esc(p.name);
      else who = '<button type="button" class="btn" data-role="' + r.key + '">Take this role</button>';
      return '<li class="bg-card bg-role"><div><h3>' + r.name + "</h3><p class=\"bg-hint\">" + r.desc + "</p></div><div>" + who + "</div></li>";
    }).join("");

    var isHost = g.hostId === me.id, count = Object.keys(players).length;
    $("startBtn").hidden = !isHost;
    $("startBtn").disabled = count === 0;
    var note = me.role ? "" : "Choose the business you want to run. ";
    note += isHost
      ? "Press Start when everyone has joined. Any business without a player is run by the computer."
      : "Waiting for " + g.hostName + " to start the game.";
    $("lobbyNote").textContent = note;
  }

  function setupLobby() {
    $("roleList").addEventListener("click", function (e) {
      var key = e.target.getAttribute("data-role");
      if (!key) return;
      var update = {};
      if (me.role) update["players/" + me.role] = null;
      update["players/" + key] = { name: me.name, id: me.id };
      me.role = key;
      save();
      store.update(me.code, update).catch(function (err) { status(err.message); });
    });
    $("copyLink").addEventListener("click", function () {
      var input = $("shareLink");
      var done = function () { $("copied").textContent = "Link copied"; };
      try {
        navigator.clipboard.writeText(input.value).then(done, function () { input.select(); $("copied").textContent = "Press Ctrl+C (or Cmd+C) to copy"; });
      } catch (err) { input.select(); $("copied").textContent = "Press Ctrl+C (or Cmd+C) to copy"; }
    });
    $("startBtn").addEventListener("click", function () {
      var cpu = {}, players = game.players || {};
      ROLES.forEach(function (r) { if (!players[r.key]) cpu[r.key] = true; });
      store.update(me.code, { status: "playing", week: 1, cpu: cpu, state: beginWeek(initialState(), 1) })
        .catch(function (err) { status(err.message); });
    });
    $("leaveLobby").addEventListener("click", function () {
      if (me.role && game && game.players && game.players[me.role] && game.players[me.role].id === me.id) {
        var update = {};
        update["players/" + me.role] = null;
        store.update(me.code, update);
      }
      leave();
    });
  }

  /* ----- Playing ----- */

  function renderPlay(g) {
    show("play");
    if (!me.role) {
      $("playTitle").textContent = "Game " + me.code;
      $("weekLabel").textContent = "Week " + g.week + " of " + g.weeks;
      $("spectator").hidden = false;
      ["numbers", "orderForm", "cpuNote", "myHistoryBox"].forEach(function (id) { $(id).hidden = true; });
      renderWaiting(g);
      return;
    }
    $("spectator").hidden = true;
    var r = ROLES[roleIndex(me.role)], b = g.state[me.role], i = roleIndex(me.role);
    $("playTitle").textContent = "You are the " + r.name;
    $("weekLabel").textContent = "Week " + g.week + " of " + g.weeks;

    var asker = i === 0 ? "Shoppers want" : "The " + ROLES[i - 1].name + " ordered";
    var items = [
      ["Beer arrived", b.received, "cases delivered to you this week"],
      ["New order", b.demand, asker + " this many cases"],
      ["Shipped out", b.shipped, i === 0 ? "cases sold to shoppers" : "cases sent to the " + ROLES[i - 1].name],
      ["Still owed", b.owed, "orders you couldn't fill yet. Costs $1 per case each week"],
      ["In stock", b.stock, "cases on your shelves. Costs $0.50 per case each week"],
      ["On the way to you", b.arriving1 + b.arriving2, b.arriving1 + " next week, " + b.arriving2 + " the week after"],
      ["Your costs so far", money(b.total), "stock and owed costs from past weeks"]
    ];
    $("numbers").hidden = false;
    $("numbers").innerHTML = items.map(function (it) {
      return "<div><dt>" + it[0] + "</dt><dd>" + it[1] + '</dd><dd class="bg-hint">' + it[2] + "</dd></div>";
    }).join("");

    var cpuPlays = !!(g.cpu && g.cpu[me.role]);
    $("cpuNote").hidden = !cpuPlays;
    var placed = ordersThisWeek(g)[me.role];
    var canOrder = !cpuPlays && placed === undefined;
    $("orderForm").hidden = !canOrder;
    $("orderLabel").textContent = i === ROLES.length - 1
      ? "How many cases do you want to brew? They will be ready in 2 weeks."
      : "How many cases do you want to order from the " + ROLES[i + 1].name + "?";
    if (shownWeek !== g.week) {
      shownWeek = g.week;
      $("orderInput").value = "";
      if (canOrder && document.activeElement && document.activeElement.tagName !== "INPUT") $("orderInput").focus({ preventScroll: true });
    }
    renderWaiting(g);
    renderMyHistory(g);
  }

  function renderWaiting(g) {
    var placed = ordersThisWeek(g)[me.role], waiting = waitingFor(g);
    var mine = me.role && !(g.cpu && g.cpu[me.role]) && placed === undefined;
    var others = waiting.filter(function (r) { return r.key !== me.role; });
    $("waiting").hidden = mine || (!others.length && !me.role);
    var text = placed !== undefined ? "Order sent: " + placed + " cases. " : "";
    if (others.length) {
      text += "Waiting for: " + others.map(function (r) { return r.name + " (" + playerName(g, r.key) + ")"; }).join(", ") + ".";
    } else if (!mine) {
      text += "Moving to the next week…";
    }
    $("waitingText").textContent = text;
    $("autoBtn").hidden = !others.length;
  }

  function renderMyHistory(g) {
    var rows = [];
    for (var w = 1; w < g.week; w++) {
      var h = g.history && g.history["w" + w] && g.history["w" + w][me.role];
      if (h) rows.push("<tr><td>" + w + "</td><td>" + h.demand + "</td><td>" + h.order + "</td><td>" + h.stock + "</td><td>" + h.owed + "</td><td>" + money(h.cost) + "</td></tr>");
    }
    $("myHistoryBox").hidden = !rows.length;
    $("myHistory").innerHTML = "<thead><tr><th>Week</th><th>Order in</th><th>You ordered</th><th>Stock</th><th>Owed</th><th>Cost</th></tr></thead><tbody>" +
      rows.reverse().join("") + "</tbody>";
  }

  function setupPlay() {
    $("orderForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var n = Math.round(Number($("orderInput").value));
      if (!isFinite(n) || n < 0 || n > 999 || $("orderInput").value === "") { status("Please enter a whole number from 0 to 999."); return; }
      status("");
      $("orderForm").hidden = true; // stops a double send while the order is on its way
      store.put(me.code, "orders/w" + game.week + "/" + me.role, n).catch(function (err) {
        $("orderForm").hidden = false;
        status(err.message);
      });
    });
    $("autoBtn").addEventListener("click", function () {
      var update = {};
      waitingFor(game).forEach(function (r) { if (r.key !== me.role) update["cpu/" + r.key] = true; });
      store.update(me.code, update).catch(function (err) { status(err.message); });
    });
    $("takeBack").addEventListener("click", function () {
      var update = {};
      update["cpu/" + me.role] = null;
      store.update(me.code, update).catch(function (err) { status(err.message); });
    });
    $("leavePlay").addEventListener("click", leave);
  }

  /* ----- Results ----- */

  function seriesFrom(g) {
    var weeks = [], demand = [], orders = {};
    ROLES.forEach(function (r) { orders[r.key] = []; });
    for (var w = 1; w <= g.weeks; w++) {
      var h = g.history && g.history["w" + w];
      if (!h) break;
      weeks.push(w);
      demand.push(customerDemand(w));
      ROLES.forEach(function (r) { orders[r.key].push(h[r.key].order); });
    }
    return { weeks: weeks, demand: demand, orders: orders };
  }

  function renderResults(g) {
    show("results");
    var team = 0;
    $("costTable").innerHTML = "<thead><tr><th>Business</th><th>Played by</th><th>Total cost</th></tr></thead><tbody>" +
      ROLES.map(function (r) {
        var t = g.state[r.key].total;
        team += t;
        return "<tr" + (r.key === me.role ? ' class="bg-me"' : "") + "><td>" + r.name + "</td><td>" + esc(playerName(g, r.key)) + "</td><td>" + money(t) + "</td></tr>";
      }).join("") + "</tbody>";
    $("teamTotal").textContent = "Team cost: " + money(team);

    var s = seriesFrom(g);
    $("orderTable").innerHTML = "<thead><tr><th>Week</th><th>Shoppers</th>" + ROLES.map(function (r) { return "<th>" + r.name + "</th>"; }).join("") + "</tr></thead><tbody>" +
      s.weeks.map(function (w, i) {
        return "<tr><td>" + w + "</td><td>" + s.demand[i] + "</td>" + ROLES.map(function (r) { return "<td>" + s.orders[r.key][i] + "</td>"; }).join("") + "</tr>";
      }).join("") + "</tbody>";
    drawChart(s);

    var peaks = ROLES.map(function (r) { return Math.max.apply(null, s.orders[r.key]); });
    $("peakNote").textContent = "Shoppers never wanted more than 8 cases a week, but the biggest single order was " +
      Math.max.apply(null, peaks) + " cases, placed by the " + ROLES[peaks.indexOf(Math.max.apply(null, peaks))].name + ".";
  }

  /* Line chart of orders per week: one line per business, plus shoppers' demand as a dashed line. */
  function drawChart(s) {
    var box = $("chart"), svgNS = "http://www.w3.org/2000/svg";
    var W = Math.max(280, box.clientWidth), H = W < 500 ? 220 : 280;
    var m = { l: 36, r: 12, t: 12, b: 28 }, iw = W - m.l - m.r, ih = H - m.t - m.b;
    var all = s.demand.slice();
    ROLES.forEach(function (r) { all = all.concat(s.orders[r.key]); });
    var top = Math.max(8, Math.max.apply(null, all));
    var stepY = top <= 20 ? 5 : top <= 50 ? 10 : top <= 100 ? 20 : 50;
    top = Math.ceil(top / stepY) * stepY;
    var n = s.weeks.length;
    function x(i) { return m.l + (n > 1 ? i * iw / (n - 1) : iw / 2); }
    function y(v) { return m.t + ih - v / top * ih; }

    var out = '<svg xmlns="' + svgNS + '" width="' + W + '" height="' + H + '" role="img" aria-label="Orders placed each week by each business, compared with what shoppers wanted">';
    for (var v = 0; v <= top; v += stepY) {
      out += '<line class="bg-grid" x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + y(v) + '" y2="' + y(v) + '"/>';
      out += '<text class="bg-axis" x="' + (m.l - 8) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + v + "</text>";
    }
    s.weeks.forEach(function (w, i) {
      if (w === 1 || w % 4 === 0) out += '<text class="bg-axis" x="' + x(i) + '" y="' + (H - 8) + '" text-anchor="middle">' + w + "</text>";
    });
    function path(vals) { return vals.map(function (v, i) { return (i ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1); }).join(" "); }
    out += '<path class="bg-line bg-demand" d="' + path(s.demand) + '"/>';
    ROLES.forEach(function (r) { out += '<path class="bg-line" style="stroke:var(--s-' + r.key + ')" d="' + path(s.orders[r.key]) + '"/>'; });
    out += '<line id="crosshair" class="bg-cross" y1="' + m.t + '" y2="' + (m.t + ih) + '" visibility="hidden"/>';
    out += '<rect id="hoverArea" x="' + m.l + '" y="' + m.t + '" width="' + iw + '" height="' + ih + '" fill="transparent"/>';
    box.innerHTML = out + '</svg><div class="bg-tip" id="tip" hidden></div>';

    var area = $("hoverArea"), cross = $("crosshair"), tip = $("tip");
    function hide() { cross.setAttribute("visibility", "hidden"); tip.hidden = true; }
    area.addEventListener("pointermove", function (e) {
      var rect = box.querySelector("svg").getBoundingClientRect();
      var px = e.clientX - rect.left;
      var i = Math.max(0, Math.min(n - 1, Math.round((px - m.l) / (n > 1 ? iw / (n - 1) : 1))));
      cross.setAttribute("x1", x(i));
      cross.setAttribute("x2", x(i));
      cross.setAttribute("visibility", "visible");
      tip.innerHTML = "<strong>Week " + s.weeks[i] + "</strong>" +
        '<span class="bg-key bg-key-demand">Shoppers: ' + s.demand[i] + "</span>" +
        ROLES.map(function (r) { return '<span class="bg-key" style="--c:var(--s-' + r.key + ')">' + r.name + ": " + s.orders[r.key][i] + "</span>"; }).join("");
      tip.hidden = false;
      var left = x(i) + 12;
      if (left + tip.offsetWidth > W) left = x(i) - 12 - tip.offsetWidth;
      tip.style.left = Math.max(0, left) + "px";
      tip.style.top = m.t + "px";
    });
    area.addEventListener("pointerleave", hide);
  }

  function setupResults() {
    $("legend").innerHTML = '<span class="bg-key bg-key-demand">Shoppers</span>' +
      ROLES.map(function (r) { return '<span class="bg-key" style="--c:var(--s-' + r.key + ')">' + r.name + "</span>"; }).join("");
    $("againBtn").addEventListener("click", leave);
    var timer;
    window.addEventListener("resize", function () {
      clearTimeout(timer);
      timer = setTimeout(function () { if (game && game.status === "done" && !$("results").hidden) drawChart(seriesFrom(game)); }, 150);
    });
  }

  setupIntro();
  setupLobby();
  setupPlay();
  setupResults();
  showIntro();
})();
