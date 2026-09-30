# AgentPal

A fast, simple toolkit for real estate agents: quick calculators with plain-English breakdowns, a profile for every buyer and seller, one-tap branded reports to send to clients, deal reminders, and team-wide notifications.

## What's in v1

| Area | What agents get |
| --- | --- |
| **Signup** | Name, email, **cell phone** (required and normalized to +1…), brokerage, market, and an explicit, unchecked-by-default SMS consent checkbox (TCPA). The first account created becomes the admin. |
| **Calculators** | Buyer Breakdown (payment + cash to close, FHA/VA/Conventional/Cash, seller-concession caps), Seller Net Sheet, What Can I Afford?, Rent vs Buy, Sell to Net, Points Buydown, Refinance, Extra Payment. Results update **as you type**, with no Compute button. |
| **Quick breakdown** | Every result includes 2–5 plain-English bullets an agent can read to a client word-for-word ("Every 1/8% in rate moves the payment ~$32/mo"). |
| **Client profiles** | Buyer/seller, stage (lead → active → under contract → closed), budget, pre-approval, lender, area, address, closing date, follow-up date, notes, and every saved breakdown. Calculators pre-fill from the client's budget. |
| **Share** | Saving a breakdown creates a private link (`/r/…`): a mobile-friendly, agent-branded report with Call/Text buttons, assumptions, disclaimer, and print-to-PDF. One tap to text or email it. |
| **Market defaults** | Each agent sets their rate, tax, insurance, commission, title and transfer-tax defaults once, and every calculator starts there. |
| **Notifications** | In-app bell and inbox. Automatic reminders 7/3/1/0 days before closing and on follow-up dates. Admin broadcasts go in-app, by **email** (Resend) and by **SMS** (Twilio, opted-in agents only, with STOP language). |
| **Admin** | Agent list with name, email, cell, brokerage, activity and SMS opt-in; CSV export; broadcast history; promote other admins. |

## Run it

```bash
npm install
cp .env.example .env   # optional: email/SMS keys, cron secret
npm run dev            # http://localhost:3000
```

Sign up. The first account is the admin. Data lives in `./data/agentpal.db` (SQLite via Node's built-in `node:sqlite`, so there's no database to install). Node 22.13+ is required.

### Daily reminders

Reminders are generated whenever an agent opens the app. To also reach agents who haven't logged in, call the cron endpoint once a day:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://your-domain.com/api/cron/reminders
```

### Email & SMS

- **Email:** set `RESEND_API_KEY` and `EMAIL_FROM` (verified domain).
- **SMS:** set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`. US business texting requires **A2P 10DLC registration** with Twilio before messages deliver.

The admin screen greys out a channel until its keys are present.

## Going to production

- **Hosting:** SQLite needs a persistent disk. Deploy to Railway, Render, Fly.io or a VPS with a mounted volume and set `DATABASE_PATH` to it. For serverless (Vercel), move `src/lib/db.ts` to Postgres (Neon/Supabase). The queries are plain SQL, so it's a small port.
- **Backups:** snapshot the volume daily, or use Litestream to stream SQLite to S3.
- Add password reset (email magic link) before inviting agents at scale.

## Code map

```
src/lib/calc/        Pure calculator definitions (fields + compute + breakdown). Add a calculator = add one object.
src/lib/db.ts        Schema + tiny query helpers
src/lib/auth.ts      scrypt passwords, httpOnly session cookie
src/lib/notify.ts    In-app / email / SMS fan-out, deal reminders
src/app/actions.ts   All server actions (signup, clients, save/share, broadcast)
src/app/(app)/       Logged-in app: dashboard, clients, calculators, notifications, settings, admin
src/app/r/[token]/   Public client-facing report
```

## Roadmap: making it the best agent ecosystem

**Next up (highest value)**
1. **Installable mobile app (PWA) + push notifications.** Add a manifest and service worker so agents "Add to Home Screen", then use Web Push for free, instant notifications without SMS costs.
2. **Address lookup → auto-fill.** Type an address and pull the tax amount, HOA and last sale price (ATTOM, Estated, or your MLS feed). This is the ChicagoAgent "Add Address" feature, done faster.
3. **Live rates.** Pull today's average 30-yr/FHA/VA rates daily (e.g. Freddie Mac PMMS / Mortgage News Daily) so defaults are always current, and auto-broadcast "rates dropped" alerts.
4. **Multiple Offers comparison.** Enter 2–5 offers (price, concessions, financing, close date, contingencies) and get the seller's net for each side by side, with a branded report.
5. **Client portal.** Clients get their own login to see every breakdown their agent sent, their checklist, and key dates. Your agents stay the face of it.

**Growth & retention**
- **Co-branded lender partner.** Let a loan officer co-brand reports (split marketing cost, RESPA-compliant) and receive pre-approval requests from the share page.
- **Lead capture on share pages.** A "Get pre-approved / Ask a question" form that drops a new lead into the agent's client list and pings them.
- **Drip reminders to clients.** Home-anniversary equity updates and "rates dropped, want to refi?" texts that keep agents top of mind.
- **Transaction checklist and TRID timeline** per deal (inspection, appraisal, CD delivery 3 business days before closing).
- **Referral program.** Invite links with tracking. Agents who bring agents unlock premium.

**Business**
- **Free vs Premium tiers** (Stripe). Free: core calculators. Premium: branded reports, client portal, SMS, address auto-fill.
- **Brokerage/team accounts.** Team admin sees their agents' pipeline and can broadcast to just their team.
- **Analytics.** Which calculators get used, which reports get opened (track share-link views, and tell the agent "Jane just opened your breakdown").
- **Integrations.** Export to Follow Up Boss / kvCORE / Google Contacts, and sync closing dates to Google/Apple Calendar.

**Trust & compliance**
- Keep SMS strictly opt-in, honor STOP, and log consent timestamps. Have a privacy policy and terms before launch.
- Keep the "estimate, not a Loan Estimate" disclaimer on every client-facing report.
