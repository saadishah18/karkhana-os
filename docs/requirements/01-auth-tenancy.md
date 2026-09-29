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
Saad's answer: the token must be tied to the specific factory, so the middleware accepts him only there.
Review: right idea; the term "factory signature" was wrong. One platform signing key signs every token;
the factory is a `tenantId` **claim** inside the token.
1. His token is scoped to `t_rashid` → on `fans` = **403**, even though he has an active fans membership.
2. To switch: `POST /auth/switch-tenant { tenantId }` → server checks active membership →
   issues a **new access token** with `tenantId: t_fans` and his **role at fans**.
Why not one token listing all tenants: roles differ per tenant; bigger blast radius if stolen;
removed memberships stay valid until expiry. Principle: **least privilege**.

## 3. Roles & permissions

✅ allowed · ❌ not allowed · ⚠️ allowed with the condition in Notes.
Each row is a **permission**; code checks `can('<permission>')`, never role names.

| Permission | Action | Owner | Manager (Bilal) | Munshi | Store keeper | Accountant (Tariq) | Notes |
|---|---|---|---|---|---|---|---|
| `tenant.profile.edit` | Edit factory profile / logo | ✅ | ✅ | ❌ | ❌ | ❌ | |
| `staff.invite` | Invite (add) staff | ✅ | ⚠️ | ❌ | ❌ | ❌ | Manager can only invite roles below MANAGER |
| `staff.deactivate` | Deactivate staff | ✅ | ⚠️ | ❌ | ❌ | ❌ | Manager cannot deactivate the owner |
| `staff.pin.reset` | Reset a staff PIN | ✅ | ⚠️ | ❌ | ❌ | ❌ | Manager cannot reset the owner's PIN |
| `user.sessions.revoke` | Log out all devices of a user | ✅ | ⚠️ | ❌ | ❌ | ❌ | Manager cannot log out the owner |
| `staff.role.change` | Change a user's role | ✅ | ⚠️ | ❌ | ❌ | ❌ | Only to roles below own; never to OWNER (rule C) |
| `tenant.ownership.transfer` | Transfer / remove the OWNER | ⚠️ | ❌ | ❌ | ❌ | ❌ | Owner only, confirmed by WhatsApp OTP (rule B) |
| `invoice.create` | Create sale invoice | ✅ | ✅ | ✅ | ❌ | ❌ | Accountant is view-only |
| `payment.receive` | Receive payment / record trade-in | ✅ | ✅ | ✅ | ❌ | ❌ | |
| `khata.view` | View customer khata (ledger) | ✅ | ✅ | ✅ | ❌ | ✅ | |
| `price.sale.view` | View sale prices | ✅ | ✅ | ✅ | ❌ | ✅ | |
| `price.cost.view` | View purchase / cost rates | ✅ | ✅ | ❌ | ❌ | ✅ | API must omit cost fields, not just hide them in UI |
| `report.profit.view` | View profit reports | ✅ | ✅ | ❌ | ❌ | ✅ | Accountant needs P&L for the books |
| `stock.move` | Stock in / out entry | ✅ | ✅ | ✅ | ✅ | ❌ | |
| `stock.view` | View stock quantities | ✅ | ✅ | ✅ | ✅ | ✅ | Store keeper sees quantities only, no rates |
| `stock.adjust` | Stock adjustment / write-off | ✅ | ✅ | ⚠️ | ❌ | ❌ | Munshi can *request*; owner/manager approves |
| `invoice.reverse` | Reverse (cancel) an invoice | ✅ | ✅ | ❌ | ❌ | ❌ | Reason required; logged |
| `audit.view` | View audit log | ✅ | ✅ | ❌ | ❌ | ✅ | Read-only |

### 3.1 Rules
1. **Tenant check first, permission check second.** A valid permission in tenant A means nothing in tenant B.
2. **Least privilege.** Each role gets only what its job needs. The accountant is **view-only** (decided 2026-09-29).
3. **Separation of duties.** Whoever creates a money or stock record cannot cancel or write it off alone
   (invoice reversal, stock write-off).
4. **Rule C (no privilege escalation):** a user can only grant roles *below* their own. Nobody can grant OWNER.
   _Proposed by Claude. Saad to confirm._
5. **Rule B (ownership transfer):** only the current owner can transfer ownership, confirmed by WhatsApp OTP.
   If the owner is unavailable (sold / deceased), a PLATFORM_ADMIN transfers it after manual document
   verification. This is a support process, not an in-app feature, for the MVP.
   _Proposed by Claude. Saad to confirm._
6. Changing what a role can do = editing the role → permissions mapping, not code.

## 4. Feature 1: Tenant registration & login

### FR-AUTH-01: Factory owner registers a new tenant  _(worked example)_
**User story:** As a factory owner, I want to sign up my factory myself so that my staff and I can start using KarkhanaOS.
**Acceptance criteria:**
- Given a mobile number not registered as an OWNER, when the owner submits factory name, owner name,
  mobile, city, address and a subdomain, then the system sends a WhatsApp OTP to that mobile.
- Given a correct OTP within 5 minutes, then a **tenant**, a **user** (if the mobile is new) and an
  **OWNER membership** are created together (one transaction), and the owner is logged in to that tenant.
- Given a subdomain that is taken, reserved (`www`, `api`, `admin`, `app`) or invalid (not 3–30 chars of
  a–z, 0–9, `-`), then registration is rejected with a clear message before the OTP is sent.
- Given an existing user (e.g. Tariq sahab) registering his own factory, then no new user is created;
  only a new tenant + OWNER membership are added to his existing user.
- Given 3 wrong OTPs, then that OTP is invalidated and a new one must be requested.
- Logo and NTN are optional and can be added later from the factory profile.

**Out of scope (MVP):** email sign-up, subscription / payment at sign-up, custom domains.

<!-- ✍️ Saad: write FR-AUTH-02 to FR-AUTH-09 in the same format. Titles are given; you write the
     user story + acceptance criteria. Use Section 1 answers and Section 3 rules. -->

### FR-AUTH-02: Login with mobile number + PIN
<!-- Hint: what if the user has memberships in several tenants? What if the membership is inactive? -->

### FR-AUTH-03: Owner / manager invites a staff member (WhatsApp link, staff sets own PIN)
<!-- Hint: how long is the invite link valid? What if the mobile already has a user? Rule C. -->

### FR-AUTH-04: Owner / manager resets a staff member's PIN

### FR-AUTH-05: Owner recovers own PIN via WhatsApp OTP

### FR-AUTH-06: Deactivate a staff member (takes effect within 1 minute)
<!-- Hint: what happens to their open sessions? Their past invoices? -->

### FR-AUTH-07: Log out all devices of a user (stolen phone)

### FR-AUTH-08: Switch tenant (users with multiple memberships)
<!-- You already designed this in Drill 2. -->

### FR-AUTH-09: Failed PIN attempts
<!-- Hint: a 4-digit PIN has only 10,000 combinations. How fast could a script try them all? -->

## 5. Feature 2: Tenant isolation & tenant profile

### FR-TEN-01:

## 6. Non-functional requirements

## 7. Out of scope for MVP
