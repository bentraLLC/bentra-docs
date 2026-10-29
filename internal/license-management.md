# Issuing and changing a license (Bentra staff)

Plans and limits are documented publicly in [plans.mdx](../plans.mdx). Entitlements resolve in `organizations/entitlements.py` (`get_entitlements(org)`), and the plan numbers live in `organizations/plans.py`.

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
