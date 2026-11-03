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
  The address is `DB_URL` at the top of `js/beer-game.js` and `js/wms.js`;
  when the Beer Game's is empty, only practice mode works.

## Project Structure

- `index.html`: portal homepage
- `tools/`: one HTML page per tool (`site-chooser-plus.html`, `beer-game.html`, `wms.html`)
- `css/style.css`: shared styles, including light/dark colors and buttons (`.btn`)
- `css/<tool-name>.css`: optional styles for one tool, with its own light/dark colors
- `js/theme.js`: shared theme toggle
- `js/<tool-name>.js`: one script per tool

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
   - [x] First tool: "Site Chooser Plus". In: three warehouse sites'
     distances, needs and prices, plus ticks for sustainability,
     governance and labour. Out: yearly cost per site, how much each
     factor counts, and the best overall site with reasons. Keeps its
     own blue look, with a matching dark theme.
2. **More tools**: add tools one at a time using the steps above.
   - [x] Second tool: "Beer Game". 4 players, each on their own device,
     run the Retailer, Wholesaler, Distributor and Factory for 20 weeks.
     The computer runs empty or idle roles. Ways to play:
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
