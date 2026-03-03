# CareerPilot Production Checklist

## Security
- Rotate all local/test secrets before production deploy.
- Set strong values for: `JWT_SECRET`, `ENCRYPTION_KEY`, `WORKER_SECRET`.
- Set strong value for: `OTP_HASH_SECRET`.
- Configure HTTPS-only deployment and secure cookies.
- Confirm CSP/frame protections and API no-store headers in `middleware.ts`.

## Auth and Access
- Verify admin and user role routing behavior in web app.
- Confirm refresh token rotation and logout revocation paths.
- Enable strict monitoring on login/admin-login failures.

## Billing
- Set production Razorpay keys and webhook secret.
- Verify order payment flow end-to-end:
  - `/api/billing/order`
  - checkout popup
  - `/api/billing/order/verify`
- Reconcile Razorpay payments with `PaymentEvent` table daily.

## Worker and Queue
- Configure Upstash Redis for production queue.
- Reuse the same Upstash Redis for distributed API rate limiting.
- Run worker in isolated runtime (separate process from API).
- Verify retries, dead-letter behavior, and timeout handling.

## Extension
- Publish signed extension package for release channel.
- Set `NEXT_PUBLIC_EXTENSION_STORE_URL` and install from Chrome Web Store in production.
- Validate content script selectors against current LinkedIn UI.
- Test stuck-field -> user-answer -> retry loop at least 20 real forms.

## Observability
- Capture and persist `x-request-id` in upstream logs.
- Alert on:
  - OTP send failures spike
  - payment verification failures
  - worker dead-letter growth
  - admin/system health degradation

## Pre-launch QA
- Apply Prisma migrations to production DB (`npx prisma migrate deploy`).
- If DB already existed before migrations, run one-time baseline:
  - `npx prisma migrate resolve --applied 20260303173000_init`
- Smoke test all critical APIs with real database:
  - auth, onboarding, auto-apply jobs, billing, admin APIs.
- Test role switching in browser and route guards.
- Test onboarding completion and quota enforcement.
- Validate LinkedIn-managed resume flow (latest attached LinkedIn Easy Apply resume is used by copilot).

## Post-launch
- Daily review:
  - failed jobs
  - unresolved screening field issues
  - payment mismatch incidents
- Weekly selector maintenance for extension stability.
