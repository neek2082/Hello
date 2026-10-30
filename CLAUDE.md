# CLAUDE.md

## Tech Stack

- Plain HTML, CSS, and JavaScript only.
- No frameworks or libraries (no React, Vue, Tailwind, etc.).
- No build step: files are opened or served exactly as written.

## Project Structure

- `index.html`: portal homepage
- `tools/`: one HTML page per tool (`site-chooser-plus.html`)
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

A portal where the curious public can try small supply chain
management tools. Plain language throughout.

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
2. **More tools**: add tools one at a time using the steps above
   (ideas: "Shipping Time to Singapore": starting port + sea or air
   in, rough total days split into steps out; landed cost with GST;
   container fit check).
3. **Polish**: group tools by topic on the homepage once there
   are enough of them.

## Rules for Claude

- Explain technical terms in plain language.
- Ask before making big changes.
- When something is unclear, ask rather than guess.
