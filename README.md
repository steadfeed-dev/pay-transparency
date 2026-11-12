# Pay Transparency Compliance Monitor — public site

Static landing page for [Pay Transparency Compliance Monitor](https://apify.com/steadfeed/pay-transparency-compliance-monitor), a Steadfeed product.

- No build step and no cookies. Cloudflare Web Analytics (cookie-free, aggregate visit counts) is the only third-party script. One tiny script (`assets/site.js`) toggles the mobile menu. Font is self-hosted (Inter variable, SIL Open Font License). Icons are inline SVG.
- The hero “Example report” and the “Sample output (example data)” section use fictional postings from an invented “Example Co.” and are labeled as such. No real company postings are shown. Findings, when present, are potential issues for human review.
- GitHub Pages is served from the `main` branch, site root. Live URL: `https://getsteadfeed.com/`. The previous project URL, `https://steadfeed-dev.github.io/pay-transparency/`, redirects to the custom domain.
- Custom domain: the `CNAME` file contains `getsteadfeed.com`. HTTPS is enforced once GitHub has issued the certificate.

CTA links to the Apify Store include UTM parameters (`utm_source=steadfeed-site`) so conversions can be read from Store traffic, not from trackers on this site.
