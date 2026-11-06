// Signing in with Firebase accounts, using plain web requests to Firebase's sign-in service (no Google library).
// Used by the Beer Game and the WMS. Each tool has its own Firebase project, so each passes its own settings:
//   var login = FirebaseLogin({ apiKey: "...", domain: "beergame.example", saveKey: "beerLogin" });
//
// Usernames like BEERGAME_Student_001 are turned into the email address Firebase needs
// (beergame_student_001@beergame.example). ".example" addresses are reserved and can never receive email,
// so nobody can use "forgot password" emails to take over an account.
//
// After signing in, Firebase gives two keys:
//   - a sign-in token (idToken), added to every database request so the database rules know who is asking.
//     It runs out after an hour.
//   - a refresh key (refreshToken), used to get a new sign-in token without asking for the password again.
// Both are kept in this browser until the person signs out.
(function () {
  window.FirebaseLogin = function (opts) {
    var SIGN_IN = "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=" + opts.apiKey;
    var REFRESH = "https://securetoken.googleapis.com/v1/token?key=" + opts.apiKey;
    var user = load(), refreshing = null;

    function load() {
      try { return JSON.parse(localStorage.getItem(opts.saveKey)); } catch (e) { return null; }
    }
    function store(u) {
      user = u;
      try {
        if (u) localStorage.setItem(opts.saveKey, JSON.stringify(u));
        else localStorage.removeItem(opts.saveKey);
      } catch (e) { /* storage blocked: the person stays signed in until the tab is closed */ }
    }

    function emailFor(username) { return String(username).trim().toLowerCase() + "@" + opts.domain; }

    // Turns Firebase's error codes into plain sentences.
    function explain(code) {
      code = String(code || "");
      if (/INVALID_LOGIN_CREDENTIALS|EMAIL_NOT_FOUND|INVALID_PASSWORD|INVALID_EMAIL|MISSING_PASSWORD/.test(code)) return "Wrong username or password. Check them on your slip and try again.";
      if (/TOO_MANY_ATTEMPTS/.test(code)) return "Too many tries. Please wait a few minutes and try again.";
      if (/USER_DISABLED/.test(code)) return "This account has been switched off. Please ask your lecturer.";
      if (/TOKEN_EXPIRED|INVALID_REFRESH_TOKEN|USER_NOT_FOUND/.test(code)) return "You've been signed out. Please sign in again.";
      return "Couldn't sign in (" + code + "). Please try again.";
    }

    function post(url, body, asForm) {
      return fetch(url, {
        method: "POST",
        headers: { "Content-Type": asForm ? "application/x-www-form-urlencoded" : "application/json" },
        body: asForm ? body : JSON.stringify(body)
      }).then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) throw new Error(explain(data && data.error && data.error.message));
          return data;
        });
      }, function () { throw new Error("Couldn't reach the sign-in service. Check your internet connection."); });
    }

    function signIn(username, password) {
      return post(SIGN_IN, { email: emailFor(username), password: String(password).trim(), returnSecureToken: true }).then(function (d) {
        store({
          uid: d.localId,
          username: String(username).trim(),
          idToken: d.idToken,
          refreshToken: d.refreshToken,
          expires: Date.now() + Number(d.expiresIn) * 1000
        });
        return user;
      });
    }

    // A sign-in token that is good for at least 5 more minutes, renewing it first if needed.
    function token() {
      if (!user) return Promise.reject(new Error("Please sign in."));
      if (user.expires - Date.now() > 5 * 60 * 1000) return Promise.resolve(user.idToken);
      if (!refreshing) {
        refreshing = post(REFRESH, "grant_type=refresh_token&refresh_token=" + encodeURIComponent(user.refreshToken), true).then(function (d) {
          refreshing = null;
          store({ uid: d.user_id, username: user.username, idToken: d.id_token, refreshToken: d.refresh_token,
            expires: Date.now() + Number(d.expires_in) * 1000 });
          return user.idToken;
        }, function (err) {
          refreshing = null;
          if (/signed out/.test(err.message)) store(null);
          throw err;
        });
      }
      return refreshing;
    }

    return {
      user: function () { return user; },
      signIn: signIn,
      signOut: function () { store(null); },
      token: token
    };
  };

  // Reading and writing the Realtime Database with its web address (REST), signed in.
  // Every request carries the sign-in token, so the database rules can check who is asking.
  // A refused request (the rules said no) fails with an error whose message is "refused".
  window.FirebaseData = function (base, login) {
    base = base.replace(/\/+$/, "");
    function at(path, tok) { return base + "/" + path + ".json?auth=" + encodeURIComponent(tok); }

    function send(method, path, body) {
      return login.token().then(function (tok) {
        return fetch(at(path, tok), { method: method, body: body === undefined ? undefined : JSON.stringify(body) });
      }).then(function (res) {
        if (res.status === 401) throw new Error("refused");
        if (!res.ok) throw new Error("The server refused the request (error " + res.status + ").");
        return res.json();
      });
    }

    // Follows a place in the database live. fn gets the whole value every time it changes.
    // When the sign-in token runs out, the database closes the connection ("auth_revoked"),
    // so it reconnects with a fresh token.
    function watch(path, fn, onStatus) {
      var data = null, es = null, stopped = false;
      function open() {
        login.token().then(function (tok) {
          if (stopped) return;
          es = new EventSource(at(path, tok));
          es.addEventListener("put", function (e) { handle(e, false); });
          es.addEventListener("patch", function (e) { handle(e, true); });
          es.addEventListener("cancel", function () { onStatus("You don't have access to this. Try signing out and in again."); });
          es.addEventListener("auth_revoked", function () { es.close(); open(); });
          es.onopen = function () { onStatus(""); };
          es.onerror = function () { onStatus("Connection lost. Trying to reconnect…"); };
        }, function (err) { onStatus(err.message); });
      }
      function handle(e, isPatch) {
        var msg = JSON.parse(e.data);
        data = isPatch ? applyUpdate(data || {}, msg.path, msg.data) : setPath(data, msg.path, msg.data);
        fn(copy(data));
      }
      open();
      return function () { stopped = true; if (es) es.close(); };
    }

    return {
      get: function (path) { return send("GET", path); },
      put: function (path, value) { return send("PUT", path, value); },
      update: function (path, obj) { return send("PATCH", path, obj); },
      post: function (path, value) { return send("POST", path, value); },
      watch: watch
    };
  };

  function copy(o) { return o === undefined ? undefined : JSON.parse(JSON.stringify(o)); }
  function keysOf(path) { return path.split("/").filter(Boolean); }
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
})();
