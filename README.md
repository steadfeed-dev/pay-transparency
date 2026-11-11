# Pay Transparency Compliance Monitor — public site

Static landing page for [Pay Transparency Compliance Monitor](https://apify.com/steadfeed/pay-transparency-compliance-monitor), a Steadfeed product from OSW LLC (Our Spark Works).

- No build step, no cookies, no analytics, no third-party requests. One tiny script (`assets/site.js`) toggles the mobile menu. Font is self-hosted (Inter variable, SIL Open Font License). Icons are inline SVG.
- The hero “Example report” is synthetic and labeled as such. The “Live sample” section is from an actual Actor run (build 0.1.9, run `jh1xTIXx2SaHObimw`, 10 November 2026, 8:31 PM PT). Source files are in `assets/sample/`. Findings, when present, are potential issues for human review.
- GitHub Pages is served from the `main` branch, site root. Live URL: `https://getsteadfeed.com/`. The previous project URL, `https://steadfeed-dev.github.io/pay-transparency/`, redirects to the custom domain.
- Custom domain: the `CNAME` file contains `getsteadfeed.com`. HTTPS is enforced once GitHub has issued the certificate.

CTA links to the Apify Store include UTM parameters (`utm_source=steadfeed-site`) so conversions can be read from Store traffic, not from trackers on this site.
