# Securities Lending Recalls — interactive pitch demo

A fictional, multi-party demonstration of Buckleson's Idea 2: recall loaned shares before a T+1 sale needs them. It is a workflow prototype, not a blockchain, brokerage, custody, or settlement integration.

## Deck-grounded scenario

- At 3:40 pm, a portfolio team sells **400,000 shares**; **250,000 shares** are on loan through two prime brokers.
- The lending desk issues a recall. Broker A returns **150,000** and Broker B returns **100,000** shares; the custodian confirms delivery and the sale is recorded as settled for **T+1**.
- The deck's current-process example says an evening-batch recall leaves **100,000 shares** one day late and the sale fails. This application does not reproduce a measured baseline or claim the demo actually improves speed or fail cost.
- The remaining **150,000 shares** needed for the sale are assumed to be already available. Broker-to-quantity assignment and the collateral-release click are demonstration choices; the deck does not specify these operational details or any collateral amount.

The comparison view displays the same accepted actions in both columns. The conventional column is an illustration of manual coordination, and the shared-record column is the simulated room's actual accepted event sequence. Sample work records are marked as fictional. No real blockchain is run.

## Run locally

Use Node.js 22 or newer. Keep npm's cache on `G:` if disk space on `C:` is limited.

```powershell
$env:NPM_CONFIG_CACHE='G:\idea-1\one\npm-cache-idea2'
npm ci
npm run dev
```

Open `http://localhost:3000/` for the presenter and `http://localhost:3000/join` on participant browsers. In local development without Supabase configuration, the presenter PIN is `demo-admin`. This local mode shares state only within one development server process and loses it when that process restarts; it is for layout and workflow testing, not a production multi-device deployment.

## Production setup

Apply [`supabase/schema.sql`](supabase/schema.sql) once to a **dedicated Supabase project**, or to an existing project only after explicitly choosing to share capacity. The SQL creates only `demo_rooms`, `demo_sessions`, and three `demo_*` functions, and adds `demo_rooms` to the realtime publication. It does not change any Idea 1 table. Use the project's SQL Editor or a migration workflow, then confirm both tables and the publication entry exist. The `public` schema must be exposed in Supabase Data API settings; the SQL grants only the privileges this demo needs.

Set these Vercel environment variables from [`.env.example`](.env.example):

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project API URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable API key for public room updates |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key; server-side only |
| `DEMO_ROOM_ID` | `29cdb848-0ae6-456c-a27a-5fb3bff21d02` as seeded in SQL |
| `DEMO_ADMIN_PIN` | A private, strong presenter PIN |

In Vercel, choose **Add New → Project**, import `vjk7989/securities-lending-recalls`, keep the repository root as the root directory and Next.js as the framework, select Node.js 22 or later, and add all five variables above for Production (and Preview if you intend to test previews). Deploy, then visit `/api/room`, `/`, and `/join` on the canonical Vercel URL. Test one action from a separate browser profile and confirm the presenter updates; reset the room before presenting.

Supabase Postgres stores the ordered room events and role sessions. Each participant action goes to a Vercel API route, which checks the role and sequence, then commits with a version check in a database transaction. Clients subscribe to Postgres Changes over Supabase Realtime and also poll every five seconds to recover from missed notifications. Reconnect uses a per-device bearer token stored in that browser's local storage; only its SHA-256 hash is stored in the database. The service role key never reaches the browser. Public room data contains fictional actions and device status only.

The admin may reset the current run, kick a device, and let it rejoin with a new token. Reset preserves earlier events in storage but displays only the active run. The presenter PIN is held in session storage for the current browser session.

## Verification

Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`. See [`docs/test-results.md`](docs/test-results.md) for the checks actually performed and their limits. See [`docs/presenter-guide.md`](docs/presenter-guide.md) for the 3–5 minute pitch walkthrough.

## Limits

The demo does not connect to EquiLend 1Source, a ledger, a custodian, a broker, a transfer agent, or settlement rails. It cannot make a borrower return shares. Public join links are intended for supervised demonstrations; this is not a production identity or transaction authorization system. The scenario figures are from the supplied pitch deck, while participant events and sample records are simulated.
