# 01 — Authentication & Multi-Tenancy

**Status:** Draft · **Author:** Saad Siddiqui · **Last updated:** 2026-09-29

---

## 1. Clarifying questions for the client
<!-- Task 1: at least 6 questions. Write the client's answers under each one once you have them. -->

1. If store keeper do not have email how would the login to system.
Answer: Login by phone or predefine pin. 
Question what happend if they forgot the pin or phone lost?
Onboarding staff: who creates staff accounts, and how does a new store boy get into the system on day one? 

2. There will be multiple rolese for you and your son is super admin who can view and do all kind of stuf. Munshi / Admin. can do some important works and make ledger etc but restricted to view sale profits and store keeprs or workers can do inventory update only in or out billing.
How each user can perform how much authenticated tasks like I described above 

3. Way to revoke access and passwords as the previous munshi still can use the old system
revoking access may take time untill they can use the token for api access or login in some way. 
here is a hint we can restricit account from super admin and mark the user who left as in active and remove only user creds not the related data we do not delete user. 
4. How much and what kind of data for tenate should we have while registering? 
- Multi-factory users: could one person (Bilal, an accountant) work in both your factory and the cousin's? Does other tenat register or you add them internally using tool 

## 2. Tenancy model decision
<!-- Task 2: which model, why (3–5 sentences), and how you prevent a missed-tenantId leak. -->
1.I think we should go with shared database first and use seprate domain subdomain way to uniquely identify tenate in this way our concern of skipping tenant identification will be minimum.

when a request come from a domin we will identifiy the doamin in the request middleware and load the tenant related data and authenticate the request if the login or request user authenticated to request that url or data in this our sub domain process will be affective i think. 
and one more point it give the tenate a self owning saas feeling marketing prespective.

2. For mvp shared database is good as it keeps the logic simple and straight for mvp and learning other things in this saas product. 
3. userr detail and tenat id we will use the middleware for this. 
4. same user with same pin or number we will not allow that same user with different email or number or something unique we will use for this. 
5. When we are done with our basic flows and testing features we will seprate the database when our users base incresed 

## 3. Roles & permissions

| Action | Owner | Son / Manager | Munshi | Store keeper |
|---|---|---|---|---|
|  |  |  |  |  |

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
