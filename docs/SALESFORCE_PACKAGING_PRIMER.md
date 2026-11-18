# Salesforce Packaging Primer — What You Need to Ship This

This explains the Salesforce partner/packaging jargon and exactly what to obtain for this project.

---

## 1. The short version

To sell a **managed** Salesforce package on AppExchange, you need:

1. An **AppExchange Partner Program** account.
2. A **Dev Hub** org with a registered **namespace** prefix.
3. A **License Management Org (LMO)** with the **License Management App (LMA)** installed.
4. A **2GP managed package** built from the Dev Hub.
5. A passing **AppExchange Security Review**.
6. Meta-side assets (business portfolio, Meta app, WhatsApp account, phone number, permissions).
7. A place to host the **public webhook** — in our design, a **Salesforce Site** in each customer's org (no external server).

If you only need **internal** deployment, you can skip Partner Program/LMA/security review and use **source deployment** or an **unlocked package**. But if AppExchange is the goal, start the partner/namespace process now.

---

## 2. Terms explained

### 2.1 AppExchange Partner Program

Salesforce's partner program for companies that build and sell on AppExchange.

- Separate from a normal Salesforce customer account.
- Requires company/business verification and agreement to partner terms.
- Gives access to partner tools, the AppExchange listing process, and the security review.
- There may be fees depending on the partnership tier; check with Salesforce.
- You need this to list a commercial package.

**Action:** Apply at Salesforce's partner program site; ask for the **ISV/AppExchange** track.

### 2.2 Namespace

A short unique prefix for your package, e.g. `wapp` or `wa4sf`.

- All your custom objects, fields, Apex classes, etc. become `wapp__WhatsApp_Message__c`, `wapp__WhatsAppGraphClient`, etc.
- Prevents conflicts with other packages and customer org metadata.
- **Required for managed packages.**
- **Cannot be changed after creation.** Choose carefully.
- Registered in a Dev Hub; one namespace per Dev Hub (typically).

**Action:** Decide the prefix; register it in the Dev Hub before building package metadata. Avoid generic prefixes (`app`, `wa`, `sf`) that may be taken.

### 2.3 Dev Hub

A Salesforce org enabled as a **Dev Hub** for:

- Creating **scratch orgs** for development/testing.
- Creating **2GP package versions**.
- Managing namespaces and packages.

- Usually a **Partner Developer Edition** or an Enterprise org.
- Enable it in Setup → Dev Hub → Enable Dev Hub.
- Authorize it locally: `sf org login web --set-default-dev-hub --alias devhub`.

**Action:** Get/identify a Dev Hub. If you don't have one, a Partner Developer Edition is the usual path for ISVs.

### 2.4 Scratch orgs

Disposable Salesforce orgs defined by a JSON config (`config/project-scratch-def.json`).

- Created from the Dev Hub; used for development, CI, and testing.
- Short-lived (1–30 days); no production data.
- Perfect for repeatable builds/tests.
- You can define features (Service Cloud, Sales Cloud, Sites, Platform Events, etc.).

**Action:** Create a scratch org definition that includes Service Cloud, Sales Cloud, Sites, Platform Events, and any features you need.

### 2.5 2GP (Second-Generation Packaging)

The modern Salesforce packaging model.

- Source lives in a DX project; a **package version** is built from it.
- **Managed 2GP**: namespace-prefixed, IP-protected, upgradeable, LMA-compatible, AppExchange-ready.
- **Unlocked 2GP**: source-visible, easier for internal use; no IP protection; can be namespaced or not.
- **1GP**: older managed packaging; still supported but 2GP is preferred.

**Commands:**

```bash
# Create a package (once)
sf package create --name "WhatsApp for Salesforce" --package-type Managed --path force-app --target-dev-hub devhub

# Create a version
sf package version create --package "WhatsApp for Salesforce" --installation-key-bypass --wait 30 --target-dev-hub devhub

# Promote a version (for production installs)
sf package version promote --package "WhatsApp for Salesforce@1.0.0-1" --target-dev-hub devhub

# Install
sf package install --package 04t... --target-org myorg --wait 10
```

**Action:** Do not create the package until the namespace and initial metadata are ready. Package names/versions are part of your release history.

### 2.6 Managed vs unlocked package

|                 | Managed 2GP              | Unlocked 2GP             |
| --------------- | ------------------------ | ------------------------ |
| Namespace       | Required                 | Optional                 |
| Apex source     | Hidden                   | Visible                  |
| IP protection   | Yes                      | No                       |
| LMA licensing   | Yes                      | No (not for AppExchange) |
| AppExchange     | Yes                      | No                       |
| Upgrade path    | Yes                      | Yes                      |
| Security review | Required for AppExchange | Not required             |
| Ideal for       | Commercial product       | Internal/demo            |

**Recommendation for "both":**

