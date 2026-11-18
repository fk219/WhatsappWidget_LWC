# Security Policy

## Supported versions

This project is pre-release. Security fixes are applied to the `main` branch until a release process is established.

## Reporting a vulnerability

Do not open a public issue for security vulnerabilities.

Send a private report to the project maintainers with:

- A description of the issue
- Steps to reproduce
- Impact assessment
- Any suggested fix

## Security requirements for contributors

- Never commit secrets, tokens, app secrets, or customer data.
- Store credentials in a private `WhatsApp_Credential__c` object with Long Text Area fields (Custom Settings are limited to 255 characters), restricted to WhatsApp administrators. Use Shield Platform Encryption where available. Never use Custom Metadata records for secrets.
- Use Named Credentials or Remote Site Settings for callouts.
- Enforce CRUD/FLS and sharing rules; use `WITH USER_MODE` / `Security.stripInaccessible`.
- Validate and allowlist dynamic object/field names; use `Database.queryWithBinds`.
- Never use `innerHTML`, `eval`, `document.write`, or manual DOM rendering in LWC.
- Verify Meta webhook signatures (`X-Hub-Signature-256`) and Twilio signatures where applicable.
- Make webhook processing idempotent; Meta retries for up to 7 days.
- Keep the Site guest user to the minimum: webhook Apex class + create-only staging object.
- Redact tokens and PII from logs.
- Run Salesforce Code Analyzer and LWC ESLint before merging.
- Add tests for security-sensitive paths.

## AppExchange

Before submitting for AppExchange security review:

- Run Salesforce Code Analyzer with security rules and resolve High/Critical findings.
- Verify CRUD/FLS, SOQL injection, XSS, CSRF, open redirect, and guest-user controls.
- Complete the accessibility (WCAG 2.1 AA) checklist for LWC.
- Provide a threat model and data-flow diagram.
- Document false positives with evidence.
