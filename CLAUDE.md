# CLAUDE.md

## Tech Stack

- Plain HTML, CSS, and JavaScript only.
- No frameworks or libraries (no React, Vue, Tailwind, etc.).
- No build step: files are opened or served exactly as written.
- One exception, approved for the Beer Game only: online games are kept in a
  free Firebase Realtime Database (Spark plan). It is reached with plain web
  requests (`fetch` and `EventSource`), not Google's code library. Its address
  is `DB_URL` at the top of `js/beer-game.js`; when that is empty, only
  practice mode works.

## Project Structure

- `index.html`: portal homepage
- `tools/`: one HTML page per tool (`site-chooser-plus.html`, `beer-game.html`)
- `css/style.css`: shared styles, including light/dark colors
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
     Styling is neutral for now; the visual design comes later.
   - [x] First tool: "Site Chooser Plus". In: three warehouse sites'
     distances, needs and prices, plus ticks for sustainability,
     governance and labour. Out: yearly cost per site, how much each
     factor counts, and the best overall site with reasons. Keeps its
     own blue look, with a matching dark theme.
2. **More tools**: add tools one at a time using the steps above.
   - [x] Second tool: "Beer Game". Up to 4 players online, each on their
     own device, run the Retailer, Wholesaler, Distributor and Factory
     for 20 weeks. The computer runs empty or idle roles. Ends with a
     score card (points, medal, rank, best player, high score to beat),
     a "Top teams" table, costs and an orders chart that shows the
     bullwhip effect. Points: 100 = as good as an all-computer team;
     scores are kept under `beerScores` in the database. Also has a
     "Practice alone" mode that needs no database (it keeps a personal
     best in the browser instead).
   - [ ] Switch on online play: create the Firebase database and set
     `DB_URL` in `js/beer-game.js`.
   - Ideas: "Shipping Time to Singapore": starting port + sea or air
     in, rough total days split into steps out; landed cost with GST;
     container fit check.
3. **Polish**: group tools by topic on the homepage once there
   are enough of them.

## Rules for Claude

- Explain technical terms in plain language.
- Ask before making big changes.
- When something is unclear, ask rather than guess.