- Build **managed-first** if AppExchange is real. Use **source deployment** to internal sandboxes/demo orgs; you don't need a separate unlocked package for internal use.
- If you truly need an installable internal package, create a separate **unlocked** package from the same source in a separate Dev Hub/namespace. Test both. This doubles release work; do it only if needed.

### 2.7 LMO (License Management Org) and LMA

The **License Management App** is a Salesforce app installed in your **LMO** (a Salesforce org you own).

- Tracks package licenses, seats, trials, and expirations.
- Links to your managed package.
- `UserInfo.isCurrentUserLicensed('wapp')` checks the current user.
- `PackageLicense` gives org status/expiration/allowed/used seats.
- `UserPackageLicense` gives seat assignments.
- Salesforce-native; **no backend server required**.

**Action:** Create/identify an LMO, install LMA from AppExchange, and link it to your package. This is part of the AppExchange partner setup.

### 2.8 Security Review

Salesforce's AppExchange security review checks your package for vulnerabilities and policy compliance.

- Automated scanning (Checkmarx-like) + manual review.
- Focus areas: CRUD/FLS, SOQL injection, XSS, CSRF, open redirect, insecure endpoints, secrets, guest user permissions, file upload, error handling, test coverage, accessibility, mobile.
- Can take weeks; findings must be fixed or documented as false positives.
- Required before listing on AppExchange.

**Action:** Build security-first from day one; run Salesforce Code Analyzer/PMD/ESLint in CI; keep Apex coverage high; no `innerHTML`; no hardcoded secrets.

### 2.9 AppExchange listing

After security review:

- Create the listing (name, tagline, description, logo, screenshots, video, pricing, support).
- Provide documentation, EULA, privacy policy, support/SLA.
- Provide a demo org/video.
- Pass Salesforce's listing review.

**Action:** Assign an owner for listing assets and support early.

### 2.10 Meta-side assets

Separate from Salesforce packaging, you need Meta assets:

- **Business portfolio** (Meta Business Suite).
- **Verified business** (for higher limits/OBA).
- **Meta app** (Business type) with the WhatsApp product.
- **WhatsApp account (WAAC)** and **Messaging account** (the old WABA ID identifies the Messaging account).
- **Business phone number** (registered, display name approved).
- **System User access token** (permanent) with `whatsapp_business_messaging` and `whatsapp_business_management`.
- **App secret** (for webhook HMAC).
- **App review/advanced access** if you are a Tech Provider/Solution Partner.
- For Embedded Signup/coexistence: **Tech Provider** status + Facebook app review.

**Action:** Create a Meta test app/WABA/number for development; start business verification/app review early; do not use personal tokens in production.

---

## 3. What you need for this project (checklist)

### 3.1 Salesforce partner/packaging

- [ ] AppExchange Partner Program account (ISV track).
- [ ] Dev Hub org (Partner Developer Edition or Enterprise) with Dev Hub enabled.
- [ ] Namespace prefix registered (e.g., `wapp`).
- [ ] LMO org with LMA installed.
- [ ] 2GP managed package created (after namespace).
- [ ] Security review readiness (Code Analyzer, tests, docs).
- [ ] AppExchange listing assets (logo, screenshots, video, docs, pricing, support).
- [ ] EULA, privacy policy, DPA, support/SLA.
- [ ] Demo org + demo data.

### 3.2 Salesforce org features (per customer)

- [ ] Enterprise/Unlimited/Developer edition (Sites/Platform Events/API limits).
- [ ] Salesforce Site or Experience Cloud site activated.
- [ ] Site guest user profile: webhook Apex class access + create-only on `WhatsApp_Webhook_Event__c`.
- [ ] Named Credential active (`callout:WhatsApp_Graph_API`).
- [ ] Remote Site Settings (fallback) for `https://graph.facebook.com` and `https://lookaside.fbsbx.com`.
- [ ] Platform Event `WhatsApp_Event__e`; platform event trigger run-as user configured (integration user).
- [ ] Custom Notification Type.
- [ ] Permission sets assigned (Admin/Agent/Template/Integration).
- [ ] Case/Lead record types, queues, owners, assignment rules.
- [ ] Retention/media policy.

### 3.3 Meta

- [ ] Business portfolio + business verification.
- [ ] Meta app (Business) + WhatsApp product.
- [ ] Messaging account + WhatsApp account + phone number.
- [ ] System User token (permanent) with required permissions.
- [ ] App secret + verify token.
- [ ] Webhook subscription fields.
- [ ] Payment method on the Messaging account (Meta bills the client) — for Option A.
- [ ] Tech Provider status/app review (only if Embedded Signup/coexistence/marketing partner features).
- [ ] Test phone number(s) for QA.

### 3.4 Twilio (if supported)

