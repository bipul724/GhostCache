# Custom-domain evidence — October 29, 2026

GhostCache: https://ghostcache.bipulchamoli.tech/

## Evidence

- [Render screenshot](01-render-custom-domain-verified-certificate-issued.png): user-supplied capture labelled October 29, 2026 at 02:10:39 IST. Shows the hostname Verified, Certificate Issued, and the original onrender.com address enabled. Copied without editing; original retained.
- [Final direct-curl verification](verification-direct-curl.json): successful normal HTTPS GETs, TLS verification results, selected headers, actual asset hashes and Git comparisons. This is the latest verification record.
- [Earlier curl-client attempt](verification-curl.json): retained custom-hostname TLS failures and successful portfolio/onrender controls.
- [First Python attempt](verification.json): retained TLS failures, including local certificate-chain failures on control URLs.
- [Checksums](SHA256SUMS.txt): the screenshot and all three JSON reports; this index is excluded.

## Results and boundaries

Normal HTTPS requests returned 200 for the new hostname's page, stylesheet, JavaScript and evidence JSON. All four responses were byte-identical to their committed files at the Git revision recorded in the final report. No certificate-validation bypass or DNS override was used for those final requests. The exact /api/state returned 404. The successful page response included CSP, nosniff, no-referrer and frame-denial headers.

The CNAME points to ghostcache-walkthrough.onrender.com. During verification, the local resolver initially returned old Vercel addresses and some client requests failed TLS. The authoritative nameserver and resolver 1.1.1.1 already returned the correct CNAME. After the old cache TTL expired, the local resolver returned the correct CNAME and Render addresses, and a final normal JavaScript request succeeded. A separate diagnostic request had used curl --resolve with normal TLS validation; this is disclosed in the final report. The successful final requests did not need that override. Global DNS propagation was not established.

The portfolio remained reachable through its normal redirect to https://www.bipulchamoli.tech/ (HTTP 200, title Bipul Chamoli — Full-stack Engineer). This confirms reachability at check time, not a full before/after comparison. The checking agent did not change DNS records or the portfolio.

The user confirmed Hacktoberfest promo provenance. No independent claim or registration document was checked or saved here. Render verification establishes domain configuration and certificate status, not promo provenance or formal prize-category entry. Current category-scope documentation has not been amended by this verification task.

No browser controls, viewport, physical-phone, other-browser or accessibility checks were repeated on this hostname. No unit tests, fixture evaluation or live model calls were performed. Earlier evidence folders and their manifests remain unchanged.

## Verify checksums

From the repository root:

    (cd screenshots/custom-domain-2026-10-29 && shasum -a 256 -c SHA256SUMS.txt)
