# Steadfeed — public site (getsteadfeed.com)

Static website for Steadfeed, a small software studio making practical web and data tools sold pay-per-use on the [Apify Store](https://apify.com/steadfeed).

## Pages
- `/` (`index.html`): Steadfeed home. Short intro, an "Are you in HR? This way" callout to the Pay Transparency page, and a product grid for every public Steadfeed tool, grouped as HR & hiring, Website audits & AI visibility, Monitoring & capture, and AI assistant tools (Site Audit MCP Server).
- `/pay-transparency/`: the Pay Transparency Compliance Monitor landing page (moved intact from `/`).
- `/privacy.html`, `404.html`, `robots.txt`, `sitemap.xml`.

Old single-page links such as `getsteadfeed.com/#pricing` or `/#faq` are forwarded to the same section on `/pay-transparency/` by a small inline script in the home page `<head>` (query strings are kept).

## Notes
- No build step and no cookies. Cloudflare Web Analytics (cookie-free, aggregate visit counts) is the only third-party script. `assets/site.js` toggles the mobile menu. Font is self-hosted (Inter variable, SIL Open Font License). Icons are inline SVG.
- PTCM example reports use fictional postings from an invented "Example Co." and are labeled as such. Findings are potential issues for human review, not legal advice.
- Product names, descriptions and prices on the home page come from the public Apify Store listings. Update them when a Store listing changes.
- GitHub Pages is served from the `main` branch, site root. Custom domain: `CNAME` contains `getsteadfeed.com`.
- Links to the Apify Store include UTM parameters (`utm_source=steadfeed-site`; campaign `steadfeed-home` on the home page, `ptcm-landing` on the PTCM page) so conversions can be read from Store traffic, not from trackers on this site.
