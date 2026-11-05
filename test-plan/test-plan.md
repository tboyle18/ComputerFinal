# Test plan

18 test cases mapped to the OWASP Top 10 (2021). Run on every build in the same order.
Lock this file (commit it) **before** generating any build.

Each test records: the exact request or payload, the expected secure behavior, what actually happened, and a screenshot.

| ID | Test | OWASP | Tool |
|---|---|---|---|
| T01 | SQL injection in search and login | A03 Injection | Burp, sqlmap |
| T02 | Stored XSS in listing descriptions and messages | A03 Injection | Burp |
| T03 | Edit or delete another user's listing by changing its ID | A01 Broken Access Control | Burp Repeater |
| T04 | Read another user's messages | A01 Broken Access Control | Burp Repeater |
| T05 | Reach admin pages or API routes as a regular user | A01 Broken Access Control | Burp |
| T06 | Call API routes with no session at all | A01 Broken Access Control | Burp, curl |
| T07 | CSRF on state-changing actions | A01 Broken Access Control | Burp |
| T08 | Change the price or total in the checkout request | A04 Insecure Design | Burp Repeater |
| T09 | Upload a non-image, oversized or script-bearing file (HTML, SVG) | A04 Insecure Design | Burp |
| T10 | Brute-force login (no rate limit or lockout) | A07 Auth Failures | Burp Intruder |
| T11 | Weak password rules | A07 Auth Failures | Manual |
| T12 | Session cookie flags, expiry, logout invalidation | A07 Auth Failures | Burp, browser |
| T13 | Passwords stored in plaintext or with a weak hash | A02 Cryptographic Failures | Inspect database |
| T14 | Hardcoded secrets in source or client JS | A05 Misconfiguration | gitleaks, Semgrep |
| T15 | Missing security headers (CSP, framing) | A05 Misconfiguration | ZAP |
| T16 | Verbose errors or stack traces | A05 Misconfiguration | ZAP, Burp |
| T17 | Known-vulnerable dependencies | A06 Vulnerable Components | npm audit |
| T18 | Logins and failures not logged | A09 Logging Failures | Inspect logs |

## Test case template

Copy this block for each test and fill in the exact steps and payloads before any build exists.

```markdown
### T00: <name>
- **Steps:**
- **Payload / request:**
- **Expected secure behavior:**
- **Pass if:**
- **Fail if:**
```
