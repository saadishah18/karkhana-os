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
   _Confirmed by Saad 2026-10-07._
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
**User story:** As a staff member, I want to log in with my mobile number and PIN, so that I can do my daily work without needing an email.
**Acceptance criteria:**
- Given a user with exactly one active membership enters the correct mobile and PIN, when they press Login,
  then the server issues a token for that tenant and they land on their dashboard, with a menu showing
  only the pages their permissions allow.
- Given a wrong mobile number **or** a wrong PIN, when they press Login, then the app shows
  "Mobile number or PIN is incorrect", the same message in both cases (prevents **user enumeration**).
- Given a user whose memberships are all deactivated, when they log in with the correct mobile and PIN,
  then they are not logged in and see "Your account has been disabled. Please contact your factory owner."
  This message appears only **after** the PIN is verified, so it never reveals which numbers are registered.
- Given a user with several active memberships (e.g. Tariq sahab), when they log in, then they see a list
  of **only their active factories**; choosing one issues a token for that tenant (see FR-AUTH-08).
  Deactivated factories do not appear in the list.

**Out of scope (MVP):** "remember this device", biometric / fingerprint login.

### FR-AUTH-03: Owner / manager invites a staff member (WhatsApp link, staff sets own PIN)
**User story:** As a factory owner or manager, I want to invite a staff member by WhatsApp so that they can
set their own PIN and start work, without me ever knowing or choosing their PIN.
**Acceptance criteria:**
- Given an OWNER or MANAGER enters name, mobile and role, when they send the invite, then a WhatsApp link is
  sent to that mobile and the invite is shown as "pending". Munshi, store keeper and accountant cannot invite.
- Given a MANAGER invites, then only roles **below MANAGER** can be chosen; nobody can ever invite an OWNER
  (**Rule C**, prevents **privilege escalation**). An OWNER can invite any role except OWNER.
- Given the link is opened **within 24 hours** and has not been used, when the staff member sets a PIN
  (weak PINs rejected, see FR-AUTH-09), then their user and membership are activated and the link stops working.
- Given the link is older than 24 hours, then it shows "This invite has expired. Ask your factory owner to
  send a new one."
- Given the link was already used (**single-use token**), then it shows "This invite link has already been used.
  If you already set your PIN, log in. Otherwise ask your factory owner for a new invite." It never says
  whether the account exists.
- Given the mobile already belongs to an existing user (e.g. Tariq sahab), then the invite page **never offers
  "create PIN"** (prevents **account takeover**). The user logs in with their own PIN, sees
  "<Factory> invites you as <Role>. Accept / Decline", and Accept only adds a membership to the existing user.
- Given a wrong number (typo), then the inviter sees the same "Invite sent" result whether or not the number is
  registered (prevents **user enumeration**); the real person simply never accepts, and the manager can cancel
  the pending invite and send a new one.
- Given a new user opens the link, then the mobile is confirmed with a WhatsApp OTP before the PIN is set.

**Out of scope (MVP):** bulk invites, invites by SMS or email.

### FR-AUTH-04: Owner / manager resets a staff member's PIN
**User story:** As a factory owner or manager, I want to help a staff member who forgot their PIN, so that
they can get back to work without me ever knowing their PIN.
**Acceptance criteria:**
- Given an OWNER or MANAGER taps "Reset PIN" for a staff member, then a WhatsApp **reset link** is sent
  (same rules as an invite: **single-use**, expires after **24 hours**). The staff member sets their own PIN.
  Nobody else ever sets or sees a PIN (**non-repudiation**: every entry can only have been made by its owner).
- A MANAGER cannot reset the OWNER's PIN (see `staff.pin.reset`). The owner uses FR-AUTH-05.
- Given the reset screen, then it has a checkbox **"Block the old PIN now (phone lost or stolen)"**, unticked
  by default.
  - Unticked: the old PIN keeps working until the new PIN is set (the user may have just remembered it, and a
    mistaken tap must not lock out a working employee).
  - Ticked: the old PIN stops working immediately and all of the user's devices are logged out (see FR-AUTH-07).
- Given the new PIN is set from the link, then the old PIN stops working and all older sessions end.
- Given the link is expired or already used, then it shows the same messages as FR-AUTH-03.
- Every reset is written to the audit log (who reset, for whom, when, whether the old PIN was blocked).

**Out of scope (MVP):** SMS delivery, temporary PINs.

