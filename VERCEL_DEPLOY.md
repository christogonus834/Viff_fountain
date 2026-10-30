# Put the DEMO online (Vercel) - this folder only

This folder is the hardcoded demo: no server, no database, fake sample data. Deploy THIS folder, never the live project.

1. On a laptop with Node installed, open a terminal in THIS folder (the one containing index.html).
2. Run:  npx vercel        (log in when asked; answer the questions with the defaults; there is no build step)
3. Run:  npx vercel --prod   to get the final link. Send the link to the client.

Notes
- The site is set to "noindex" (hidden from Google) and robots.txt blocks crawlers, but anyone with the link can see the demo logins on the login page.
- Everything a visitor changes stays in THEIR browser only. Add ?reset to any page address to restore the sample data.
- Before sending: replace the old school facts on the public pages (founding year, address, phone, history) with VIFF's real details.
