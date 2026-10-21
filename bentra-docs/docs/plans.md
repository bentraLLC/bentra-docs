# Plans and limits

Every organization belongs to an **account** (a `License`). The account has a **plan**, and Bentra can add per-account **overrides** for custom deals. What an organization may use is that plan merged with its overrides. `organizations/entitlements.py` (`get_entitlements(org)`) resolves this, and every gate in the product reads it.

| | Free | Team | Business | Enterprise |
|---|---|---|---|---|
| Organizations per account | 1 | 1 | 3 | Unlimited |
| Users (requesters are free) | 3 | 10 | 30 | Per contract |
| Workflows | 5 | Unlimited | Unlimited | Unlimited |
| Concurrent runners per pool | 1 | 5 | 20 | Custom |
| Enabled schedules | 2 | 20 | 50 | Custom |
| Runs per month | 300 | 5,000 | 25,000 | Custom |
| Run log retention (days) | 3 | 14 | 30 | Custom |
| SSO, SCIM, audit logs | | | | Included |
| Employee request portal | | | | Add-on |

The numbers are launch placeholders. They live in one file, `organizations/plans.py`.

## How limits behave

- **Limits only stop new things.** Nothing you already have is disabled or deleted when you're over a limit.
- **Users** count owners, admins and members. Requesters (portal-only) are free and unlimited.
- **Workflows**: archived workflows don't count. Restoring one counts again.
- **Runs per month** reset on the 1st (UTC). At the limit, forms, the API, the portal, schedules and manual triggers stop accepting new runs until the month resets.
- **Expired plan**: the organization falls back to Free entitlements and keeps all its data. Settings → Billing shows a banner.
- **Settings → Billing** shows the plan, the limits and this month's usage meters (workflows, runs, users) to every member. Owners and admins also see the license key and can add organizations to the account. The Workflows and Runs lists show a banner from 80% of a limit.

## Organizations and their IDs

- Anyone can sign up and create an organization. It starts on **Free** on its own account.
- **Free and Team allow one organization at a time.** To start over, an owner deletes the organization (Settings → Organization), which also removes its account, and then creates a new one.
- **Business and Enterprise accounts** add organizations from Settings → Billing → *New organization* (owners and admins), or with `POST account/organizations/`. New organizations join the same account and plan.
- **Names don't have to be unique.** An organization's URL ID (`/orgs/<id>/`, the API's `slug`) is 12 random characters generated at creation. It never comes from the name and never changes. Settings → Organization shows it as *URL ID*.

## Issuing and changing a license (Bentra staff)

Customers never enter a license key. Bentra changes the account in place with a management command. The key (`lic_…`) is only a support reference.

```bash
# Upgrade an org's account (by org UUID or URL ID)
manage.py issue_license --org 3f2a…-uuid --plan business

# Enterprise deal: 50 users, the portal, an end date
manage.py issue_license --org k3j9x2m4pqrt --plan enterprise --users 50 --portal --expires 2027-10-31

# Any limit or extra feature
manage.py issue_license --org k3j9x2m4pqrt --limit max_runs_per_month=unlimited --feature audit_logs

# White-glove: create the org on a new account and invite its first owner
manage.py issue_license --create-org "Acme" --owner-email it@acme.com --plan enterprise --portal

# Local development: unlock everything everywhere
manage.py issue_license --all-orgs --plan enterprise --portal
```

Changing one organization's license changes it for every organization on that account. Self-serve upgrades for Team and Business (Stripe) come later.