### FR-AUTH-05: Owner recovers own PIN via WhatsApp OTP
**User story:** As a factory owner who forgot my PIN, I want to recover it myself with a WhatsApp OTP, because no one above me can reset it.
**Acceptance criteria:**
- Given the owner requests recovery, then a WhatsApp OTP (valid 5 minutes, 3 wrong tries invalidate it) is sent to the registered mobile.
- Given a correct OTP, then the owner sets a new PIN (weak PINs rejected), but it takes effect only after a **24-hour cooling-off period** (protects against a thief holding the owner's phone).
- During cooling-off, the old PIN keeps working, and the owner's logged-in devices and the manager receive "Owner PIN is being reset. Cancel if this wasn't you". Cancelling from a logged-in device stops the reset.
- Given the new PIN takes effect, then all older sessions end.
- Recovery requests are rate limited and never reveal whether the number exists (see FR-AUTH-09).
- _Draft stub by Claude from Q2 + Saad's Q7 discussion. Saad to review._


### FR-AUTH-06: Deactivate a staff member (takes effect within 1 minute)
**User story:** As an owner or manager, I want to stop a former employee's access immediately, while keeping everything they entered.
**Acceptance criteria:**
- Given an OWNER or MANAGER deactivates a member, then only that **membership** is disabled (other factories are unaffected) and the user's tokens for this tenant stop working **within 1 minute**.
- A MANAGER cannot deactivate the OWNER; nobody can deactivate the last OWNER.
- Past invoices, payments and stock entries stay and keep showing the person's name. Records are **never deleted**.
- A deactivated member can be reactivated later by an owner or manager.
- The action is written to the audit log.
- _Draft stub by Claude from Q5. Saad to review._

<!-- Hint: what happens to their open sessions? Their past invoices? -->

### FR-AUTH-07: Log out all devices of a user (stolen phone)
**User story:** As an owner or manager, when a staff member's phone is stolen, I want to log them out of every device at once.
**Acceptance criteria:**
- Given an OWNER or MANAGER taps "Log out all devices" for a user, then every token and session issued to that user before now stops working within 1 minute. The user can log in again with their PIN.
- A MANAGER cannot do this for the OWNER (see `user.sessions.revoke`).
- The user can also log out all their own devices.
- Also triggered by FR-AUTH-04 (block old PIN now), FR-AUTH-05 (new PIN takes effect) and FR-AUTH-06 (deactivate).
- The action is written to the audit log.
- _Draft stub by Claude from Q2. Saad to review._


### FR-AUTH-08: Switch tenant (users with multiple memberships)
**User story:** As an accountant working for several factories, I want to switch between them quickly,
so that I can work on each factory's books without logging out and in again.
**Acceptance criteria:**
- The **current factory name is always shown in the navbar**, so the user always knows which factory
  they are working in (prevents recording entries in the wrong factory).
- Given a user with more than one active membership, when they tap the factory name, then they see a list
  of their **active** factories with the current one ticked ✓. Deactivated memberships do not appear.
  (Users with only one factory see the name but no switcher.)
- Given the user picks another factory, then the server checks that the membership is still active and
  issues a **new token** for that tenant with the user's **role in that tenant**; the old token is
  discarded by the app, and the dashboard and menu are rebuilt from the new permissions.
- Given the membership was deactivated after the user logged in, when they try to switch, then the switch
  fails with "Your account has been disabled for this factory" and they stay in the current factory.
- The old tenant's token is never accepted for the new tenant's data (see Drill 1 and Drill 2 → 403).

**Out of scope (MVP):** viewing several factories side by side, combined reports across factories.

### FR-AUTH-09: Failed PIN attempts
**Why:** a 4-digit PIN has 10,000 combinations. At 10 tries/second, a script tries all of them in
~17 minutes (average hit in ~8 minutes). Without protection, any account can be broken during one cup of chai.

**User story:** As a factory owner, I want repeated wrong PINs to be slowed down, so that nobody can guess
their way into my factory's account, and nobody can lock me out on purpose either.
**Acceptance criteria:**
- Given 5 wrong PINs in a row for one mobile number, when a 6th attempt is made, then login for that number
  is blocked for **1 minute**; further failures increase the block (1 min → 5 min → 30 min → 2 hours)
  (**progressive backoff**). A successful login resets the counter.
- The block is **temporary, never permanent**, so an attacker cannot lock the owner out every day
  (**lockout abuse**).
- Given more than 20 login attempts from the same IP address within 1 minute, across any numbers,
  then further attempts from that IP are rejected for a short period (**rate limiting** against
  **password spraying**: one common PIN tried on many numbers).
- Given a user setting or resetting a PIN, when they choose a weak PIN (e.g. 0000, 1111, 1234, 1212, 4321,
  repeated or sequential digits), then it is rejected with "Please choose a less common PIN."
- Given a user's login gets blocked, then the tenant owner receives a WhatsApp alert.
- While blocked, the login screen shows "Too many attempts. Try again in N minutes"; it never says
  whether the number exists.

**Out of scope (MVP):** CAPTCHA, device fingerprinting.

## 5. Feature 2: Tenant isolation & tenant profile

### FR-TEN-01:

## 6. Non-functional requirements

## 7. Out of scope for MVP
