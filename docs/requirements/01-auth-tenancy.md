# 01 — Authentication & Multi-Tenancy

**Status:** Draft · **Author:** Saad Siddiqui · **Last updated:** 2026-09-29

---

## 1. Clarifying questions & client answers
<!-- Format: question → what the client said → what it means for us (→ requirement) -->

**Q1. How do staff without email log in?**
Client: Store boys only have Android + WhatsApp; can't remember long passwords, want a PIN.
→ Login = mobile number + 4–6 digit PIN. No email required for any role.

**Q2. Forgot PIN / lost phone?**
Client: Owner/manager resets staff PINs manually (no SMS, since staff may have no balance).
Owner recovers own PIN via WhatsApp OTP. Bilal's phone was once stolen.
→ Owner/manager can reset a staff PIN. Owner self-recovery via WhatsApp OTP.
→ Owner/manager can "log out all devices" for any user.

**Q3. Who creates staff accounts, and how do they get in on day one?**
Client: Only owner or Bilal add staff (name, mobile, role). Staff gets a WhatsApp invite.
Munshi must NOT add users.
→ Invite flow: owner/manager creates user → WhatsApp link → staff sets own PIN.

**Q4. Which roles, and what can each see?**
Client: Bilal sees everything but cannot remove the owner. Munshi: bills, payments, khata,
customers, but no profit AND no purchase rates. Store: stock in/out only, no rates at all.
→ Roles: OWNER, MANAGER, MUNSHI, STORE_KEEPER, ACCOUNTANT.
→ Price visibility is a permission, not just a screen: the API must not return cost fields
  to MUNSHI / STORE_KEEPER.

**Q5. What happens when someone leaves?**
Client: Stop access immediately ("same minute"); keep all their entries with their name.
→ Deactivate, never delete. Revocation must take effect within ~1 minute.

**Q6. Can one person work for several factories?**
Client: Yes. Tariq sahab (accountant) does books for 4 factories and wants one login.
→ One user can hold memberships in many tenants, each with its own role.

**Q7. What do we collect at registration?**
Client: Factory name, owner name, mobile, city, address (printed on bills), logo, optional NTN.

**Q8. Self sign-up or set up by us?**
Client: "Will you set up 50 factories by hand?"
→ Self-serve registration. A PLATFORM_ADMIN (us) can view and suspend tenants.

**Q9. Different features per factory?**
Client: Cousin makes ceiling fans and doesn't do rewinding, so he may not need every module.
→ Modules can be enabled per tenant (post-MVP; design for it, don't build it yet).

## 2. Tenancy model decision

**Decision:** Shared MongoDB database; every tenant-owned document carries a `tenantId`.

**Why (MVP):** One database keeps deployments, migrations and backups simple while we
have few tenants and a small team. Isolation is enforced in code (below), not by
physical separation.

**Identification: which tenant is this request for?**
- The subdomain (`rashid.karkhanaos.com`) tells us which tenant is being requested.
  It also gives each factory its own branded address.
- The access token (JWT) carries `userId` and the `tenantId` it was issued for.
- Middleware checks that the token's tenant matches the subdomain's tenant, and that
  the user's membership in that tenant is active. Any mismatch → 403.
  (The subdomain alone is never trusted; anyone can type any URL.)

**Enforcement: how every query is filtered**
- Middleware stores `tenantId` in a request context (AsyncLocalStorage).
- A Mongoose tenancy plugin on every tenant-owned schema injects `tenantId` into all
  find/update/delete/aggregate calls, and throws if no tenant is in context,
  so a forgotten filter fails loudly instead of leaking data.
  (Same idea as a Laravel global scope.)
- Every tenant-owned collection has compound indexes starting with `tenantId`.
- Automated tests log in as tenant A and assert that tenant B's data is never returned.

**Users in multiple tenants**
- `users` = one record per human (phone, PIN hash, status).
- `memberships` = one per (user, tenant) with role and status.
- Deactivating someone in one factory disables only that membership.

**When we'd move a tenant to its own database**
- A large tenant degrades performance for others (noisy neighbour), or
- a client contract/regulation requires physical data separation, or
- one tenant's data size makes shared backups/restores impractical.
The tenancy plugin keeps this migration possible without rewriting queries.

### 2.1 Design review log

**Drill 1: a munshi at `rashid` sends his token to `fans.karkhanaos.com/api/invoices`.**
1. Verify token signature + expiry → invalid/expired = **401** (we don't know who you are).
2. Resolve tenant from the `fans` subdomain.
3. Compare with the token's `tenantId` (rashid) → mismatch = **403** (known, but not allowed). Stop.
4. Role check and query never run. Log a security event.
Notes: 401 = not authenticated, 403 = authenticated but not allowed.
Tenant isolation is checked first; role permissions come second.

**Drill 2: Tariq sahab (active in both tenants) uses his rashid token on `fans`.**
_Pending: Saad to answer. Which tenant was his token issued for? How does he switch?_

## 3. Roles & permissions

| Action | Owner | Manager (Bilal) | Munshi | Store keeper | Accountant (Tariq) |
|---|---|---|---|---|---|
|  |  |  |  |  |  |

## 4. Feature 1: Tenant registration & login

### FR-AUTH-01: Factory owner registers a new tenant
**User story:** As a factory owner, I want to sign up my factory so that my staff and I can start using KarkhanaOS.
**Acceptance criteria:**
- Given …, when …, then …

**Out of scope (MVP):**

## 5. Feature 2: Tenant isolation & tenant profile

### FR-TEN-01:

## 6. Non-functional requirements

## 7. Out of scope for MVP
