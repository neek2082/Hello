# Warehouse Site Selection Tools

Two simple, browser-based tools that help students choose the best site for a new warehouse. Both were built for **E215 – Warehousing and Storage, Lesson 15: Site Selection**.

No login, no database and no installation are needed. Each tool is a single HTML file that runs in any web browser.

---

## The tools

### 1. Warehouse Site Chooser (`site-chooser.html`)

This tool follows the **systematic site selection** method from the lesson. It compares three sites by cost and sustainability.

- Works out the **yearly cost** of each site: transport, rent, electricity and water.
- Shows **how each cost was worked out**, step by step, in the same layout as the lesson slides.
- Scores each site on **six sustainability points**.
- Combines cost and sustainability into one score, with a slider for how much cost counts. The default is 60% cost and 40% sustainability, as in the lesson.
- Shows the point at which a different site would win.

### 2. Site Chooser Plus (`site-chooser-plus.html`)

This version does everything in the first tool and adds two more factors, **governance** and **labour availability**. It also helps students understand *why* the non-cost factors matter and *how much* each one should count.

- **Why look beyond cost?** A short explanation of each factor and what can go wrong if it is ignored.
- **Checklists** for sustainability, governance and labour, each with a one-line reason for every point.
- **Company profiles** that suggest a weightage with an explanation. The profiles are a low-price furniture seller, a medicine distributor, a global brand with a net-zero promise, and an online shop fulfilment centre.
- **Four guided questions** for students who are not sure what weightage to use.
- **A result** in the style of the lesson's scoring table, with a stacked bar chart and a plain-language explanation of why the winning site won.
- **A draft recommendation** that students can copy and edit for their assignment.

---

## Features in both tools

| Feature | What it does |
|---|---|
| **Hide answers** | Blurs all results so students can work out the answers first, then reveal them to check. |
| **Load lesson example** | Fills in the worked example from the lesson. |
| **Clear all figures** | Empties the form so you can set a new exercise. |
| **Rename sites and customers** | Type over any name to match your own exercise. |
| **Add or remove customers** | Use any number of customers from 1 to 8. |

---

## How the scores are worked out

These are the same steps as in the lesson.

**Yearly cost of each site**

- **Transport** = 2 × (distance to each customer × trips per year, added together) × truck cost per km. The distance is doubled because each truck makes the trip there and back.
- **Rent** = floor area × rent per m² per month × 12
- **Electricity** = kWh used per month × price per kWh × 12
- **Water** = m³ used per month × price per m³ × 12
- **Total** = transport + rent + electricity + water

**Points (out of 5)**

- **Cost:** cheapest site gets 5, second cheapest 4.5, third cheapest 4.
- **Sustainability, governance and labour:** a site that meets 5 or more checklist points gets 5. One that meets 4 gets 4, one that meets 3 gets 3, and so on.

**Final score**

Each factor's points are multiplied by how much that factor counts, then added together. For example, with cost at 60% and sustainability at 40%:

| Site | Cost points | Sustainability points | Final score |
|---|---|---|---|
| Site 1 | 4.0 | 3 | 4.0 × 0.6 + 3 × 0.4 = **3.6** |
| Site 2 | 5.0 | 4 | 5.0 × 0.6 + 4 × 0.4 = **4.6** |
| Site 3 | 4.5 | 5 | 4.5 × 0.6 + 5 × 0.4 = **4.7** |

On cost alone, Site 2 is the best choice. Once sustainability is counted, Site 3 comes out on top.

---

## Lesson example figures

| | Dealer A | Dealer B | Dealer C |
|---|---|---|---|
| Site 1 distance (km) | 53 | 72 | 73 |
| Site 2 distance (km) | 84 | 84 | 47 |
| Site 3 distance (km) | 75 | 58 | 57 |
| Trips per year | 52 | 72 | 69 |

| | Area (m²) | Rent per m² per month | Electricity per month (kWh) | Water per month (m³) |
|---|---|---|---|---|
| Site 1 | 30,000 | $7.20 | 70,000 | 400 |
| Site 2 | 28,000 | $7.18 | 70,500 | 402 |
| Site 3 | 29,000 | $7.19 | 70,100 | 395 |

Prices: truck $0.80 per km, electricity $0.40 per kWh, water $2.00 per m³.

| | Yearly total cost |
|---|---|
| Site 1 | $2,958,363.20 |
| Site 2 | $2,782,382.40 |
| Site 3 | $2,867,294.40 |

> **Note:** In the Site Chooser Plus, the governance and labour ticks in the example are sample answers added for practice. They are not part of the original lesson.

---

## How to use the tools

### Open on your own computer

Download the HTML file and double-click it. It opens in your web browser.

### Put them online with GitHub Pages (free)

1. Upload `site-chooser.html` and `site-chooser-plus.html` to this repository.
2. Go to **Settings → Pages**.
3. Under **Branch**, choose `main` and the `/ (root)` folder, then click **Save**.
4. After a minute or two, the tools will be online at:
   - `https://<your-username>.github.io/<repository-name>/site-chooser.html`
   - `https://<your-username>.github.io/<repository-name>/site-chooser-plus.html`

Anyone with the link can use the tools. No account is needed.

### Add them to a learning platform

Each file is plain HTML, CSS and JavaScript in one file, with no frameworks or build step. Copy the whole file and paste it into an HTML block on your learning platform, or upload the file directly.

---

## Changing the tools

- **New exercise figures:** use **Clear all figures** in the tool and type in the new numbers. You don't need to change any code.
- **Checklist points or company profiles:** open the HTML file in any text editor and find `LISTS` (the checklists) or `PROFILES` (the company types) near the start of the `<script>` section.
- **Colours:** the blue-and-white colour scheme is set at the top of the `<style>` section, under `:root`.

---

## Files

```
site-chooser.html        Cost and sustainability (matches the lesson)
site-chooser-plus.html   Adds governance, labour and weightage guidance
README.md                This file
```
