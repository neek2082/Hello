// Beer Game: four players each run one business in a beer supply chain, one week at a time.
// Ways to play: a lecturer's class session (up to 25 games, students seated automatically),
// a quick online game with friends, or practice alone against the computer.
// Online data lives in a Firebase Realtime Database, reached with plain web requests (no library).
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
  var MAX_GAMES = 25;   // games in one class session
  var CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  var SAVE_KEY = "beerGame";
  var BEST_KEY = "beerGameBest";

  // Closest to the shoppers first. Beer flows down this list; orders flow up it.
  var ROLES = [
    { key: "retailer", name: "Retailer", plural: "Retailers", desc: "The shop. Sells beer to shoppers." },
    { key: "wholesaler", name: "Wholesaler", plural: "Wholesalers", desc: "Supplies the Retailer." },
    { key: "distributor", name: "Distributor", plural: "Distributors", desc: "Supplies the Wholesaler." },
    { key: "factory", name: "Factory", plural: "Factories", desc: "Brews the beer. Brewing takes 2 weeks." }
  ];

  // Shoppers buy 4 cases a week, then suddenly 8 from week 5 onwards.
  function customerDemand(week) { return week <= 4 ? 4 : 8; }

  /* ---------- Game rules ---------- */

  function copy(o) { return o === undefined ? undefined : JSON.parse(JSON.stringify(o)); }
  function roleIndex(key) { for (var i = 0; i < ROLES.length; i++) if (ROLES[i].key === key) return i; return -1; }
  function roleName(key) { return ROLES[roleIndex(key)].name; }

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

  // Starting a game: any empty seat is run by the computer.
  function startUpdate(g) {
    var cpu = {};
    ROLES.forEach(function (r) { if (!(g.players && g.players[r.key])) cpu[r.key] = true; });
    return { status: "playing", week: 1, weeks: WEEKS, cpu: cpu, state: beginWeek(initialState(), 1) };
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

  function teamCost(state) { return ROLES.reduce(function (sum, r) { return sum + state[r.key].total; }, 0); }

  // What a team of four computer players costs, shown on the score card for comparison.
  var COMPUTER_COST = (function () {
    var g = { weeks: WEEKS, week: 1, status: "playing", cpu: {}, state: beginWeek(initialState(), 1) };
    ROLES.forEach(function (r) { g.cpu[r.key] = true; });
    while (g.status === "playing") g = applyUpdate(g, "", finishWeek(g));
    return teamCost(g.state);
  })();

  /* ---------- Where games are kept ---------- */

  function keysOf(path) { return path.split("/").filter(Boolean); }
  function getPath(root, path) {
    var o = root;
    keysOf(path).forEach(function (k) { o = o && typeof o === "object" ? o[k] : undefined; });
    return o === undefined ? null : o;
  }
  // Sets a value at a slash-separated path inside an object. A null value removes it.
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

  // Practice games live only in this browser tab.
  function LocalStore() {
    var root = {}, watchers = [];
    function emit() {
      watchers.forEach(function (w) { setTimeout(function () { w.fn(copy(getPath(root, w.path))); }, 0); });
    }
    return {
      get: function (path) { return Promise.resolve(copy(getPath(root, path))); },
      put: function (path, value) { root = setPath(root, path, copy(value)); emit(); return Promise.resolve(); },
      update: function (path, obj) { root = applyUpdate(root, path, copy(obj)); emit(); return Promise.resolve(); },
      watch: function (path, fn) {
        var w = { path: path, fn: fn };
        watchers.push(w);
        emit();
        return function () { watchers.splice(watchers.indexOf(w), 1); };
      }
    };
  }

  // Online data is kept in the Firebase Realtime Database, read and written with its web address (REST).
  // The live connection is an EventSource: the database sends a message every time the data changes.
  //   beerGames/<code>               a quick game with friends
  //   beerSessions/<code>/info       a lecturer's class session
  //   beerSessions/<code>/games/g<n> game n of that session
  //   beerScores/<code>              the result of a finished quick game
  function FirebaseStore(base) {
    function at(path) { return base.replace(/\/+$/, "") + "/" + path + ".json"; }
    function send(method, path, body) {
      return fetch(at(path), { method: method, body: body === undefined ? undefined : JSON.stringify(body) }).then(function (res) {
        if (!res.ok) throw new Error(res.status === 401 ? "Someone else got there first. Please try again." : "The game server refused the request (error " + res.status + ").");
        return res.json();
      });
    }
    return {
      get: function (path) { return send("GET", path); },
      put: function (path, value) { return send("PUT", path, value); },
      update: function (path, obj) { return send("PATCH", path, obj); },
      watch: function (path, fn, onStatus) {
        var data = null, es = new EventSource(at(path));
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

  /* ---------- Rankings ---------- */

  // One finished game as a ranking entry: team cost plus each business's cost.
  function entryFor(g, id, label) {
    var e = { id: id, label: label, cost: teamCost(g.state), roles: {}, names: {}, date: Date.now() };
    ROLES.forEach(function (r) {
      e.roles[r.key] = g.state[r.key].total;
      e.names[r.key] = g.players && g.players[r.key] ? g.players[r.key].name : "Computer";
    });
    return e;
  }

  // Finished games of a class session, as ranking entries.
  function classEntries(s) {
    var list = [], games = (s && s.games) || {};
    for (var n = 1; n <= MAX_GAMES; n++) {
      var g = games["g" + n];
      if (g && g.status === "done" && g.state) list.push(entryFor(g, "g" + n, "Game " + n));
    }
    return list;
  }

  function byCost(list) { return list.slice().sort(function (a, b) { return a.cost - b.cost || a.date - b.date; }); }

  // Entries played by a person (not the computer) in a role, cheapest first.
  function byRole(list, key) {
    return list.filter(function (e) { return e.names[key] !== "Computer"; })
      .sort(function (a, b) { return a.roles[key] - b.roles[key] || a.date - b.date; });
  }

  function teamText(e) {
    var names = ROLES.map(function (r) { return e.names[r.key]; }).filter(function (n) { return n !== "Computer"; });
    var people = names.length > 1 ? names.slice(0, -1).join(", ") + " & " + names[names.length - 1] : names[0] || "Computer";
    if (names.length < ROLES.length) people += " + computer";
    return e.label ? e.label + " (" + people + ")" : people;
  }

  function rankingTable(list, mineId) {
    var sorted = byCost(list);
    var rows = sorted.map(function (e, i) {
      var me = e.id === mineId;
      return "<tr" + (me ? ' class="bg-me"' : "") + "><td>" + (i + 1) + "</td><td>" + esc(teamText(e)) + (me ? " (you)" : "") +
        "</td><td>" + money(e.cost) + "</td>" + ROLES.map(function (r) { return "<td>" + money(e.roles[r.key]) + "</td>"; }).join("") + "</tr>";
    });
    return "<thead><tr><th>#</th><th>Team</th><th>Team cost</th>" + ROLES.map(function (r) { return "<th>" + r.name + "</th>"; }).join("") +
      "</tr></thead><tbody>" + rows.join("") + "</tbody>";
  }

  function bestByRoleTable(list) {
    return "<thead><tr><th>Business</th><th>Best player</th><th>Team</th><th>Cost</th></tr></thead><tbody>" +
      ROLES.map(function (r) {
        var best = byRole(list, r.key)[0];
        return "<tr><td>" + r.name + "</td>" + (best
          ? "<td>" + esc(best.names[r.key]) + "</td><td>" + esc(best.label || teamText(best)) + "</td><td>" + money(best.roles[r.key]) + "</td>"
          : '<td colspan="3">No one yet</td>') + "</tr>";
      }).join("") + "</tbody>";
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
  var store = null, stopWatching = null, game = null, session = null;
  var finishingWeek = 0, shownWeek = 0, startingGame = "", scoredGame = "";
  // kind: "quick" (game with friends), "class" (student in a session), "lecturer" or "practice".
  var me = blankMe();

  function blankMe() { return { kind: "", code: "", game: 0, role: "", id: randomId(12), name: "" }; }

  function gamePath() {
    if (me.kind === "class") return "beerSessions/" + me.code + "/games/g" + me.game;
    if (me.kind === "practice") return "practice/game";
    return "beerGames/" + me.code;
  }
  function gameTitle() {
    if (me.kind === "class") return "Class " + me.code + " · Game " + me.game;
    if (me.kind === "practice") return "Practice game";
    return "Game " + me.code;
  }

  function save() {
    if (me.kind === "practice") return;
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
    ["intro", "lobby", "play", "results", "teacher"].forEach(function (s) { $(s).hidden = s !== id; });
  }
  function playerName(g, key) {
    if (g.cpu && g.cpu[key]) return "Computer";
    return g.players && g.players[key] ? g.players[key].name : "Computer";
  }
  function seatsTaken(g) { return ROLES.filter(function (r) { return g.players && g.players[r.key]; }).length; }

  function stop() {
    if (stopWatching) stopWatching();
    stopWatching = null;
    game = null;
    session = null;
  }

  function openGame(useStore) {
    stop();
    store = useStore || online;
    finishingWeek = 0;
    shownWeek = 0;
    save();
    stopWatching = store.watch(gamePath(), onGame, status);
  }

  function leave() {
    stop();
    if (me.kind !== "practice") forget();
    me = blankMe();
    scoredGame = "";
    status("");
    showIntro();
  }

  function onGame(g) {
    var seat = g && g.players && me.role ? g.players[me.role] : null;
    if (me.kind === "class" && (!seat || seat.id !== me.id)) {
      var where = gameTitle();
      leave();
      status("You no longer have a seat in " + where + ". The lecturer may have moved you: enter the class code again to get a new seat.");
      return;
    }
    if (!g) {
      var code = me.code;
      leave();
      status("No game with the code " + code + " was found.");
      return;
    }
    game = g;
    if (me.role && seat && seat.id !== me.id) {
      status("Someone else took the " + roleName(me.role) + " role. Please choose another.");
      me.role = "";
      save();
    }
    var st = g.status || "lobby";
    if (st === "lobby") {
      // In a class, a game starts by itself once all four seats are filled.
      if (me.kind === "class" && seatsTaken(g) === ROLES.length && startingGame !== gamePath()) {
        startingGame = gamePath();
        store.update(gamePath(), startUpdate(g)).catch(function (err) { startingGame = ""; status(err.message); });
      }
      renderLobby(g);
    } else if (st === "playing") {
      renderPlay(g);
      maybeFinishWeek(g);
    } else {
      renderResults(g);
    }
  }

  function maybeFinishWeek(g) {
    if (g.status !== "playing" || waitingFor(g).length || finishingWeek === g.week) return;
    finishingWeek = g.week;
    store.update(gamePath(), finishWeek(g)).catch(function (err) { finishingWeek = 0; status(err.message); });
  }

  /* ----- Start screen ----- */

  function showIntro() {
    show("intro");
    var saved = loadSaved();
    var ok = !!(online && saved && saved.code);
    $("rejoin").hidden = !ok;
    if (!ok) return;
    var text = saved.kind === "lecturer" ? "You were running class session " + saved.code + "."
      : saved.kind === "class" ? "You were in class " + saved.code + ", Game " + saved.game + ", as the " + roleName(saved.role) + "."
      : "You were in game " + saved.code + (saved.role ? " as the " + roleName(saved.role) : "") + ".";
    $("rejoinText").textContent = text;
  }

  // A new 6-character code that isn't used by a game or a class yet.
  function freshCode(triesLeft) {
    var code = randomId(6, CODE_CHARS);
    return Promise.all([online.get("beerGames/" + code + "/created"), online.get("beerSessions/" + code + "/info")]).then(function (found) {
      if (found[0] === null && found[1] === null) return code;
      if (triesLeft > 1) return freshCode(triesLeft - 1);
      throw new Error("Couldn't find a free code. Please try again.");
    });
  }

  function setupIntro() {
    $("practiceRole").innerHTML = ROLES.map(function (r) { return '<option value="' + r.key + '">' + r.name + "</option>"; }).join("");
    var options = "";
    for (var n = 1; n <= MAX_GAMES; n++) options += '<option value="' + n + '"' + (n === 8 ? " selected" : "") + ">" + n + " (up to " + n * 4 + " students)</option>";
    $("lecturerGames").innerHTML = options;
    if (!online) {
      $("offlineNote").hidden = false;
      document.querySelectorAll("#lecturerForm input, #lecturerForm select, #lecturerForm button, #createForm input, #createForm button, #joinForm input, #joinForm button")
        .forEach(function (el) { el.disabled = true; });
    }
    var params = new URLSearchParams(location.search);
    var fromLink = params.get("code") || params.get("game");
    if (fromLink) $("joinCode").value = fromLink.toUpperCase();

    $("lecturerForm").addEventListener("submit", function (e) {
      e.preventDefault();
      createSession($("lecturerName").value.trim(), Number($("lecturerGames").value));
    });
    $("createForm").addEventListener("submit", function (e) {
      e.preventDefault();
      createQuickGame($("createName").value.trim());
    });
    $("joinForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var code = $("joinCode").value.trim().toUpperCase();
      if (!/^[A-Z2-9]{6}$/.test(code)) { status("A code is 6 letters and numbers, like K7Q2PX."); return; }
      joinWithCode(code, $("joinName").value.trim());
    });
    $("practiceBtn").addEventListener("click", startPractice);
    $("rejoinBtn").addEventListener("click", function () {
      me = loadSaved();
      status("");
      if (me.kind === "lecturer") openTeacher();
      else openGame(online);
    });
    $("forgetBtn").addEventListener("click", function () { forget(); showIntro(); });
  }

  function createQuickGame(name) {
    status("Creating the game…");
    freshCode(5).then(function (code) {
      me = blankMe();
      me.kind = "quick";
      me.code = code;
      me.name = name;
      var g = { created: Date.now(), hostId: me.id, hostName: name, weeks: WEEKS, status: "lobby", week: 0 };
      return online.update("beerGames/" + code, g).then(function () { status(""); openGame(online); });
    }).catch(function (err) { status(err.message || "Couldn't reach the game server."); });
  }

  function createSession(name, games) {
    status("Creating the class session…");
    freshCode(5).then(function (code) {
      me = blankMe();
      me.kind = "lecturer";
      me.code = code;
      me.name = name;
      var info = { created: Date.now(), hostId: me.id, hostName: name, games: Math.max(1, Math.min(MAX_GAMES, games)) };
      return online.put("beerSessions/" + code + "/info", info).then(function () { status(""); openTeacher(); });
    }).catch(function (err) { status(err.message || "Couldn't reach the game server."); });
  }

  // The same box joins a class session or a quick game, whichever the code belongs to.
  function joinWithCode(code, name) {
    status("Looking for " + code + "…");
    online.get("beerSessions/" + code + "/info").then(function (info) {
      if (info) return takeClassSeat(code, info.games, name, 5);
      return online.get("beerGames/" + code + "/created").then(function (created) {
        if (created === null) throw new Error("No game or class with the code " + code + " was found.");
        me = blankMe();
        me.kind = "quick";
        me.code = code;
        me.name = name;
        status("");
        openGame(online);
      });
    }).catch(function (err) { status(err.message || "Couldn't reach the game server."); });
  }

  // Seats students in order: Game 1 Retailer, Wholesaler, Distributor, Factory, then Game 2, and so on.
  // Each seat can only be taken once, so if two students grab the same seat, one tries the next free one.
  function takeClassSeat(code, games, name, triesLeft) {
    var base = "beerSessions/" + code + "/games/g", reads = [];
    for (var n = 1; n <= games; n++) reads.push(Promise.all([online.get(base + n + "/status"), online.get(base + n + "/players")]));
    return Promise.all(reads).then(function (all) {
      var seat = null;
      all.some(function (found, i) {
        if (found[0] && found[0] !== "lobby") return false;
        var free = ROLES.filter(function (r) { return !(found[1] && found[1][r.key]); })[0];
        if (free) seat = { game: i + 1, role: free.key };
        return !!seat;
      });
      if (!seat) throw new Error("All " + games + " games in this class are full or have already started. Please ask your lecturer.");
      var id = randomId(12);
      return online.put(base + seat.game + "/players/" + seat.role, { name: name, id: id }).then(function () {
        me = blankMe();
        me.kind = "class";
        me.code = code;
        me.game = seat.game;
        me.role = seat.role;
        me.id = id;
        me.name = name;
        status("");
        openGame(online);
      }, function (err) {
        if (triesLeft > 1) return takeClassSeat(code, games, name, triesLeft - 1);
        throw err;
      });
    });
  }

  function startPractice() {
    me = blankMe();
    me.kind = "practice";
    me.name = "You";
    me.role = $("practiceRole").value;
    var g = { created: Date.now(), hostId: me.id, hostName: me.name, players: {} };
    g.players[me.role] = { name: me.name, id: me.id };
    var local = LocalStore();
    status("");
    local.put(gamePath(), g).then(function () { return local.update(gamePath(), startUpdate(g)); }).then(function () { openGame(local); });
  }

  /* ----- Waiting room ----- */

  function renderLobby(g) {
    show("lobby");
    var inClass = me.kind === "class", players = g.players || {}, taken = seatsTaken(g);
    $("lobbyTitle").textContent = gameTitle();
    $("shareBox").hidden = inClass;
    $("shareLink").value = location.origin + location.pathname + "?code=" + me.code;
    $("roleList").innerHTML = ROLES.map(function (r) {
      var p = players[r.key], who;
      if (p && p.id === me.id) who = "<strong>You</strong>";
      else if (p) who = esc(p.name);
      else if (inClass) who = '<span class="bg-hint">Waiting for a student…</span>';
      else who = '<button type="button" class="btn" data-role="' + r.key + '">Take this role</button>';
      return '<li class="bg-card bg-role"><div><h3>' + r.name + '</h3><p class="bg-hint">' + r.desc + "</p></div><div>" + who + "</div></li>";
    }).join("");

    var isHost = !inClass && g.hostId === me.id;
    $("startBtn").hidden = !isHost;
    $("startBtn").disabled = taken === 0;
    var note;
    if (inClass) {
      note = "You are the " + roleName(me.role) + ". The game starts by itself when all 4 seats are filled (" + taken + " of 4 so far).";
    } else {
      note = me.role ? "" : "Choose the business you want to run. ";
      note += isHost
        ? "Press Start when everyone has joined. Any business without a player is run by the computer."
        : "Waiting for " + g.hostName + " to start the game.";
    }
    $("lobbyNote").textContent = note;
  }

  function setupLobby() {
    $("roleList").addEventListener("click", function (e) {
      var key = e.target.getAttribute("data-role");
      if (!key) return;
      var update = {};
      if (me.role) update["players/" + me.role] = null;
      update["players/" + key] = { name: me.name, id: me.id };
      var before = me.role;
      me.role = key;
      save();
      store.update(gamePath(), update).catch(function (err) { me.role = before; save(); status(err.message); });
    });
    $("copyLink").addEventListener("click", function () {
      var input = $("shareLink");
      var done = function () { $("copied").textContent = "Link copied"; };
      try {
        navigator.clipboard.writeText(input.value).then(done, function () { input.select(); $("copied").textContent = "Press Ctrl+C (or Cmd+C) to copy"; });
      } catch (err) { input.select(); $("copied").textContent = "Press Ctrl+C (or Cmd+C) to copy"; }
    });
    $("startBtn").addEventListener("click", function () {
      store.update(gamePath(), startUpdate(game)).catch(function (err) { status(err.message); });
    });
    $("leaveLobby").addEventListener("click", function () {
      if (me.role && game && game.players && game.players[me.role] && game.players[me.role].id === me.id) {
        var update = {};
        update["players/" + me.role] = null;
        store.update(gamePath(), update);
      }
      leave();
    });
  }

  /* ----- Playing ----- */

  function renderPlay(g) {
    show("play");
    $("weekLabel").textContent = (me.kind === "class" ? "Game " + me.game + " · " : "") + "Week " + g.week + " of " + g.weeks;
    if (!me.role) {
      $("playTitle").textContent = gameTitle();
      $("spectator").hidden = false;
      ["numbers", "orderForm", "cpuNote", "myHistoryBox"].forEach(function (id) { $(id).hidden = true; });
      renderWaiting(g);
      return;
    }
    $("spectator").hidden = true;
    var i = roleIndex(me.role), r = ROLES[i], b = g.state[me.role];
    $("playTitle").textContent = "You are the " + r.name;

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
      store.put(gamePath() + "/orders/w" + game.week + "/" + me.role, n).catch(function (err) {
        $("orderForm").hidden = false;
        status(err.message);
      });
    });
    $("autoBtn").addEventListener("click", function () {
      var update = {};
      waitingFor(game).forEach(function (r) { if (r.key !== me.role) update["cpu/" + r.key] = true; });
      store.update(gamePath(), update).catch(function (err) { status(err.message); });
    });
    $("takeBack").addEventListener("click", function () {
      var update = {};
      update["cpu/" + me.role] = null;
      store.update(gamePath(), update).catch(function (err) { status(err.message); });
    });
    $("leavePlay").addEventListener("click", leave);
  }

  /* ----- Score card and results ----- */

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

  function myId() { return me.kind === "class" ? "g" + me.game : me.code; }

  function renderResults(g) {
    show("results");
    if (me.kind !== "practice") forget(); // the game is over, so this device shouldn't offer to go back to it
    var mine = entryFor(g, myId(), me.kind === "class" ? "Game " + me.game : "");

    $("scoreEyebrow").textContent = "Score card · " + gameTitle();
    $("scoreTeam").textContent = "Team: " + teamText({ names: mine.names });
    $("teamTotal").textContent = money(mine.cost);
    var diff = Math.round(Math.abs(1 - mine.cost / COMPUTER_COST) * 100);
    $("scoreCompare").textContent = mine.cost <= COMPUTER_COST
      ? "That's " + diff + "% less than a team of computer players (" + money(COMPUTER_COST) + ")."
      : "That's " + diff + "% more than a team of computer players (" + money(COMPUTER_COST) + "). Try again!";
    $("roleCosts").innerHTML = ROLES.map(function (r) {
      return "<div" + (r.key === me.role ? ' class="bg-mine"' : "") + "><dt>" + r.name + (r.key === me.role ? " (you)" : "") + "</dt>" +
        '<dd class="bg-cost">' + money(mine.roles[r.key]) + "</dd><dd>" + esc(mine.names[r.key]) + '</dd><dd class="bg-hint" id="rank-' + r.key + '"></dd></div>';
    }).join("");

    var s = seriesFrom(g);
    $("orderTable").innerHTML = "<thead><tr><th>Week</th><th>Shoppers</th>" + ROLES.map(function (r) { return "<th>" + r.name + "</th>"; }).join("") + "</tr></thead><tbody>" +
      s.weeks.map(function (w, i) {
        return "<tr><td>" + w + "</td><td>" + s.demand[i] + "</td>" + ROLES.map(function (r) { return "<td>" + s.orders[r.key][i] + "</td>"; }).join("") + "</tr>";
      }).join("") + "</tbody>";
    drawChart(s);
    var peaks = ROLES.map(function (r) { return Math.max.apply(null, s.orders[r.key]); }), top = Math.max.apply(null, peaks);
    $("peakNote").textContent = "Shoppers never wanted more than 8 cases a week, but the biggest single order was " +
      top + " cases, placed by the " + ROLES[peaks.indexOf(top)].name + ".";

    if (scoredGame !== gamePath()) {
      scoredGame = gamePath();
      window.scrollTo(0, 0);
      loadRanking(g, mine);
    }
  }

  function loadRanking(g, mine) {
    var practice = me.kind === "practice";
    $("rankingBox").hidden = practice;
    $("refreshRank").hidden = me.kind !== "class";
    $("rankingTitle").textContent = me.kind === "class" ? "Class ranking" : "Top teams";
    $("rankingHint").textContent = me.kind === "class"
      ? "Teams in this class that have finished, lowest team cost first. Other games may still be playing: press Update to refresh."
      : "Quick games from everyone who has played, lowest team cost first.";
    if (practice) {
      var best = null;
      try { best = JSON.parse(localStorage.getItem(BEST_KEY)); } catch (e) { /* no saved best */ }
      $("rankLabel").textContent = "Personal best";
      if (!best || mine.cost < best.cost) {
        $("teamRank").textContent = "New personal best!";
        try { localStorage.setItem(BEST_KEY, JSON.stringify({ cost: mine.cost })); } catch (e) { /* not saved */ }
      } else {
        $("teamRank").textContent = money(best.cost);
      }
      $("bestTeamBox").hidden = true;
      return;
    }
    $("rankLabel").textContent = "Team rank";
    $("bestTeamBox").hidden = false;
    $("teamRank").textContent = "…";
    $("bestTeam").textContent = "…";
    var loading = me.kind === "class"
      ? online.get("beerSessions/" + me.code).then(classEntries)
      : saveQuickScore(g, mine);
    loading.then(function (list) {
      if (!list.some(function (e) { return e.id === mine.id; })) list.push(mine);
      showRanking(list, mine);
    }).catch(function (err) {
      $("teamRank").textContent = "—";
      $("bestTeam").textContent = "—";
      $("rankTable").innerHTML = "<tbody><tr><td>Couldn't load the ranking. " + esc(err.message) + "</td></tr></tbody>";
    });
  }

  // A quick game's result is saved once under beerScores. The first player in the chain saves it; everyone
  // else waits a moment and only saves it if it still isn't there. The database keeps only one copy.
  function saveQuickScore(g, mine) {
    var first = ROLES.filter(function (r) { return g.players && g.players[r.key]; })[0];
    var saver = first && g.players[first.key].id === me.id;
    var entry = { cost: mine.cost, roles: mine.roles, names: mine.names, date: mine.date };
    function readAll() { return online.get("beerScores"); }
    function saveIfMissing(all) {
      if (all && all[me.code]) return all;
      return online.put("beerScores/" + me.code, entry).catch(function () {}).then(readAll);
    }
    var ready = saver ? readAll().then(saveIfMissing)
      : new Promise(function (done) { setTimeout(done, 3000); }).then(readAll).then(saveIfMissing);
    return ready.then(function (all) {
      all = all || {};
      return Object.keys(all).map(function (code) { var e = all[code]; e.id = code; e.label = ""; return e; })
        .filter(function (e) { return typeof e.cost === "number" && e.roles && e.names; });
    });
  }

  function showRanking(list, mine) {
    var sorted = byCost(list), rank = 0, finished = me.kind === "class" ? " finished teams" : " teams";
    sorted.forEach(function (e, i) { if (e.id === mine.id) rank = i + 1; });
    $("teamRank").textContent = "#" + rank + " of " + sorted.length + finished;
    $("bestTeam").textContent = rank === 1 ? "That's you!" : money(sorted[0].cost) + " · " + (sorted[0].label || teamText(sorted[0]));
    ROLES.forEach(function (r) {
      var el = $("rank-" + r.key);
      if (mine.names[r.key] === "Computer") { el.textContent = "Played by the computer"; return; }
      var list = byRole(sorted, r.key), pos = 0;
      list.forEach(function (e, i) { if (e.id === mine.id) pos = i + 1; });
      el.textContent = "#" + pos + " of " + list.length + " " + r.plural;
    });
    $("rankTable").innerHTML = rankingTable(sorted.slice(0, me.kind === "class" ? MAX_GAMES : 10), mine.id);
    $("bestTable").innerHTML = bestByRoleTable(sorted);
  }

  // Line chart of orders per week: one line per business, plus shoppers' demand as a dashed line.
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
    $("refreshRank").addEventListener("click", function () {
      if (game) loadRanking(game, entryFor(game, myId(), "Game " + me.game));
    });
    var timer;
    window.addEventListener("resize", function () {
      clearTimeout(timer);
      timer = setTimeout(function () { if (game && game.status === "done" && !$("results").hidden) drawChart(seriesFrom(game)); }, 150);
    });
  }

  /* ----- Lecturer's board ----- */

  function openTeacher() {
    stop();
    store = online;
    save();
    stopWatching = store.watch("beerSessions/" + me.code, onSession, status);
  }

  function onSession(s) {
    if (!s || !s.info) {
      var code = me.code;
      leave();
      status("No class session with the code " + code + " was found.");
      return;
    }
    session = s;
    renderTeacher(s);
  }

  function renderTeacher(s) {
    show("teacher");
    var n = s.info.games, games = s.games || {}, students = 0, playing = 0, done = 0, html = "";
    $("teacherTitle").textContent = "Class session " + me.code;
    $("teacherCode").textContent = me.code;
    $("teacherLink").value = location.origin + location.pathname + "?code=" + me.code;
    for (var i = 1; i <= n; i++) {
      var g = games["g" + i] || {}, players = g.players || {}, st = g.status || "lobby", taken = seatsTaken(g);
      students += taken;
      if (st === "playing") playing++;
      if (st === "done") done++;
      var label = st === "lobby" ? (taken ? "Waiting · " + taken + " of 4 seats" : "Empty")
        : st === "playing" ? "Playing · week " + g.week + " of " + g.weeks : "Finished";
      html += '<li class="bg-card bg-game" data-status="' + st + '"><div class="bg-game-head"><h3>Game ' + i + '</h3><span class="bg-tag">' + label + "</span></div>" +
        '<ul class="bg-seats">' + ROLES.map(function (r) {
          var p = players[r.key], who;
          if (p) who = esc(p.name) + (g.cpu && g.cpu[r.key] ? ' <span class="bg-hint">(computer playing)</span>' : "");
          else who = '<span class="bg-hint">' + (st === "lobby" ? "Empty seat" : "Computer") + "</span>";
          return "<li><span class=\"bg-seat-role\">" + r.name + "</span><span class=\"bg-seat-name\">" + who + "</span>" +
            (p ? '<button type="button" class="bg-x" data-remove="' + i + "/" + r.key + '" aria-label="Remove ' + esc(p.name) + " from Game " + i + '">×</button>' : "") + "</li>";
        }).join("") + "</ul>" +
        (g.state ? '<p class="bg-hint">Team cost ' + (st === "done" ? "" : "so far ") + "<strong>" + money(teamCost(g.state)) + "</strong></p>" : "") +
        (st === "lobby" && taken > 0 && taken < ROLES.length ? '<button type="button" class="btn" data-start="' + i + '">Start now with computer players</button>' : "") +
        "</li>";
    }
    $("gameGrid").innerHTML = html;
    $("teacherCounts").textContent = students + " student" + (students === 1 ? "" : "s") + " seated · " + playing + " playing · " +
      done + " finished · " + n + " games (room for " + n * 4 + " students)";
    var list = classEntries(s);
    $("teacherRanking").hidden = !list.length;
    if (list.length) {
      $("teacherRankTable").innerHTML = rankingTable(list, "");
      $("teacherBestTable").innerHTML = bestByRoleTable(list);
    }
  }

  function setupTeacher() {
    $("gameGrid").addEventListener("click", function (e) {
      var remove = e.target.getAttribute("data-remove"), start = e.target.getAttribute("data-start");
      var base = "beerSessions/" + me.code + "/games/g";
      if (remove) {
        var parts = remove.split("/"), g = session.games["g" + parts[0]], p = g.players[parts[1]];
        if (!window.confirm("Remove " + p.name + " from Game " + parts[0] + "? They can join again with the class code and get the next free seat.")) return;
        var update = {};
        update["players/" + parts[1]] = null;
        store.update(base + parts[0], update).catch(function (err) { status(err.message); });
      }
      if (start) {
        store.update(base + start, startUpdate(session.games["g" + start])).catch(function (err) { status(err.message); });
      }
    });
    $("copyTeacherLink").addEventListener("click", function () {
      var input = $("teacherLink");
      var done = function () { $("teacherCopied").textContent = "Link copied"; };
      try {
        navigator.clipboard.writeText(input.value).then(done, function () { input.select(); $("teacherCopied").textContent = "Press Ctrl+C (or Cmd+C) to copy"; });
      } catch (err) { input.select(); $("teacherCopied").textContent = "Press Ctrl+C (or Cmd+C) to copy"; }
    });
    $("leaveTeacher").addEventListener("click", leave);
  }

  setupIntro();
  setupLobby();
  setupPlay();
  setupResults();
  setupTeacher();
  showIntro();
})();
