# Learning Log

One entry per session: what I learned, and where it fits in KarkhanaOS.

## 2026-09-29
- **Requirements:** FR = title + user story + Given/When/Then checklist.
- **Security:** user enumeration, lockout abuse, progressive backoff, password spraying + rate limiting.
- **Multi-tenancy:** tenant claim in the token (not a "signature"); switch factory = new token; least privilege.

## 2026-10-07
- **Invites:** single-use + expiring tokens; never let an invite link set a PIN on an existing account (account takeover); same response for registered and unregistered numbers.
- **Authorization:** Rule C, privilege escalation: grant only roles below your own.
- **PIN reset:** admins never set or see a PIN (non-repudiation); reset is not the same as revoke, so give the admin a choice.

<!-- Next entry: Piyush Garg GenAI video 1 -->
