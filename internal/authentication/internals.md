# Authentication internals

For developers working on sign-in and SSO in the `bento` repo.

## Pieces

| Where | What |
|---|---|
| `sso/views.py` | AuthKit login, the callback (`authkit_callback`) and logout. The callback runs provisioning, then `jit_join`. |
| `sso/services.py` | WorkOS calls and SSO logic: `provision_authkit_user`, `ensure_org_sso`, domains (`list_domains`, `add_domain`, `verify_domain`, `remove_domain`, `verified_domains`), `admin_portal_link`, `provider_status`, `jit_join`, `set_jit_role`, `audit_sso_change`. Failures meant for the user raise `SSOError`. |
| `sso/catalogue.py` | The connection catalogue: every identity provider WorkOS supports, plus custom SAML and OIDC. Each entry has a label, the WorkOS connection types its row matches, a "what you'll need" list, and WorkOS icon and docs links. `featured=True` entries (7) show by default; the rest sit behind **Show more**, which opens on its own when one of them is connected. |
| `sso/models.py` | `OrgSSO`, `WorkOSIdentity`, `AuthenticationEvent`. |
| `settings/views.py` | The Settings → Authentication page and its POST endpoints, under `/orgs/<org>/settings/authentication/`. |
| `api/sso.py` | Token API: `/orgs/<org>/api/v1/sso/…`. See the [API reference](../../reference/api/sso.mdx). |
| `organizations/tenancy.py` | `resolve_license_for_workos_org`: the WorkOS org a person signed into → its Bentra org's license. |

## Models

**`OrgSSO`**, one per Bentra organization, created lazily on the first domain add, setup link or provisioning change:

- `organization`: one-to-one, `related_name="sso"`.
- `workos_organization_id`: unique. The WorkOS organization is created with `external_id = str(org.id)`.
- `jit_role`: `off` (the default), `requester` or `member`.

**`AuthenticationEvent`** is the audit log. `provider` is `authkit`, `password`, `mcp_connect` or `sso_settings`. `action` is empty for a sign-in; otherwise it's one of:

- `jit_join`;
- `domain_added:<d>`, `domain_verified:<d>`, `domain_removed:<d>`;
- `jit_role:<role>`;
- `portal_opened:<intent>`.

Refusals set `success=False` and `failure_reason`. For example, `jit_not_sso`, `jit_domain_not_verified` or `jit_domains_unavailable`.

Connections, directories and domains aren't stored in Bentra. They're read live from WorkOS. The page makes at most three WorkOS calls: connections, directories and the organization's domains.

## WorkOS calls (Python SDK 8)

| Purpose | Call |
|---|---|
| Create the org | `organizations.create_organization(name=, external_id=)` |
| List domains | `organizations.get_organization(id).domains` (each has `state`, `verification_prefix`, `verification_token`) |
| Add a domain (pending, DNS) | `organization_domains.create_organization_domain(domain=, organization_id=)` |
| Check DNS now | `organization_domains.verify_organization_domain(id)` |
| Remove a domain | `organization_domains.delete_organization_domain(id)` |
| Setup assistant | `admin_portal.generate_link(organization=, intent=, return_url=, success_url=)` with intent `sso`, `dsync` or `domain_verification` |
| Status | `sso.list_connections(organization_id=)`, `directory_sync.list_directories(organization_id=)` |
| Sign-in | `user_management.authenticate_with_code(code=)` → `user`, `organization_id`, `authentication_method` |

Gotchas:

- **Domain ownership.** Domain ids come from the browser or API. `verify_domain` and `remove_domain` fetch the domain first and refuse ids whose `organization_id` isn't this org's WorkOS organization.
- **Don't use `domain_data`.** `update_organization(domain_data=…)` replaces the organization's whole domain list. Use the `organization_domains` API instead.
- **Portal links.** They're single-use and short-lived, so the setup endpoint is POST-only: a link prefetch would spend one.
- **Preselecting a provider.** The Admin Portal can't preselect an IdP, so the Bentra drawer carries the per-provider guidance and the admin picks the provider again in the assistant.
- **Domain states.** `legacy_verified` counts as verified.

## Configuration

| Setting | Purpose |
|---|---|
| `WORKOS_API_KEY`, `WORKOS_CLIENT_ID` | WorkOS environment credentials. |
| `WORKOS_AUTHKIT_REDIRECT_URI` | The callback, `<BASE_URL>/accounts/sso/authkit/callback/`. Register it in the WorkOS dashboard. |
| `WORKOS_LOGOUT_RETURN_TO` | Where WorkOS sends people after logout. Register it as the sign-out redirect. |
| `BENTO_DEPLOYMENT_FLAVOR` | `self_hosted` turns on every licensed feature, including SSO. |

Also enable email verification in the WorkOS dashboard: email is a match key.

## Tests

- `sso/tests.py`: provisioning, the callback, domains, portal links, status and tenancy.
- `sso/test_auto_join.py`: just-in-time membership on sign-in.
- `settings/tests.py::AuthenticationSectionTests`: the page and its writes.
- `api/test_sso.py`: the token API.

They all mock `sso.services.get_workos_client`.

## Known gaps

- **No break-glass sign-in.** If AuthKit is down or an SSO setup is broken, nobody can sign in. Bentra needs a recovery path before it requires SSO everywhere.
- **No "require SSO for everyone" toggle in Bentra.** WorkOS organization policies are configured in the WorkOS dashboard.
- **Directory Sync isn't acted on.** There's no group → role mapping and no deprovisioning yet.
- **No branding.** The Admin Portal and AuthKit aren't branded, and there's no custom domain.
- **Manual Enterprise activation.** Activation keys and billing aren't built.
