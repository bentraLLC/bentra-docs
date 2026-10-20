# Set up SSO

A guide for organization admins. Everything happens in **Settings → Authentication**.

!!! info "Before you start"
    - Your organization is on the Enterprise plan. Otherwise the page shows a locked state.
    - You're an organization admin or owner.
    - Someone who can add DNS records for your email domain is around, or it's you.
    - Someone with admin access to your identity provider is around, or it's you.

## 1. Add and verify your domains

1. Under **Allowed email domains**, select **Add domain** and enter the domain, for example `acme.com`.
2. The domain appears as **Pending**, with a DNS TXT record to add:

    | Type | Name | Value |
    |---|---|---|
    | TXT | the name shown in Bentra | the token shown (use the copy button) |

3. Add the record at your DNS provider.
4. Back in Bentra, select **Verify**. DNS changes can take minutes, sometimes hours. If it isn't verified yet, try again later.

Add every domain your people use, for example `acme.com`, `acme.co.uk` and `acquiredco.com`. All of them lead into the same Bentra organization.

## 2. Connect your identity provider

1. Under **Add a connection**, find your provider and select **Set up**.
    - **Custom connections**: SAML, OpenID Connect.
    - **Identity provider connections**: Microsoft Entra ID, Okta, Google Workspace, ADFS, PingFederate, OneLogin, JumpCloud.
    - **Show 21 more providers** lists everything else WorkOS supports: ADP, Auth0, CAS, ClassLink, Clever, Cloudflare, CyberArk, Duo, Keycloak, LastPass, Login.gov, miniOrange, NetIQ, Oracle, PingOne, Rippling, Salesforce, Shibboleth, Shibboleth Generic SAML, SimpleSAMLphp and VMware Workspace ONE.
    - Not listed? Any identity provider that supports SAML 2.0 or OpenID Connect works through a custom connection.
2. A side panel lists what you'll need, and warns you if no domain is verified yet.
3. Select **Continue setup**. The WorkOS setup assistant opens in a new tab:
    1. Choose the same provider again. Bentra can't preselect it for you.
    2. Follow the steps: create the application in your IdP, then paste the values between the two.
    3. Run the **test sign-in**.
4. When you finish, the assistant brings you back to Bentra. The connection appears under **Single sign-on** as **Active**.

To change a connection later, select **Manage** on it.

!!! note "Setup links are single-use"
    Each **Continue setup** or **Manage** creates a fresh link that works once and expires after about five minutes. If one expires, start again from Bentra.

### More than one domain, or more than one IdP

- **Several domains, one IdP.** This is the usual case: one Entra tenant or Okta org covers all of a company's domains. Verify each domain, then connect the IdP once.
- **Several IdPs.** For example, Acme on Entra ID and an acquired company on Okta. Add a connection for each, then run a test sign-in with an address from each domain to check that people reach the right IdP.

## 3. Member provisioning

Choose what happens when someone at a verified domain signs in through SSO for the first time without an invite:

- **Don't add them (invite only)**: the default. Invite people from **Settings → Users**.
- **Add them as requester**: they can use the request portal, nothing else.
- **Add them as member**: they get a seat in the default workspace.

Invitations keep working for anyone, including people on other domains. Existing members keep their role.

## 4. Directory Sync (optional)

**Directory Sync (SCIM)** opens the WorkOS assistant to connect your directory. Bentra shows the directory's status. It doesn't act on synced users and groups yet; group-to-role mapping is planned.

## Troubleshooting

| What you see | Why | What to do |
|---|---|---|
| Domain stays **Pending** | The TXT record isn't visible yet, or its name or value is wrong. | Check the record with `dig TXT <name shown in Bentra>`, wait, then **Verify** again. |
| "WorkOS didn't accept gmail.com" | Consumer domains can't be claimed. | Use your company domain. |
| The connection is **Inactive** or **Draft** | Setup isn't finished, or no domain is verified. | **Manage** it and complete the steps; verify a domain. |
| The assistant link shows "expired" | Links are single-use and short-lived. | Start again from Bentra. |
| "Bentra couldn't reach WorkOS" | WorkOS was unreachable when the page loaded. | Reload. Sign-ins aren't affected by this banner. |
| Someone signed in but has no access | Provisioning is off, their domain isn't verified, or they didn't sign in through SSO. | Invite them, or check the setting and domains. Refusals appear in the authentication events. |
