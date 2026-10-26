# Single sign-on

The organization's single sign-on: connections, allowed email domains, member provisioning, and links into the WorkOS setup assistant. How it works: [How sign-in works](../../authentication/index.md).

A person connects the identity provider in the WorkOS assistant; the API hands out the link but can't create connections.

| Method | Path | Scope | MCP tool |
|---|---|---|---|
| `GET` | `sso/` | `read:org` | `get_sso` |
| `PATCH` | `sso/` | `manage:org` | `update_sso` |
| `POST` | `sso/domains/` | `manage:org` | `add_sso_domain` |
| `POST` | `sso/domains/{id}/verify/` | `manage:org` | `verify_sso_domain` |
| `DELETE` | `sso/domains/{id}/` | `manage:org` | `remove_sso_domain` |
| `POST` | `sso/setup-link/` | `manage:org` | `get_sso_setup_link` |

Requesters get `403` on every endpoint.

Writes need two things:

- the `org.manage_settings` permission (org admins and owners), otherwise `403`;
- an Enterprise plan with the `sso` feature, otherwise `402`.

The first write creates the organization's WorkOS organization. Domain ids are WorkOS ids such as `org_domain_01H…`.

---

## `GET sso/`

```json
{
  "entitled": true,
  "configured": true,
  "status_ok": true,
  "jit_role": "requester",
  "connections": [
    {"id": "conn_01H…", "connection_type": "AzureSAML", "provider": "Azure",
     "protocol": "SAML", "state": "active"}
  ],
  "directories": [],
  "domains": [
    {"id": "org_domain_01H…", "domain": "acme.com", "state": "verified", "verified": true,
     "txt_name": "", "txt_value": ""},
    {"id": "org_domain_01J…", "domain": "acquiredco.com", "state": "pending", "verified": false,
     "txt_name": "_workos-challenge.acquiredco.com", "txt_value": "a1b2c3…"}
  ]
}
```

- **No Enterprise plan:** the response is `{"entitled": false}`.
- **Never configured:** `configured` is `false` and the lists are empty.
- **`status_ok`:** `false` when WorkOS couldn't be reached; the lists may then be incomplete.
- **Pending domains:** a pending domain carries the DNS TXT record to add (`txt_name` / `txt_value`).

## `PATCH sso/`

Member provisioning: what someone at a verified domain becomes the first time they sign in through SSO without an invite.

```json
{"jit_role": "requester"}
```

`jit_role` is `off` (invite only, the default), `requester` or `member`. Existing members keep their role. Returns the same body as `GET`.

## `POST sso/domains/`

```json
{"domain": "acme.com"}
```

`201` with the new domain, pending, including the TXT record to add:

```json
{"id": "org_domain_01J…", "domain": "acme.com", "state": "pending", "verified": false,
 "txt_name": "_workos-challenge.acme.com", "txt_value": "a1b2c3…"}
```

`400` if the domain is malformed, or if WorkOS refuses it (consumer domains like `gmail.com`, or a domain another organization has claimed).

## `POST sso/domains/{id}/verify/`

Asks WorkOS to check the TXT record now. Returns the domain. If `verified` is still `false`, DNS may not have propagated yet; try again later. `400` if the id isn't one of this organization's domains.

## `DELETE sso/domains/{id}/`

Removes the domain. People at it stop being sent to the identity provider. `204`; `400` if the id isn't one of this organization's domains.

## `POST sso/setup-link/`

```json
{"intent": "sso"}
```

| `intent` | Opens |
|---|---|
| `sso` (default) | Connect or manage an identity provider |
| `dsync` | Directory Sync (SCIM) |
| `domain_verification` | WorkOS's guided domain check |

```json
{"url": "https://setup.workos.com/…", "intent": "sso",
 "note": "Single-use link that expires in about 5 minutes. A person opens it to finish setup."}
```

When the person finishes, the assistant returns them to **Settings → Authentication**.

## Errors

Errors on this page use `{"error": "..."}`; validation errors use `{"errors": {...}}`.
