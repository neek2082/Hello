// Beer Game: four players each run one business in a beer supply chain, one week at a time.
// Students and lecturers sign in with the accounts the lecturer hands out (BEERGAME_Student_001…,
// BEERGAME_Faci_001…). A student account belongs to one team (Students 001–004 = Team 1, 005–008 = Team 2…)
// and picks its business in that team's game. A lecturer account sees every team live and can reset all games.
// Anyone can also practice alone against the computer without signing in.
// Online data lives in a Firebase Realtime Database, reached with plain web requests (no library).
(function () {
  // Address of the Firebase Realtime Database (project "beer-game-data", Singapore).
  var DB_URL = "https://beer-game-data-default-rtdb.asia-southeast1.firebasedatabase.app";
  // The project's web key for signing in. It is meant to be public: what each account may do is decided
  // by the database rules (firebase/beer-game.rules.json), not by this key.
  var API_KEY = "";
  var LOGIN_DOMAIN = "beergame.example"; // turns usernames into account names; ".example" can never receive email

  var WEEKS = 20;
  var START_STOCK = 12;
  var START_FLOW = 4;   // cases a week moving through the chain when the game starts
  var STOCK_COST = 1; // $ per case in stock, per week
  var OWED_COST = 2;  // $ per case owed but not yet delivered, per week
  var MAX_GAMES = 15;   // teams: 60 student accounts, 4 to a team
  var BEST_KEY = "beerGameBest";

  // Closest to the shoppers first. Beer flows down this list; orders flow up it.
  var ROLES = [
    { key: "retailer", name: "Retailer", plural: "Retailers", desc: "The shop. Sells beer to shoppers." },
    { key: "wholesaler", name: "Wholesaler", plural: "Wholesalers", desc: "Supplies the Retailer." },
    { key: "distributor", name: "Distributor", plural: "Distributors", desc: "Supplies the Wholesaler." },
    { key: "factory", name: "Factory", plural: "Factories", desc: "Brews the beer. Brewing takes 2 weeks." }
  ];

  // Line icons (32×32), drawn in the text color so they work in both themes.
  var ICONS = {
    factory: '<path d="M4 28V14l7 4v-4l7 4v-4l7 4V5h3v23z"/><path d="M9 23h3M15 23h3M21 23h3"/>',
    distributor: '<path d="M3 8h16v14H3zM19 13h6l4 5v4H19z"/><circle cx="9" cy="24" r="2.5"/><circle cx="24" cy="24" r="2.5"/>',
    wholesaler: '<path d="M3 12 16 5l13 7v16H3z"/><path d="M8 28V16h16v12M8 20h16M8 24h16"/>',
    retailer: '<path d="M5 13v15h22V13M3 13l3-8h20l3 8z"/><path d="M13 28v-8h6v8"/>',
    shoppers: '<circle cx="11" cy="11" r="4"/><circle cx="22" cy="12" r="3"/><path d="M3 27c0-5 4-8 8-8s8 3 8 8M18 21c4-1 9 1 10 6"/>'
  };
  function icon(name) {
    return '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[name] + "</svg>";
  }

  /* ---------- Pictures for the weekly numbers ---------- */

  // A picture shows a range, not an exact count: 1 crate = 1–10 cases, 2 = 11–20, 3 = 21–40, 4 = 41–80, 5 = 81 or more.
  var CRATE_STEPS = [10, 20, 40, 80];
  var COIN_STEPS = [50, 150, 400, 1000]; // dollars: 1 coin = up to $50, … 5 coins = over $1,000
  function level(n, steps) {
    if (n <= 0) return 0;
    for (var i = 0; i < steps.length; i++) if (n <= steps[i]) return i + 1;
    return steps.length + 1;
  }

  function svg(viewBox, body, label) {
    return '<svg class="bg-pic" viewBox="' + viewBox + '" role="img" aria-label="' + label + '">' + body + "</svg>";
  }
  // One beer crate: yellow box with slats. "empty" draws a dashed outline (cases you still owe).
  function crate(x, y, w, h, empty) {
    var style = empty ? 'fill="none" stroke-dasharray="4 3"' : 'class="bg-fill"';
    var slats = empty ? "" : '<path d="M' + (x + w / 3) + " " + y + "v" + h + "M" + (x + 2 * w / 3) + " " + y + "v" + h + '"/>';
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="2" ' + style + "/>" + slats;
  }
  // A pile of up to 5 crates on the floor: 3 at the bottom, 2 on top.
  var PILE = [[36, 40], [5, 40], [67, 40], [20, 17], [52, 17]];
  function pile(n, empty, label) {
    var k = level(n, CRATE_STEPS), body = '<path class="bg-floor" d="M2 63h96"/>';
    if (k === 2) body += crate(20, 40, 28, 22, empty) + crate(52, 40, 28, 22, empty); // two crates sit side by side
    else for (var i = 0; i < k; i++) body += crate(PILE[i][0], PILE[i][1], 28, 22, empty);
    return svg("0 0 100 64", body, label);
  }
  // A truck whose trailer holds up to 5 crates.
  function truck(n, label) {
    var k = level(n, CRATE_STEPS), body = "";
    var slots = [[7, 33], [26, 33], [45, 33], [16, 16], [35, 16]];
    for (var i = 0; i < k; i++) body += crate(slots[i][0], slots[i][1], 17, 16, false);
    body += '<path d="M3 51V10h63v41z" fill="none"/>' +
      '<path d="M66 22h19l12 14v15H66z" fill="none"/><path d="M71 27h12l7 9H71z" fill="none"/>' +
      '<circle cx="17" cy="55" r="6" class="bg-wheel"/><circle cx="52" cy="55" r="6" class="bg-wheel"/><circle cx="84" cy="55" r="6" class="bg-wheel"/>';
    return svg("0 0 100 64", body, label);
  }
  // A stack of up to 5 coins.
  function coins(dollars, label) {
    var k = level(dollars, COIN_STEPS), body = '<path class="bg-floor" d="M16 63h68"/>';
    for (var i = 0; i < k; i++) {
      var y = 54 - i * 10;
      body += '<path class="bg-fill" d="M26 ' + y + 'v5a24 6 0 0 0 48 0v-5"/><ellipse class="bg-fill" cx="50" cy="' + y + '" rx="24" ry="6"/>';
    }
    return svg("0 0 100 64", body, label);
  }
  // A purchase order: a sheet of paper headed "PO" with the quantity written on it.
  function purchaseOrder(qty, label) {
    var body = '<path d="M26 2h40l8 8v52H26z" class="bg-paper"/><path d="M66 2v8h8" fill="none"/>' +
      '<rect x="26" y="2" width="40" height="14" class="bg-fill"/>' +
      '<text x="46" y="13" class="bg-po-head">PO</text>' +
      '<text x="50" y="44" class="bg-po-qty">' + qty + "</text>" +
      '<text x="50" y="56" class="bg-po-unit">cases</text>';
    return svg("0 0 100 64", body, label);
  }

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

  // Online data is kept in the Firebase Realtime Database (js/firebase-login.js reads and writes it, signed in).
  //   roster/<account id>   who an account is: { role: "student" or "faci", name, team: "g1"… }
  //   beer/games/g<n>       Team n's game
  // A refused write means the database rules said no (for example, someone took that seat first).
  var login = API_KEY && window.FirebaseLogin ? FirebaseLogin({ apiKey: API_KEY, domain: LOGIN_DOMAIN, saveKey: "beerLogin" }) : null;
  function FirebaseStore() {
    var data = FirebaseData(DB_URL, login);
    function explain(err) {
      throw new Error(err.message === "refused" ? "Someone else got there first, or you don't have access. Please try again." : err.message);
    }
    return {
      get: function (path) { return data.get(path).catch(explain); },
      put: function (path, value) { return data.put(path, value).catch(explain); },
      update: function (path, obj) { return data.update(path, obj).catch(explain); },
      watch: data.watch
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
      if (g && g.status === "done" && g.state) list.push(entryFor(g, "g" + n, "Team " + n));
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

  var online = login ? FirebaseStore() : null;
  var store = null, stopWatching = null, game = null, session = null;
  var finishingWeek = 0, shownWeek = 0, startingGame = "", scoredGame = "";
  // kind: "class" (signed-in student), "lecturer" (signed-in lecturer) or "practice".
  var me = blankMe();

  function blankMe() { return { kind: "", game: 0, role: "", id: randomId(12), name: "" }; }

  function gamePath() {
    if (me.kind === "practice") return "practice/game";
    return "beer/games/g" + me.game;
  }
  function gameTitle() {
    if (me.kind === "practice") return "Practice game";
    return "Team " + me.game;
  }

  function status(msg) {
    $("status").textContent = msg || "";
    $("status").hidden = !msg;
  }
  function show(id) {
    ["intro", "lobby", "play", "results", "teacher"].forEach(function (s) { $(s).hidden = s !== id; });
    var u = login && login.user();
    $("whoBar").hidden = !(u && me.kind !== "practice" && id !== "intro");
    if (u) $("whoName").textContent = u.username;
  }
  function playerName(g, key) {
    if (g.cpu && g.cpu[key]) return "Computer";
    return g.players && g.players[key] ? g.players[key].name : "Computer";
  }
  // "BEERGAME_Student_005" is shown as "Student 005" on screen; downloads keep the full username.
  function shortName(n) { return String(n).replace(/^BEERGAME_/i, "").replace(/_/g, " "); }
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
    stopWatching = store.watch(gamePath(), onGame, status);
  }

  // Back to the start page. Students and lecturers stay signed in unless signOut is true.
  function leave(signOut) {
    stop();
    if (signOut && login) login.signOut();
    me = blankMe();
    scoredGame = "";
    startingGame = "";
    status("");
    showIntro();
  }

  function onGame(g) {
    var hadSeat = me.kind === "class" && !!me.role;
    // An empty team (nobody has joined yet, or the lecturer reset the games) is a waiting room with free seats.
    if (me.kind === "class" && !g) {
      if (game && game.status && game.status !== "lobby") status("Your lecturer reset the games. Choose your business again to start a new game.");
      g = {};
    }
    var seat = g && g.players && me.role ? g.players[me.role] : null;
    if (hadSeat && (!seat || seat.id !== me.id)) {
      // The seat was freed by the lecturer, or by a reset.
      me.role = "";
      if (g.status && g.status !== "lobby") {
        status("Your lecturer removed you from this game.");
      } else if (!$("status").textContent) {
        status("Your seat was freed. Choose your business again.");
      }
    }
    game = g;
    if (me.kind === "class" && !me.role) {
      // A student who already has a seat (for example on another device) gets it back.
      ROLES.forEach(function (r) { if (g.players && g.players[r.key] && g.players[r.key].id === me.id) me.role = r.key; });
    }
    var st = g.status || "lobby";
    if (st === "lobby") {
      // A team's game starts by itself once all four seats are filled.
      if (me.kind === "class" && me.role && seatsTaken(g) === ROLES.length && startingGame !== gamePath() + "/" + (g.created || "")) {
        startingGame = gamePath() + "/" + (g.created || "");
        store.update(gamePath(), startUpdate(g)).catch(function (err) { startingGame = ""; status(err.message); });
      }
      if (st === "lobby") finishingWeek = 0;
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

  /* ----- Start screen: sign in, or practice ----- */

  function showIntro() {
    show("intro");
    var u = login && login.user();
    $("signInForm").hidden = !login || !!u;
    $("signedIn").hidden = !u;
    if (u) $("signedInName").textContent = u.username;
  }

  // Who this account is, from the roster the lecturer set up: a lecturer, or a student in a team.
  function enterAs(u) {
    status("Opening…");
    return online.get("roster/" + u.uid).then(function (r) {
      if (!r) throw new Error("This account isn't set up for the Beer Game. Please ask your lecturer.");
      status("");
      me = blankMe();
      me.id = u.uid;
      me.name = r.name || u.username;
      if (r.role === "faci") {
        me.kind = "lecturer";
        openTeacher();
      } else {
        me.kind = "class";
        me.game = Number(String(r.team).replace(/\D/g, ""));
        openGame(online);
      }
    });
  }

  function setupIntro() {
    $("costRule").textContent = "Every case on your shelves costs " + money(STOCK_COST) + " a week. Every case you still owe costs " + money(OWED_COST) + " a week.";
    $("practiceRole").innerHTML = ROLES.map(function (r) { return '<option value="' + r.key + '">' + r.name + "</option>"; }).join("");
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
        status(err.message || "Couldn't sign in.");
      }).then(function () { $("signInBtn").disabled = false; });
    });
    $("continueBtn").addEventListener("click", function () {
      enterAs(login.user()).catch(function (err) { status(err.message); if (!login.user()) showIntro(); });
    });
    $("practiceBtn").addEventListener("click", startPractice);
    $("introSignOut").addEventListener("click", function () { leave(true); });
    $("signOutBtn").addEventListener("click", function () {
      // Free the seat in a game that hasn't started, so a classmate can take it.
      if (me.kind === "class" && me.role && game && (game.status || "lobby") === "lobby") {
        var update = {};
        update["players/" + me.role] = null;
        store.update(gamePath(), update).catch(function () {});
      }
      leave(true);
      status("You have signed out.");
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

  /* ----- Waiting room: each student picks a business in their team ----- */

  function renderLobby(g) {
    show("lobby");
    var players = g.players || {}, taken = seatsTaken(g);
    $("lobbyTitle").textContent = gameTitle();
    $("roleList").innerHTML = ROLES.map(function (r) {
      var p = players[r.key], who;
      if (p && p.id === me.id) who = "<strong>You</strong>";
      else if (p) who = esc(shortName(p.name));
      else who = '<button type="button" class="btn" data-role="' + r.key + '">' + (me.role ? "Switch to this role" : "Take this role") + "</button>";
      return '<li class="bg-card bg-role"><div><h3>' + r.name + '</h3><p class="bg-hint">' + r.desc + "</p></div><div>" + who + "</div></li>";
    }).join("");

    // A seated student can start without waiting for absent teammates: the computer runs the empty seats.
    $("startBtn").hidden = !me.role || taken === ROLES.length;
    var note = me.role
      ? "You are the " + roleName(me.role) + ". The game starts by itself when all 4 seats are filled (" + taken + " of 4 so far). If a teammate is away, press Start now and the computer runs their business."
      : "Choose the business you want to run. Your team is Students " + (me.game * 4 - 3) + "–" + (me.game * 4) + ".";
    $("lobbyNote").textContent = note;
  }

  function setupLobby() {
    $("roleList").addEventListener("click", function (e) {
      var key = e.target.getAttribute("data-role");
      if (!key) return;
      var update = {};
      if (me.role) update["players/" + me.role] = null;
      update["players/" + key] = { name: me.name, id: me.id };
      if (!game || !game.created) update.created = Date.now();
      var before = me.role;
      me.role = key;
      status("");
      store.update(gamePath(), update).catch(function (err) { me.role = before; status(err.message); if (game) renderLobby(game); });
    });
    $("startBtn").addEventListener("click", function () {
      if (!window.confirm("Start now? The computer will run every business that has no player.")) return;
      store.update(gamePath(), startUpdate(game)).catch(function (err) { status(err.message); });
    });
  }

  /* ----- Playing ----- */

  // The supply chain from the factory to the shoppers, with this player's business marked.
  function renderChain() {
    $("chain").innerHTML = ROLES.slice().reverse().map(function (r) {
      var mine = r.key === me.role;
      return '<li class="bg-node' + (mine ? " bg-you" : "") + '"' + (mine ? ' aria-current="true"' : "") + '><span class="bg-node-icon">' + icon(r.key) + "</span>" +
        "<b>" + r.name + (mine ? " <small>(you)</small>" : "") + "</b></li>";
    }).join("") + '<li class="bg-node bg-end"><span class="bg-node-icon">' + icon("shoppers") + "</span><b>Shoppers</b></li>";
  }

  function renderPlay(g) {
    show("play");
    renderChain();
    $("weekLabel").textContent = (me.kind === "class" ? "Team " + me.game + " · " : "") + "Week " + g.week + " of " + g.weeks;
    if (!me.role) {
      $("playTitle").textContent = gameTitle();
      $("spectator").hidden = false;
      ["numbers", "picKey", "orderForm", "cpuNote", "myHistoryBox"].forEach(function (id) { $(id).hidden = true; });
      renderWaiting(g);
      return;
    }
    $("spectator").hidden = true;
    var i = roleIndex(me.role), r = ROLES[i], b = g.state[me.role];
    $("playTitle").textContent = "You are the " + r.name;

    var asker = i === 0 ? "Shoppers want" : "The " + ROLES[i - 1].name + " ordered";
    var onWay = b.arriving1 + b.arriving2;
    // [label, picture, number shown under it, explanation]. The picture shows a range; the number is exact.
    var items = [
      ["Beer arrived", pile(b.received, false, b.received + " cases arrived"), b.received, "cases delivered to you this week"],
      ["New order", purchaseOrder(b.demand, "Purchase order for " + b.demand + " cases"), b.demand, asker + " this many cases", true],
      ["Shipped out", pile(b.shipped, false, b.shipped + " cases shipped"), b.shipped, i === 0 ? "cases sold to shoppers" : "cases sent to the " + ROLES[i - 1].name],
      ["Still owed", pile(b.owed, true, b.owed + " cases still owed"), b.owed, "orders you couldn't fill yet. Costs " + money(OWED_COST) + " per case each week"],
      ["In stock", pile(b.stock, false, b.stock + " cases in stock"), b.stock, "cases on your shelves. Costs " + money(STOCK_COST) + " per case each week"],
      ["On the way to you", truck(onWay, onWay + " cases on the way"), onWay, b.arriving1 + " next week, " + b.arriving2 + " the week after"],
      ["Your costs so far", coins(b.total, money(b.total) + " spent so far"), money(b.total), "stock and owed costs from past weeks"]
    ];
    $("numbers").hidden = false;
    $("picKey").hidden = false;
    $("numbers").innerHTML = items.map(function (it) {
      // The purchase order already shows its number on the paper, so the number below it is for screen readers only.
      return "<div><dt>" + it[0] + '</dt><dd class="bg-pic-box" aria-hidden="true">' + it[1] + "</dd>" +
        '<dd class="bg-big-num' + (it[4] ? " bg-sr-only" : "") + '">' + it[2] + '</dd><dd class="bg-hint">' + it[3] + "</dd></div>";
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
      text += "Waiting for: " + others.map(function (r) { return r.name + " (" + shortName(playerName(g, r.key)) + ")"; }).join(", ") + ".";
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
    $("leavePlay").addEventListener("click", function () { leave(false); });
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

  function myId() { return me.kind === "class" ? "g" + me.game : "practice"; }

  function renderResults(g) {
    show("results");
    var mine = entryFor(g, myId(), me.kind === "class" ? "Team " + me.game : "");

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
    var loading = online.get("beer/games").then(function (games) { return classEntries({ games: games }); });
    loading.then(function (list) {
      if (!list.some(function (e) { return e.id === mine.id; })) list.push(mine);
      showRanking(list, mine);
    }).catch(function (err) {
      $("teamRank").textContent = "—";
      $("bestTeam").textContent = "—";
      $("rankTable").innerHTML = "<tbody><tr><td>Couldn't load the ranking. " + esc(err.message) + "</td></tr></tbody>";
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
    $("againBtn").addEventListener("click", function () {
      if (me.kind === "practice") { leave(false); return; }
      leave(true);
      status("You have signed out.");
    });
    $("refreshRank").addEventListener("click", function () {
      if (game) loadRanking(game, entryFor(game, myId(), "Team " + me.game));
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
    stopWatching = store.watch("beer/games", function (games) {
      session = { games: games || {} };
      renderTeacher(session);
    }, status);
  }

  // One business's line on a team card: who plays it, and its stock, orders still owed and cost so far.
  function seatLine(g, i, r) {
    var p = g.players && g.players[r.key], st = g.status || "lobby", b = g.state && g.state[r.key], who;
    if (p) who = esc(shortName(p.name)) + (g.cpu && g.cpu[r.key] ? ' <span class="bg-hint">(computer playing)</span>' : "");
    else who = '<span class="bg-hint">' + (st === "lobby" ? "Empty seat" : "Computer") + "</span>";
    var numbers = b && st !== "lobby"
      ? '<span class="bg-seat-stats">Stock ' + b.stock + " · Owed " + b.owed + " · " + money(b.total) + "</span>" : "";
    return '<li><span class="bg-seat-role">' + r.name + '</span><span class="bg-seat-name">' + who + numbers + "</span>" +
      (p ? '<button type="button" class="bg-x" data-remove="' + i + "/" + r.key + '" aria-label="Remove ' + esc(p.name) + " from Team " + i + '">×</button>' : "") + "</li>";
  }

  function renderTeacher(s) {
    show("teacher");
    var games = s.games || {}, students = 0, playing = 0, done = 0, html = "";
    for (var i = 1; i <= MAX_GAMES; i++) {
      var g = games["g" + i] || {}, st = g.status || "lobby", taken = seatsTaken(g);
      students += taken;
      if (st === "playing") playing++;
      if (st === "done") done++;
      var label = st === "lobby" ? (taken ? "Waiting · " + taken + " of 4 seats" : "No one yet")
        : st === "playing" ? "Playing · week " + g.week + " of " + g.weeks : "Finished";
      html += '<li class="bg-card bg-game" data-status="' + st + '"><div class="bg-game-head"><h3>Team ' + i +
        ' <span class="bg-hint">Students ' + String(i * 4 - 3).padStart(3, "0") + "–" + String(i * 4).padStart(3, "0") + '</span></h3><span class="bg-tag">' + label + "</span></div>" +
        '<ul class="bg-seats">' + ROLES.map(function (r) { return seatLine(g, i, r); }).join("") + "</ul>" +
        (g.state && st !== "lobby" ? '<p class="bg-hint">Team cost ' + (st === "done" ? "" : "so far ") + "<strong>" + money(teamCost(g.state)) + "</strong></p>" : "") +
        (st === "lobby" && taken > 0 && taken < ROLES.length ? '<button type="button" class="btn" data-start="' + i + '">Start now with computer players</button>' : "") +
        "</li>";
    }
    $("gameGrid").innerHTML = html;
    $("teacherCounts").textContent = students + " student" + (students === 1 ? "" : "s") + " seated · " + playing + " playing · " +
      done + " finished · " + MAX_GAMES + " teams (room for " + MAX_GAMES * 4 + " students)";
    $("downloadClass").disabled = students === 0;
    $("resetAll").disabled = !Object.keys(games).length;
    var list = classEntries(s);
    $("teacherRanking").hidden = !list.length;
    if (list.length) {
      $("teacherRankTable").innerHTML = rankingTable(list, "");
      $("teacherBestTable").innerHTML = bestByRoleTable(list);
    }
  }

  // One row per team: names and costs for each business, plus the team's rank among finished games.
  // Opens in Google Sheets or Excel.
  function classCsv(s) {
    function cell(v) {
      v = v === undefined || v === null ? "" : String(v);
      return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    }
    var ranks = {};
    byCost(classEntries(s)).forEach(function (e, i) { ranks[e.id] = i + 1; });
    var head = ["Team", "Status", "Week reached", "Team cost"];
    ROLES.forEach(function (r) { head.push(r.name + " player", r.name + " stock", r.name + " owed", r.name + " cost"); });
    head.push("Team rank");
    var rows = [head], games = s.games || {};
    for (var n = 1; n <= MAX_GAMES; n++) {
      var g = games["g" + n] || {}, st = g.status || "lobby";
      var row = [n, st === "done" ? "Finished" : st === "playing" ? "Playing" : seatsTaken(g) ? "Waiting" : "Empty",
        g.week || "", g.state ? teamCost(g.state).toFixed(2) : ""];
      ROLES.forEach(function (r) {
        var p = g.players && g.players[r.key], b = g.state && g.state[r.key];
        row.push(p ? p.name : st === "lobby" ? "" : "Computer", b ? b.stock : "", b ? b.owed : "", b ? b.total.toFixed(2) : "");
      });
      row.push(ranks["g" + n] || "");
      rows.push(row);
    }
    // The mark at the start (a "byte order mark") tells Excel the file is UTF-8, so accented names show correctly.
    return "﻿" + rows.map(function (r) { return r.map(cell).join(","); }).join("\r\n") + "\r\n";
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
    $("downloadClass").addEventListener("click", function () {
      if (!session) return;
      var day = new Date().toISOString().slice(0, 10);
      downloadFile("beer-game-results-" + day + ".csv", classCsv(session));
    });
    $("resetAll").addEventListener("click", function () {
      if (!window.confirm("Reset all games? Every team's game, seats and results will be removed, and students choose their business again. Download the results first if you need them. This can't be undone.")) return;
      store.put("beer/games", null).then(function () {
        status("All games were reset. Students can now choose their business for a new game.");
      }, function (err) {
        status("Couldn't reset the games. " + err.message);
      });
    });
    $("gameGrid").addEventListener("click", function (e) {
      var remove = e.target.getAttribute("data-remove"), start = e.target.getAttribute("data-start");
      var base = "beer/games/g";
      if (remove) {
        var parts = remove.split("/"), g = session.games["g" + parts[0]], p = g.players[parts[1]];
        if (!window.confirm("Remove " + p.name + " from Team " + parts[0] + "? Their seat becomes free; if the game has started, the computer takes over that business.")) return;
        var update = {};
        update["players/" + parts[1]] = null;
        if (g.status && g.status !== "lobby") update["cpu/" + parts[1]] = true;
        store.update(base + parts[0], update).catch(function (err) { status(err.message); });
      }
      if (start) {
        store.update(base + start, startUpdate(session.games["g" + start])).catch(function (err) { status(err.message); });
      }
    });
  }

  setupIntro();
  setupLobby();
  setupPlay();
  setupResults();
  setupTeacher();
  if (login && login.user()) {
    // Signed in on this device before: go straight back to the game or the board.
    enterAs(login.user()).catch(function (err) { status(err.message); showIntro(); });
  } else {
    showIntro();
  }
})();
