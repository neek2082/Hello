# CLAUDE.md

## Tech Stack

- Plain HTML, CSS, and JavaScript only.
- No frameworks or libraries (no React, Vue, Tailwind, etc.).
- No build step: files are opened or served exactly as written.
- One exception, approved for the Beer Game and the WMS only: online data is
  kept in a free Firebase Realtime Database (Spark plan). It is reached with
  plain web requests (`fetch` and `EventSource`), not Google's code library.
  Each tool has its own project, both in Singapore (asia-southeast1): the
  Beer Game uses `beer-game-data`, the WMS uses `my-second-project-72735`.
  The address is `DB_URL` at the top of `js/beer-game.js` and `js/wms.js`.
- Both tools also use Firebase sign-in (Email/Password), again with plain web
  requests (`js/firebase-login.js`). Each project's public Web API key is
  `API_KEY` at the top of each tool's script; when it is empty, signing in is
  off (the Beer Game's practice mode still works).
- Accounts are handed out by the lecturer, never made by visitors (new
  sign-ups are switched off in Firebase). Per tool: 60 students and 3
  lecturers, e.g. `BEERGAME_Student_001`, `WMS_Faci_001`. Firebase stores them
  as `beergame_student_001@beergame.example` (`.example` can never receive
  email). Passwords are random and are never kept in this repository.
- `roster/<account id>` in each database says who an account is (`role`
  "student" or "faci", `name`, and `team` or `w`/`p`). The database rules
  (`firebase/*.rules.json`, pasted into each project's Rules tab) use it:
  students only reach their own team or warehouse, lecturers reach everything.
  Each account may write its own roster entry once (done by the one-time
  setup page); after that only the Firebase console can change it.

## Project Structure

- `index.html`: portal homepage
- `tools/`: one HTML page per tool (`warehouse-site-selector.html`, `beer-game.html`, `wms.html`).
  `site-chooser-plus.html` is only a forwarding page to `warehouse-site-selector.html`, kept so old links work.
- `css/style.css`: shared styles, including light/dark colors and buttons (`.btn`)
- `css/<tool-name>.css`: optional styles for one tool, with its own light/dark colors
- `js/theme.js`: shared theme toggle
- `js/<tool-name>.js`: one script per tool
- `js/firebase-login.js`: shared sign-in and signed-in database access (Beer Game, WMS)
- `firebase/`: the database rules published in each Firebase project

Update this section as files are added.

## Key Requirements

1. Every page must be responsive and work on desktop, tablet and phone.
2. Users can toggle between a light and a dark theme. The default is the light theme.
3. Text must stay easy to read, with good contrast, in both the light and the dark theme.

## Feature Plan

"Warehousing Tools": a portal where the curious public can try small
warehousing and supply chain tools. Plain language throughout.

### Portal structure

- **Homepage** (`index.html`): short intro and a grid of tool cards.
  Each card has a name, a one-line description and a link.
- **Opening a tool**: clicking a card opens that tool's own page
  in `tools/`.
- **Getting back**: every tool page has the shared header. Its site
  name links home, plus an "← All tools" link above the tool.
- **Adding a tool later**: create `tools/<tool-name>.html` and
  `js/<tool-name>.js` (plus `css/<tool-name>.css` if the tool needs
  its own look), then add one card to `index.html`. Shared
  styles (`css/style.css`) and the theme toggle (`js/theme.js`)
  are reused as-is.

### Phases

1. **Portal + first tool**
   - [x] Portal: homepage, shared header with theme toggle, and a
     placeholder card "Tool 1 — coming soon" that opens and returns.
   - [x] Visual design "Warehouse floor": charcoal and safety yellow,
     like warehouse signage. Charcoal header with a yellow stripe and a
     house logo on every page, a yellow banner on the homepage (charcoal
     in dark), cards with thick outlines and solid offset shadows, and
     simple line icons (inline SVG, drawn in the text color). All colors
     are variables at the top of `css/style.css`.
   - [x] First tool: "Site Chooser Plus" (replaced, see below).
   - [x] "Warehouse Site Selector" replaces Site Chooser Plus. Step 1: a
     slider splits Cost vs Other factors (default 60 / 40). Step 2: the
     yearly total cost of 3 sites (rent + utilities + transport, typed in);
     cost points = lowest cost ÷ this site's cost × 5. Step 3: the user
     types or taps 5 other factors (e.g. educated workforce, stable
     government, government incentives), picks an importance level for each
     (Low 1 … Critical 5, turned into percentages that add up to 100%; a
     "Suggest importance" button uses built-in word rules with a reason,
     not live AI), then rates each site 1–5 per factor; other-factor points
     = ratings weighted by importance. Step 4: results table and the winner
     with reasons. Keeps the blue look, with a matching dark theme. Files:
     `tools/warehouse-site-selector.html`, `css/warehouse-site-selector.css`,
     `js/warehouse-site-selector.js` (rules and ideas are lists at the top).
2. **More tools**: add tools one at a time using the steps above.
   - [x] Sign-in for the Beer Game and the WMS (replaces class codes):
     the account decides the view. Students go straight to their own team
     or warehouse; lecturers see every team or warehouse live and can reset
     them all. "Play with friends" and the WMS lesson-date window were
     removed. Details below are from before this change where they mention
     codes, class sessions or dates.
   - [x] Second tool: "Beer Game". 4 players, each on their own device,
     run the Retailer, Wholesaler, Distributor and Factory for 20 weeks.
     The computer runs empty or idle roles. Now: Students 001–004 are
     Team 1, 005–008 Team 2 … (15 teams); each picks a business in their
     team's game, which starts when 4 seats are filled or when a seated
     student or a lecturer presses Start now. The lecturer board shows each
     team's week, each business's stock, orders owed and cost, removes
     students, downloads a CSV and resets all games. Practice alone needs no
     sign-in. Before sign-in, the ways to play were:
     - **Class session**: a lecturer gets one code for up to 25 games.
       Students join with the code and are seated in order (Game 1
       Retailer → Factory, then Game 2…). Each game starts by itself when
       its 4 seats are full; the lecturer can start a part-full game with
       computer players, or remove a student (who rejoins for the next
       free seat). The lecturer's board shows every game, seat and cost
       live, plus the class ranking. It can download the results as a
       CSV (opens in Google Sheets or Excel) and delete the class (only
       on the lecturer's own device; finished students keep their score
       card, waiting students are sent back to the start page). Closing
       the board keeps the class, and the start page offers to go back.
     - **Play with friends**: one game, shared by code.
     - **Practice alone**: no database needed.
     Each week shows a picture of the supply chain (Factory → Distributor
     → Wholesaler → Retailer → Shoppers) with the player's business
     highlighted. Each weekly number has a picture above it that shows a
     range, with the exact number below: crate piles for beer arrived,
     shipped out and in stock (1 crate = 1–10 cases, 2 = 11–20, 3 = 21–40,
     4 = 41–80, 5 = more), dashed crates for cases still owed, a truck
     carrying crates for beer on the way, a coin stack for costs, and a
     "PO" paper with the quantity for the new order. A key explains the
     ranges.
     Costs per business per week: $1 per case in stock, $2 per case still
     owed (`STOCK_COST` and `OWED_COST` in `js/beer-game.js`).
     Scoring is cost only (lower is better): a score card with the team
     cost, each business's cost and rank, the team rank, and the lowest
     team cost; then a ranking by team cost with each business's cost,
     and the best player in each business. Class rankings use the
     session's games; friends' games are saved under `beerScores`.
   - [x] Switch on online play: Firebase project `beer-game-data`,
     Realtime Database in Singapore (asia-southeast1), set as `DB_URL`
     in `js/beer-game.js`.
   - [x] Third tool: "Warehouse Practice (WMS)" for a 4-day class lesson.
     Now: Students 001–006 are Warehouse 1 places 1–6, 007–012 Warehouse 2 …
     (10 warehouses); logs live at `wms/log/w<n>`; lecturers see all 60
     students and can reset all warehouses. Before sign-in:
     A lecturer starts a class (1–5 warehouses, 6 students each, up to 30)
     with its first and last lesson day; students can only join and work
     between those days (the database rules check this with the server's
     clock). Students join with the class code and their name or student
     number, are placed in order (Warehouse 1 places 1–6, then Warehouse 2),
     and rejoin with the same name. Each place has its own 3 purchase orders
     (PO-1011…) and 3 sales orders (SO-2011…) of 2 lines, the same in every
     warehouse. The student screen works like a real WMS: a side menu
     (Dashboard, Receiving, Put-away, Picking, Pack & ship, Inventory,
     Warehouse map, Transactions), document statuses (Open → Receiving →
     Received → Closed; Released → Picking → Picked → Shipped), and a
     warehouse map of aisles and bins. 21 steps each: receive each PO line
     at dock R1, put it away into its bin (the suggested bin is required; the
     map marks it "GO HERE"), pick each SO line from its bin (the map numbers
     the walk route; not enough in the bin = wait and retry), then pack and
     ship each SO from dock S1. Mistakes get WMS-style system messages, never
     a score; refused entries are logged for the lecturer. Live updates only
     redraw what changed, so a student's half-typed entry is never lost.
     Stock is never stored: each warehouse keeps an add-only transaction
     log, and every screen replays it in order to get bin and dock stock, so
     two students can't overwrite each other. The 11 SKUs (each with one
     bin) and order sets are sample data in editable lists at the top of
     `js/wms.js`. The lecturer's board shows each warehouse's students
     (steps out of 21, documents closed, refused entries), bin and dock
     stock, and activity live, downloads a student summary and the full
     transaction log (with system messages) as CSV, and can delete the class.
   - Ideas: "Shipping Time to Singapore": starting port + sea or air
     in, rough total days split into steps out; landed cost with GST;
     container fit check.
3. **Polish**: group tools by topic on the homepage once there
   are enough of them.

## Rules for Claude

- Explain technical terms in plain language.
- Ask before making big changes.
- When something is unclear, ask rather than guess.