- [ ] Twilio account + WhatsApp sender.
- [ ] Account SID/Auth Token.
- [ ] Content templates/ContentSid (Twilio template model).
- [ ] Status callback URL.
- [ ] Twilio webhook signature validation.
- [ ] Capability matrix: document what Twilio cannot do (Flows/catalogs/groups/coexistence/quality webhooks/etc.).

---

## 4. How the package is built and released

### 4.1 Development flow

1. Developer creates a scratch org from the Dev Hub.
2. Push/pull source (`sf project deploy start` / `sf project retrieve start`).
3. Run Apex tests and LWC Jest.
4. Commit to feature branch.
5. CI creates a scratch org, deploys, tests, runs Code Analyzer.
6. Merge to main.
7. Release branch creates a package version.
8. Test install in a clean scratch org/sandbox.
9. Promote the version.
10. Install in customer org / publish install link.

### 4.2 Versioning

- `versionNumber`: `1.0.0.NEXT` (Salesforce increments the build number).
- `versionName`: `v1.0.0` or `v1.0.0-beta`.
- Promote only tested versions.
- Keep a `CHANGELOG.md`.

### 4.3 Upgrade rules

- Never delete fields/objects/components that customers may use; deprecate instead.
- Add new fields as nullable; provide defaults/migration.
- Test install → upgrade → data integrity.
- Managed package upgrades are automatic for subscribers; don't break APIs.
- Document uninstall behavior (data deletion).

### 4.4 CI/CD pipeline

**PR:**

- Prettier/ESLint.
- Code Analyzer (security).
- LWC Jest.
- Apex tests in scratch org.
- Deploy to fresh scratch org.
- Secret scan.

**Main/tag:**

- Create package version.
- Install in clean scratch org.
- Smoke test.
- Promote.
- Publish release notes/install link.

### 4.5 Required tests for package version creation

- Apex coverage ≥75% overall (target 85%+).
- All tests pass in the packaging org.
- No unresolved Code Analyzer High/Critical findings.
- LWC Jest passes.
- Security review readiness.

---

## 5. Common mistakes to avoid

1. **Building without a namespace**, then trying to convert to managed. The metadata names change; data migration is painful.
2. **Putting secrets in Custom Metadata** that admins must edit. CMT cannot be DML'd from Apex; protected CMT is invisible to subscribers.
3. **Giving the Site guest user broad object permissions.** Security review will fail; data exposure risk.
4. **No webhook signature verification.** Anyone can inject messages.
5. **No idempotency.** Meta retries for up to 7 days; duplicates.
6. **Synchronous callouts in the webhook.** Meta times out; use staging + async.
7. **Storing Meta tokens in source/CMT records.** Custom Settings are limited to 255 characters, and CMT records cannot be DML'd from an admin UI. Use a private `WhatsApp_Credential__c` object with Long Text Area fields (admin-only permission set), or Named Credentials. Never commit secrets.
8. **Using `innerHTML` in LWC.** Security review fail; XSS.
9. **No Apex tests.** 75% coverage required.
10. **No FLS/CRUD enforcement.** Security review fail.
11. **Hardcoded IDs** (queues, record types, users). Break on install.
12. **No upgrade testing.** Managed package upgrades can break data/automation.
13. **Assuming Twilio has full WABA parity.** It doesn't; document the capability matrix.
14. **Promising calling/large inbound media without a media/telephony service.** Hard platform limits.
15. **Storing card data in Salesforce.** PCI violation; use a payment gateway or let Meta bill the client.

---

## 6. Recommended sequence

1. **Now:** Apply for Partner Program; register namespace/Dev Hub; create LMO/LMA; create Meta test app/WABA/number.
2. **Weeks 1–2:** Clean repo; set up 2GP skeleton, CI, permission sets, settings, Named Credential, platform event, test harness.
3. **Weeks 3–6:** Build v1.0 core messaging (Meta first).
4. **Weeks 7–10:** Media, templates, inbox, notifications, routing.
5. **Weeks 11–14:** Rich messaging, analytics, Twilio compatibility.
6. **Weeks 15–22:** Flows/catalogs/groups/marketing/coexistence; Embedded Signup if approved.
7. **Weeks 23–30:** Security review, accessibility, performance, listing, launch.
8. **Post-launch:** Calling/payments via external partners; advanced enterprise features.

---

## 7. What to ask Salesforce/Meta

### Salesforce

- What partner tier do we need for AppExchange?
- What are the fees?
- How long does security review take for a package like this?
- Can we get a Partner Developer Edition/Dev Hub?
- What are the Sites/Platform Event limits for our target editions?
- Is there a native WhatsApp channel conflict/positioning guidance?

### Meta

- What is required for Tech Provider status?
- What is the app review timeline for `whatsapp_business_messaging` and `whatsapp_business_management`?
- Can we use Embedded Signup for our customers?
- What are the requirements for coexistence?
- What are the commerce/marketing eligibility requirements?
- What are the calling/SIP requirements?
