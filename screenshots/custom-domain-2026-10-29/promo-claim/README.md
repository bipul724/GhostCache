# .tech promo-claim evidence — October 29, 2026

Domain: bipulchamoli.tech. GhostCache is served from its subdomain https://ghostcache.bipulchamoli.tech/ ([custom-domain evidence](../README.md)).

The owner confirmed that bipulchamoli.tech was registered using the Hacktoberfest 2026 .tech promotion. The two screenshots below support that account. The owner supplied both of them, and they are archived here exactly as supplied. They are cropped or redacted. They are neither original, unedited captures nor independently authenticated registration records. This folder holds only these copies. Whether unredacted originals exist elsewhere was not checked.

## Evidence

### [01-hacktoberfest-tech-offer-redacted.png](01-hacktoberfest-tech-offer-redacted.png)

- **What it shows.** An MLH page headed "HACKTOBERFEST 2026" and "Claim your .Tech 2026 Promo Code", with the account name Bipul Chamoli in the navigation bar. A notice reads "Already Claimed. You've already claimed your .Tech 2026 promo code. Your previously claimed codes are listed below." Under it, the page says that a promo code may be claimed only once per applicable sponsor at this event.
- **What it demonstrates.** By the time of capture, the signed-in MLH account had claimed the .Tech 2026 promo code for Hacktoberfest 2026.
- **Visible cropping.** The image shows only the top of the page. It ends above the list of previously claimed codes, so no code is visible. No browser address bar, URL or capture date is visible.
- **What it does not show.** It does not show when the code was claimed or which domain, if any, it was redeemed for.

### [02-domain-registration-confirmation.png](02-domain-registration-confirmation.png)

- **What it shows.** A printed Gmail view of the email "Registration of bipulchamoli.tech for 1 year(s)" from the ".tech domains" no-reply sender. The email is dated 11 October 2026 at 15:54, with no time zone shown. The body is branded .TECH Domains, "powered by namify", and says "Your domain bipulchamoli.tech is successfully registered".
- **Which date is which.**
  - **Confirmation email date.** The registration confirmation email is dated October 11, 2026.
  - **Print timestamp.** The browser print header at the top reads "10/29/26, 1:24 PM". That timestamp records when the email was printed, not when the domain was registered.
- **What it demonstrates.** bipulchamoli.tech was registered for one year, as confirmed by a .tech registration email dated October 11, 2026.
- **Visible redaction and cropping.** Three areas are covered by black or cross-hatched bars:
  - the text after the account name in the Gmail header;
  - a line under the sender line;
  - a band across the bottom of the image.

  The image ends partway through the email, at the start of a "TITAN" promotional card, so the rest of the message is not shown.
- **What it does not show.** It shows no price, discount, coupon or promo code.

## What this supports, and its limits

- **Promo origin.** The claimed-promo screenshot and the registration confirmation support the owner's account. Neither one explicitly shows the exact promo code that was applied to this domain. The link between the claimed code and this registration therefore rests on the owner's confirmation.
- **Authenticity.** Neither screenshot was checked against MLH, the .tech registry, the registrar or the email's source.
- **Working domain.** The DNS and HTTPS evidence for https://ghostcache.bipulchamoli.tech/ is recorded separately in the [parent folder](../README.md). That folder covers the Render custom-domain status and the HTTPS checks. Those records do not establish promo provenance, and this folder does not establish the working domain.
- **Category.** These records do not establish organizer-confirmed eligibility for Best Use of a .tech Domain. They also do not establish a formal category entry. Only the DEV submission enters a category. The .tech category is currently dropped from the intended scope. *(Resolved October 29, 2026: the user restored Best Use of a .tech Domain as the fifth intended category (DECISIONS.md D-14, third amendment). It is intended, not entered, and its eligibility is not organizer-confirmed. See [CATEGORIES.md](../../../CATEGORIES.md#best-use-of-a-tech-domain).)*

## Verify checksums

[SHA256SUMS.txt](SHA256SUMS.txt) covers the two PNG files. It excludes this README and the manifest itself. To check it, run this from the repository root:

    (cd screenshots/custom-domain-2026-10-29/promo-claim && shasum -a 256 -c SHA256SUMS.txt)
