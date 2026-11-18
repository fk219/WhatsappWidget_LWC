# Decisions & Implications

> Date: 2026-11-18
> Source: Scope questionnaire answers + architecture review

---

## 1. Decisions recorded

> **Final decisions are in Section 7.** Sections 2–6 contain the initial analysis and recommended defaults. Where they conflict with Section 7, Section 7 wins.

| Area           | Final decision                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------------- |
| Distribution   | **Both**: AppExchange managed package + internal/source deployment                                      |
| Provider       | **Meta Cloud API for v1**; Twilio dropped for v1 (may return later as a limited compatibility provider) |
| Onboarding     | **Embedded Signup must-have for launch**; manual credentials for development/pilot                      |
| Primary clouds | **Service Cloud + Sales Cloud + platform/custom object linking**                                        |
| v1 scope       | **All-in-one release** (ambitious; see Section 7.2)                                                     |
| Routing        | **Every Lead outreachable via WhatsApp**; unknown inbound creates a Lead; Case + Lead owner             |
| Inbound media  | **Accept ~10–12 MB limit**                                                                              |
| Licensing      | **Seat-based + ISV pays Meta and re-bills per message**                                                 |
| UI             | **SLDS-native, WhatsApp-inspired**                                                                      |
| Compliance     | **GDPR + opt-in/out**                                                                                   |
| Volume         | **10k–100k messages/month**                                                                             |
| Partner assets | **None yet** (namespace, Dev Hub, LMO, Partner Program, Meta Tech Provider)                             |
| Cleanup        | **Approved and started** (legacy archived, new root project scaffolded)                                 |

---

## 2. What these decisions mean

### 2.1 "Both" distribution — managed + unlocked

**Recommendation:** build **managed-first**, and use **source deployment to scratch orgs/sandboxes** for internal/demo. Do not maintain two separate package namespaces.

- A **managed 2GP package** requires a namespace (e.g., `wapp`). All custom metadata is prefixed (`wapp__WhatsApp_Message__c`), Apex is hidden, LMA works, upgrades work, AppExchange security review applies.
- An **unlocked package** can be namespace-less or namespaced. If you build managed first, the same source can be deployed directly to internal orgs without creating a second package; you don't need a separate unlocked package for internal use unless the customer must install/upgrade it as a package.
- If you truly need both package types, you need two package definitions/namespaces and a build pipeline that tests both. That doubles release work. **Recommendation:** managed for customers; source deploy or a single unlocked package for internal/demo, not both commercially.
- If you start with unlocked and later convert to managed, the metadata names change (namespace prefix) and data migration is painful. **Get the namespace/Dev Hub first** if AppExchange is a real goal.

**What to do now:** register the namespace and create the Dev Hub/LMO before writing package metadata. If not possible yet, keep all metadata namespace-safe (no hardcoded names, no standard-object assumptions) and plan the conversion.

### 2.2 Meta + Twilio — a capability split, not a symmetric choice

Meta Cloud API direct is the only way to expose the **full** WABA feature set. Twilio is a BSP with a different API and a subset of features. If you support both, you need:

1. **Provider abstraction**
   - `WhatsAppProvider` interface: `sendMessage`, `sendTemplate`, `sendMedia`, `markRead`, `getMedia`, `verifyWebhook`, `parseWebhook`, `syncTemplates`, `getCapabilities`.
   - `MetaCloudProvider` — reference implementation, full features.
   - `TwilioProvider` — compatibility layer, limited features.
2. **Canonical data model**
   - Normalize both providers into `WhatsApp_Message__c`, `WhatsApp_Conversation__c`, status values, media metadata, template references.
   - Store `Provider__c` and `Provider_Message_Id__c` on messages/accounts.
3. **Capability flags per provider/account**
   - `Supports_Templates__c`, `Supports_Interactive__c`, `Supports_Flows__c`, `Supports_Catalogs__c`, `Supports_Groups__c`, `Supports_Read_Receipts__c`, `Supports_Typing__c`, `Supports_Coexistence__c`, `Supports_Calling__c`.
   - The UI hides unsupported actions; the API rejects unsupported operations with a clear error.
4. **Separate webhook endpoints**
   - `/services/apexrest/whatsapp/meta/webhook` — JSON + `X-Hub-Signature-256` HMAC-SHA256.
   - `/services/apexrest/whatsapp/twilio/webhook` — form-encoded + `X-Twilio-Signature` HMAC-SHA1 (URL + sorted params).
   - Both stage into `WhatsApp_Webhook_Event__c` with `Provider__c`.
5. **Separate onboarding/setup**
   - Meta: App ID/secret/token/Messaging account/phone number ID + verify token + Embedded Signup.
   - Twilio: Account SID/Auth Token/From number/Content template SIDs; no Embedded Signup.
6. **Separate template models**
   - Meta templates: WABA template API, components JSON, status/quality webhooks.
   - Twilio templates: Content API/ContentSid; less metadata; no Meta quality/status webhooks.
7. **Pricing/billing**
   - Meta: per-message pricing from status webhooks.
   - Twilio: Twilio fees + Meta fees; different cost model.
   - A unified `WhatsApp_Usage__c` with provider-specific cost fields.

**What Twilio cannot give you (relative to Meta direct):**

- Full Meta template lifecycle (status/quality/category webhooks).
- WhatsApp Flows (as of now, Twilio may not expose the full Flow API).
- Catalogs/commerce, groups, coexistence, calling (Twilio Voice is separate).
- Account/quality/throughput webhooks.
- BSUID/username behavior.
- Embedded Signup.

**Recommendation:** make Meta the **primary, fully supported** provider; ship Twilio as a **compatibility mode** with a documented capability matrix. Do not promise "all WABA features on Twilio".

### 2.3 Manual + Embedded Signup

**Manual** (v1):

- Admin pastes Meta App ID, App Secret, System User access token, Messaging account ID (WABA ID), Phone Number ID, verify token.
- Setup wizard tests the connection, subscribes the app, and shows the webhook URL.
- Works for direct customers and partners; no Meta Tech Provider status required.
- Token storage: private `WhatsApp_Credential__c` object with Long Text Area fields, restricted to the WhatsApp Admin permission set; masked UI; rotation; optional Shield Platform Encryption. (Custom Settings cannot store more than 255 characters, and protected CMT cannot be DML'd from an admin UI.)

**Embedded Signup** (later; requires Meta partnership):

- You must be a **Meta Tech Provider** (or Solution Partner) with a Facebook app, business verification, and app review for `whatsapp_business_messaging` / `whatsapp_business_management`.
- LWC loads the Facebook JS SDK (`https://connect.facebook.net`), calls `FB.login` with `config_id`, `response_type=code`, `override_default_response_type=true`, and `extras`.
- Apex exchanges the code for a token (`GET /oauth/access_token`), retrieves the WABA/phone number IDs, subscribes the app, and stores the token.
- Security: state parameter, CSP trusted site, no token in client logs, token exchange server-side (Apex).
- This is a **phase 4** item; it is not required to start selling to direct customers.

**Important:** Embedded Signup is a Meta approval/partnership project, not just code. Start the Meta Tech Provider application early if this is a must-have.

### 2.4 Service + Sales + platform/custom objects

The package must support:

- **Service Cloud**: Case creation, Case owner/queue, Case feed, SLAs, Omni-Channel optional, Service Console.
- **Sales Cloud**: Lead creation/assignment, Lead owner, Contact/Account matching, campaigns/templates.
- **Platform/custom**: polymorphic linking to any object via `Parent_Record_Id__c` + `Parent_Object_API_Name__c`; object/field mappings via admin UI.

**Routing rule (recommended):**

| Inbound scenario                          | Action                                                                                                                                                                                                    |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phone/BSUID matches a **Contact/Account** | Create/update a **Case** (if enabled) linked to Contact/Account; assign Case owner/queue; conversation links to Case + Contact/Account.                                                                   |
| Phone/BSUID matches a **Lead**            | Assign conversation to the **Lead owner**; optionally create a Case; chat on Lead.                                                                                                                        |
| No match                                  | Create a **Lead** (if enabled) and assign to the default Lead owner/queue; conversation links to Lead. If Lead creation disabled, create a `WhatsApp_Profile__c` and route to a queue for manual linking. |
| Explicit opt-out                          | Update `WhatsApp_Consent__c`; block outbound per policy; notify owner.                                                                                                                                    |
| Existing open Case                        | Append to the existing Case/conversation; do not create duplicates.                                                                                                                                       |

**Open detail:** if a Lead converts to a Contact/Account while a conversation is open, the conversation should be re-parented (or linked to the new Contact/Account/Case) without losing history. Design a `Parent_Record_Id__c` update + audit.

### 2.5 "Everything in v1" — reality check

"Everything" is a **program goal**, not a single release. Some items are hard-blocked by the platform or by Meta eligibility. Here is the honest split.

#### Can be done natively (Apex/LWC/Salesforce Site), but in phases

- Text, media (within limits), templates, interactive buttons/lists, location, contacts, reactions, replies, mark-as-read, typing indicators, link previews.
- Template sync/create/delete/status/quality.
- Account/phone number status, quality, throughput, messaging limits.
- Consent/opt-in/out, 24h window, CTWA referral, pricing tracking.
- Inbox, notifications, Case/Lead routing, analytics, retention.
- Flows (send existing flows + receive responses; builder later).
- Catalogs/product/order messages (with Meta commerce eligibility; product sync is a project).
- Groups (with API eligibility; participant/message management).
- Marketing Messages API (with eligibility/onboarding; standard templates first).
- Coexistence/history sync (requires Embedded Signup/Tech Provider).
- Calling **events** and call-permission templates (not actual media).

#### Hard-blocked or requires an external service

1. **WhatsApp Calling (voice/video)** — the Calling API uses WebRTC/SIP for media. Apex/LWC cannot carry audio/video. To actually place/receive calls you need a telephony/WebRTC stack (Service Cloud Voice, Amazon Connect, Twilio Voice, Asterisk, etc.). The package can:
   - Configure call settings/call icons.
   - Send call-permission request templates and call buttons.
   - Receive/log call webhooks.
   - Deep-link to an external telephony provider.
   - **Cannot** be the media endpoint itself.
2. **Inbound media > ~12 MB** — Apex heap limit. Images (max 5 MB) fit. Audio/video (max 16 MB) and documents (max 100 MB) cannot be stored in Salesforce Files if over ~12 MB. Outbound large files work via a short-lived `ContentDistribution` link; inbound does not.
3. **WhatsApp Payments** — needs a payment gateway/provider and country-specific compliance. Out of scope for a pure package.
4. **Meta Business Agent / Conversation Routing** — Meta-side/partner-side; the package can configure/observe, not replace.
5. **Embedded Signup / Coexistence** — requires Meta Tech Provider status/app review; code is feasible, partnership is the gate.

#### Decision: all-in-one release

You chose a **single all-in-one release**. The workstreams below are internal phases, not separate public launches. Nothing ships commercially until all required workstreams are complete.

| Workstream                | Scope                                                                                                                             |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Foundation**            | Named credentials, data model, permissions, settings, platform events, setup app, CI, test harness.                               |
| **Core messaging**        | Webhook, Graph client, inbound/outbound text, statuses, phone matching, profile/conversation/message, 24h window, consent.        |
| **Media & templates**     | Media upload/download (≤12 MB inbound), Salesforce Files, templates sync/create/delete/send, status/quality webhooks.             |
| **Inbox & routing**       | Record chat, inbox, utility bar, Case/Lead creation, assignment, notifications, diagnostics.                                      |
| **Rich messaging**        | Interactive buttons/lists, location, contacts, reactions, replies, mark-read, typing, link previews, template builder, analytics. |
| **Automation & commerce** | Flows, catalogs/product/order, groups, marketing/MM API, CTWA attribution, bulk/scheduled.                                        |
| **Partner/enterprise**    | Embedded Signup, coexistence/history, multi-WABA, advanced routing, supervisor views.                                             |
| **Security & listing**    | Security review, accessibility, performance, packaging, LMA, AgentExchange listing.                                               |
| **Billing (deferred)**    | Seat subscription now; usage metering now; per-message re-billing only after a Meta credit line is secured.                       |

**Consequence:** realistic timeline **12–18 months**; Salesforce/Meta approvals are the critical path. Calling is not required; inbound media is capped at ~10–12 MB. There is **no pilot launch** under this decision.

### 2.6 Case + Lead owner routing

This is a good, pragmatic choice. It avoids Omni-Channel complexity and works in Sales/Service/Platform orgs.

**Design:**

- `WhatsApp_Conversation__c.Case__c` for Service Cloud.
- `WhatsApp_Conversation__c.Assigned_User__c` for Lead owner/agent.
- `WhatsApp_Conversation__c.Assigned_Queue__c` for unassigned/queue.
- `WhatsApp_Object_Mapping__c` decides which objects are searched and which object gets created.
- Case creation is configurable:
  - per conversation (recommended; one Case per thread),
  - per inbound message (noisy; not recommended),
  - manual.
- Lead creation is configurable; default owner/queue; duplicate handling.
- On Case/Lead owner change, update conversation assignment via trigger/Flow; on conversation claim, update Case/Lead owner (configurable, audit).
- Omni-Channel can be added later without blocking v1.

**Open detail:** Case record type, status mapping (New/Working/Closed), close reasons, SLA/Entitlement, and whether the Case is created on first inbound or only when the agent replies.

### 2.7 Media limit accepted — design implications

- **Inbound**:
  - Images: up to 5 MB → always fit.
  - Audio/video: up to 16 MB → import only if ≤ configured max (default 10 MB); otherwise mark `Too Large`.
  - Documents: up to 100 MB → import only if ≤ configured max; otherwise mark `Too Large`.
  - Store `WhatsApp_Media__c` metadata even when not imported; show a card with "File too large to import — ask customer to resend" and the file name/size.
  - Media IDs expire in 7 days; download promptly via Queueable.
- **Outbound**:
  - Use `ContentDistribution` for all media (not just large files). It avoids Apex heap and works for any size.
  - Short expiry (e.g., 1 hour); delete after `sent` or expire.
  - For images, you can also upload to Meta via multipart (≤5 MB); but ContentDistribution is simpler and consistent.
- **Storage — decision: everything stays in Salesforce; external archive is excluded.**
  - 100k messages/month with 30% media at 2 MB average = ~720 GB/year; at 5 MB average = ~1.8 TB/year.
  - The only ways to satisfy this are: buy **Salesforce file storage** (add-on) and/or **reduce retention/compress/limit video**.
  - The setup page must show a storage projection and a hard warning when the org entitlement is insufficient.
  - Confirm the org's file storage entitlement before committing to 1-year retention.
- **PDF/Office preview**:
  - Images/audio/video render inline via Salesforce file URL.
  - PDFs/Office docs: show a download card; iframe preview may be blocked by browser/Content Security Policy. Test.

### 2.8 Licensing + per-message billing ("card on WABA")

There are three distinct models. They are often confused; choose deliberately.

#### Option A — Client pays Meta directly (recommended)

- The client's **Messaging account** has its own payment method/card in Meta Billing Hub. Meta charges the client per delivered message.
- The package reads `statuses[].pricing` from webhooks and stores:
  - `Pricing_Category__c` (marketing/utility/authentication/service)
  - `Pricing_Billable__c`
  - `Pricing_Model__c`
  - `Pricing_Type__c`
- The package provides **usage/cost dashboards** and exports; it does **not** charge the card.
- The ISV charges a **subscription** (LMA seats) only.
- **No backend, no PCI, no card storage.** This is the cleanest model for "no backend".
- "Card on WABA" is literally Meta-side; the package never sees it.

#### Option B — ISV pays Meta and re-bills the client

- The ISV is a **Meta Solution Partner/Tech Provider** with a credit line; Meta bills the ISV; the ISV invoices clients.
- Requires:
  - Meta partner status/credit line.
  - Metering (the package can store per-message pricing).
  - Invoicing (Salesforce Billing/Revenue Cloud or a billing system).
  - Payment collection (Stripe/PayPal/bank transfer; external).
- Still possible with Salesforce-native data + an external payment gateway; not "no external service" for card charging.
- Per-message markup/margin is a business decision; the package can produce usage records.

#### Option C — Prepaid credits

- Client buys credits; package decrements per message; top-up via payment link.
- Requires a payment gateway and a ledger; more complex; not recommended v1.

**Decision: billing is deferred until the product is complete.** For now:

- Design for **Option A**: the client's card stays on their own Meta Messaging account; Meta bills them; the package charges only the **seat subscription** via LMA.
- Build **usage metering** now: `WhatsApp_Usage__c` daily/monthly rollups by category, billable, estimated cost, provider, account.
- When you qualify for **Meta Solution Partner/credit line**, add Option B invoicing/export and a payment gateway.
- Never store card data in Salesforce.

**Important:** Never store card numbers/CVV in Salesforce. If you need card charging, use a PCI-compliant gateway (Stripe, etc.) and tokenization. "Card on WABA" means Meta holds it; that's outside the package.

### 2.9 SLDS-native WhatsApp-inspired UI

- Use SLDS 2 styling hooks, spacing, typography, dark mode.
- WhatsApp green accent (`#25D366`) for primary send/launcher; dark green header optional.
- Chat bubbles: outbound light green, inbound white/gray; date separators; ticks.
- Responsive: mobile full-screen, tablet two-pane, desktop sidebar/floating.
- Accessibility: WCAG 2.1 AA; aria labels; focus; keyboard; `aria-live`.
- i18n: Custom Labels; `Intl.DateTimeFormat`; RTL.
- No `innerHTML`/manual DOM; use template iteration.
- Branding: respect WhatsApp brand guidelines; don't use the official logo without permission; use a generic chat icon or your own.

### 2.10 GDPR + opt-in/out

- Consent object with proof/source/date.
- Opt-out keywords; marketing vs transactional flags.
- Meta `user_preferences` webhook.
- 24h window enforcement.
- Retention/archival; export/delete by phone/BSUID.
- Audit logs for consent overrides.
- DPA with Meta; privacy policy; data processing documentation.
- No HIPAA/PCI claims.

### 2.11 Volume 10k–100k/month

This is feasible with Salesforce-native components, but validate:

| Limit                 | 10k/month        | 100k/month       | Action                                                     |
| --------------------- | ---------------- | ---------------- | ---------------------------------------------------------- |
| Sites requests        | ~333/day         | ~3,333/day       | Check edition Sites limits; likely fine.                   |
| Sites bandwidth       | small            | ~1–5 GB/month    | Check; media not through Site.                             |
| Platform Events       | 10k              | 100k             | Check edition event limits; consider CDC/polling fallback. |
| Apex async            | 10k              | 100k             | Fine with Queueable/Batch; monitor.                        |
| API callouts          | 10k              | 100k             | Fine; 100/transaction; queue.                              |
| Custom object records | 120k/year        | 1.2M/year        | Check storage; retention/archive.                          |
| File storage          | depends on media | potentially huge | **Critical**: media ratio/retention.                       |
| Webhook payloads      | small            | small            | Site request size; typical <10 KB.                         |

**Biggest risk: Salesforce file storage**, not message records. If 100k messages/month include images/video/documents, storage will explode. Need media ratio and retention policy. Ask.

### 2.12 Partner assets

See `docs/SALESFORCE_PACKAGING_PRIMER.md` for a full explanation. Short version:

- **AppExchange Partner Program** — commercial/partner account with Salesforce; required to list.
- **Namespace** — a unique prefix registered in a Dev Hub; required for managed packages; cannot be changed later.
- **Dev Hub** — an org enabled for scratch orgs and 2GP package creation.
- **LMO (License Management Org)** — a Salesforce org with the License Management App; tracks seats/trials.
- **2GP managed package** — versioned, namespace-prefixed, IP-protected, upgradeable; AppExchange security review.
- **Security review** — Salesforce's AppExchange code/security review; weeks-long; fix findings.
- **Meta side** — business portfolio, verified business, Meta app, WABA/Messaging account, phone number, app review; Tech Provider for Embedded Signup/coexistence.

**If you have none of these:** start with a **scratch org + source deployment** (not a package) to build/validate; register the namespace/Dev Hub early; create a managed package once the metadata is stable. Do not build 6 months of metadata without a namespace if AppExchange is the goal.

---

## 3. Revised program roadmap

| Phase                                  | Duration   | Scope                                                                                                                                                                                                              | Dependencies                         |
| -------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------ |
| **0. Foundation**                      | 2–3 weeks  | Cleanup, namespace/Dev Hub/LMO, 2GP, CI, data model, permission sets, settings, Named Credentials, platform events, test harness, docs.                                                                            | Partner assets; Meta app.            |
| **1. Core messaging**                  | 4–5 weeks  | Meta provider, setup/manual onboarding, webhook (GET/HMAC/staging/processor), inbound text/status, outbound text, phone matching, profile/conversation/message, record chat, platform events, 24h window, opt-out. | Site/guest user; Named Credential.   |
| **2. Media + templates**               | 4–5 weeks  | Media upload/download (≤12 MB inbound), ContentDistribution outbound, templates sync/create/delete/send, template picker, status/quality webhooks, retention.                                                      | Meta template approval.              |
| **3. Inbox + notifications + routing** | 3–4 weeks  | Inbox, assignment, unread, search, utility bar, Custom Notifications, Case/Lead routing, health dashboard.                                                                                                         | Case/Lead config.                    |
| **4. Rich messaging**                  | 4–5 weeks  | Interactive buttons/lists, location, contacts, reactions, replies, mark-read, typing, link previews, template builder, analytics.                                                                                  | Meta API versions.                   |
| **5. Automation/commerce**             | 6–8 weeks  | Flows, catalogs/product/order, groups, marketing/MM API, CTWA attribution, bulk/scheduled.                                                                                                                         | Meta commerce/marketing eligibility. |
| **6. Partner/enterprise**              | 6–8 weeks  | Embedded Signup, coexistence/history, multi-WABA, Omni-Channel/supervisor, advanced routing.                                                                                                                       | Meta Tech Provider/app review.       |
| **7. Voice/payments**                  | 8–12 weeks | Calling via external telephony; payments via provider; Business Agent integration.                                                                                                                                 | Telephony/payment partners.          |
| **8. AppExchange readiness**           | 6–8 weeks  | Security review, accessibility, performance, packaging, LMA, docs, listing.                                                                                                                                        | Partner program; security review.    |

**Total:** ~10–14 months for the full program with a small team; v1.0 in ~3–4 months if focused.

---

## 4. Immediate next steps

1. **Confirm the phased framing** (v1.0 = complete messaging platform; "everything" = program). If you truly need all features before launch, we need to re-plan the timeline and external partners.
2. **Confirm the billing model** (Option A client pays Meta directly vs Option B ISV re-bills). This determines whether we need a billing/payment integration.
3. **Confirm Twilio's role** (compatibility mode with a limited feature set, or full parity — full parity is not possible).
4. **Confirm partner assets status** (namespace/Dev Hub/LMO/Partner Program). If none, start with source deployment and register the namespace early.
5. **Confirm media ratio/retention** (messages with media %, retention days) because file storage is the biggest scale risk.
6. **Confirm Case/Lead routing details** (Case per conversation vs per message; Lead creation; record types; queues; SLA).
7. **Provide Meta assets** (app, WABA/Messaging account, phone number, token) for a sandbox test.
8. **Approve the cleanup plan** so I can archive the obsolete Node projects and restructure the repo.

---

## 5. Open decisions (next round)

1. **Billing**: client pays Meta directly (A) vs ISV re-bills (B) vs prepaid credits (C)?
2. **Twilio**: limited compatibility mode (recommended) vs full parity (not possible) vs drop Twilio for v1?
3. **"Everything"**: phased program (recommended) vs all-in-one release (12–18+ months, still excludes calling media/large inbound media)?
4. **Embedded Signup**: required for launch or phase 6? Do you have/want Meta Tech Provider status?
5. **Coexistence**: required for launch or phase 6? Do you have WhatsApp Business app customers?
6. **Calling**: do you need actual voice/video, or just call buttons/events + external telephony deep link?
7. **Media**: what % of messages have media, and how many days must media be retained?
8. **Case/Lead**: Case per conversation vs per inbound message; auto-create Lead for unknown numbers; default owners/queues; record types.
9. **Partner assets**: do you have namespace/Dev Hub/LMO/Partner Program? If not, can you obtain them now?
10. **AppExchange launch date**: fixed date or best-effort?

---

## 6. What I recommend we build first (concrete)

Even with the "everything" end goal, the first shippable slice should be:

- `WhatsApp_Settings__c` (protected hierarchy) + `WhatsApp_Account__c` + `WhatsApp_Object_Mapping__c`.
- `WhatsApp_Profile__c`, `WhatsApp_Conversation__c`, `WhatsApp_Message__c`, `WhatsApp_Message_Status__c`, `WhatsApp_Media__c`, `WhatsApp_Consent__c`, `WhatsApp_Webhook_Event__c`, `WhatsApp_API_Log__c`, `WhatsApp_Outbound_Queue__c`.
- `WhatsAppGraphClient` + `MetaCloudProvider` + `WhatsAppProvider` interface.
- `WhatsAppWebhookResource` (Meta GET/POST, HMAC, staging) + `WhatsAppWebhookProcessor` + Queueable.
- `WhatsAppPhoneMatcher` (Lead/Contact/Account/custom; E.164; BSUID).
- `WhatsAppOutboundService` + Queueable (text first; media/template next).
- `whatsappChat` LWC (inline/floating; text; status ticks; 24h window; opt-out; platform events).
- `whatsappSetup` LWC (manual Meta connection, test, webhook URL, mappings).
- Permission sets, Named Credential, Platform Event, Custom Notification, Custom Labels.
- Apex tests + LWC Jest + CI.

This gives a real, demonstrable product in ~6–8 weeks, then layers the rest.

---

## 7. Final decisions (round 2) and reality check

### 7.1 Final decisions

| Area           | Final decision                                                                                     |
| -------------- | -------------------------------------------------------------------------------------------------- |
| Distribution   | Both: AppExchange managed package + internal/source deployment                                     |
| Provider       | Meta Cloud API for v1; Twilio dropped for v1                                                       |
| Onboarding     | Embedded Signup must-have for launch; manual credentials for dev/pilot                             |
| Clouds         | Service Cloud + Sales Cloud + platform/custom object linking                                       |
| Release        | All-in-one release                                                                                 |
| Routing        | Every Lead outreachable via WhatsApp; unknown inbound creates a Lead; Case + Lead owner            |
| Inbound media  | Accept ~10–12 MB limit                                                                             |
| Data & media   | Everything stays in Salesforce; no external archive                                                |
| Licensing      | Seat-based now; client pays Meta directly; ISV re-billing later when a Meta credit line is secured |
| Billing        | Deferred until the product is complete; usage metering now, charging later                         |
| Lead outreach  | WhatsApp action on every Lead; **no automatic messages**                                           |
| Configuration  | Admin page for object/field mapping, routing rules, and business logic                             |
| UI             | SLDS-native, WhatsApp-inspired                                                                     |
| Compliance     | GDPR + opt-in/out                                                                                  |
| Volume         | 10k–100k messages/month                                                                            |
| Partner assets | None yet                                                                                           |
| Cleanup        | Approved and started                                                                               |

### 7.2 Four red flags to resolve before committing to a date

#### 1. No partner assets + AppExchange + Embedded Signup at launch + all-in-one

**Decision:** all-in-one only; no pilot launch.

**Consequences:**

- The launch date is driven by Salesforce/Meta approvals, not by the development team.
- Start the **Salesforce Partner Community/ISV application** and the **Meta Tech Provider/App Review** immediately.
- Target **12–18 months**; if either approval slips, the launch slips.
- Manual Meta credentials are for development/testing only; the commercial launch uses Embedded Signup.

#### 2. ISV pays Meta and re-bills the client

**Decision:** billing is deferred until the product is complete. For now:

- The client's card stays on their own Meta Messaging account; Meta bills them.
- The package charges only the **seat subscription** via LMA.
- Build **usage metering** now (`WhatsApp_Usage__c`) so re-billing can be added later.
- Apply for **Meta Solution Partner/credit line** after building traction; then add invoicing/payment integration.
- Never store card data in Salesforce.

#### 3. >30% media + 1-year retention, all data in Salesforce

**Decision:** everything stays in Salesforce; external archive is excluded.

At 100k messages/month, 30% media:

- 30k media/month × 12 = **360k files/year**.
- At 2 MB average = **~720 GB/year**.
- At 5 MB average = **~1.8 TB/year**.

The only ways to satisfy this are:

1. **Salesforce file storage add-on** large enough for the projected volume.
2. **Reduce retention/compress images/limit video** (e.g., 90–180 days).
3. Both.

The setup page will show a storage projection and a hard warning if the org entitlement is insufficient. **Confirm the org's file storage entitlement before committing to 1 year; otherwise the 1-year requirement is not feasible.**

#### 4. Embedded Signup at launch with no Meta Tech Provider status

**Decision:** Embedded Signup is a must-have for launch.

- Meta Tech Provider status + business verification + App Review are prerequisites.
- App configuration (`config_id`), domain verification, privacy policy, data deletion callback.
- Meta can reject or delay; you cannot code around it.
- **Start the Meta Tech Provider application immediately.** If Meta delays, the launch slips; there is no pilot/manual-onboarding fallback under the all-in-one decision.

### 7.3 "Every Lead outreachable via WhatsApp" — design

- Package a **`lightning__RecordAction`** "WhatsApp" for Lead, Contact, Account, and Case, plus a record-page component.
- When a Lead is created/updated with a phone number, lazily create/update `WhatsApp_Profile__c`. **No automatic messages are sent.**
- If a Lead has no phone, the action prompts the agent to add one; never fail silently.
- Unknown inbound number: create a **Lead** (configurable), assign to the default Lead owner/queue, dedupe by normalized phone/BSUID.
- Lead conversion: re-parent the conversation to the new Contact/Account/Case, preserve message history, and audit the change.
- Case creation: **one Case per conversation** (recommended), linked to Contact/Account; Case owner/queue drives assignment.
- "Every Lead" does **not** mean auto-send a template on creation. **The package never sends automatic messages**; sending is always agent-initiated (or an explicit, separately approved automation outside the package).
- Bulk/list-view outreach: later phase, with opt-in and rate limits.

### 7.4 What "all-in-one" includes and what remains blocked

Use the capability matrix in `docs/ENTERPRISE_ANALYSIS.md`. Hard blockers/decisions:

| Item                                  | Status                                                                          |
| ------------------------------------- | ------------------------------------------------------------------------------- |
| Calling (voice/video)                 | Not needed; no call UI or media stack                                           |
| Inbound media >12 MB                  | Accepted limit; cannot store in Salesforce Files without a backend              |
| Payments                              | Deferred; no payment integration in the product                                 |
| Embedded Signup / coexistence         | Embedded Signup must-have at launch; coexistence later; Meta Tech Provider gate |
| Twilio                                | Dropped for v1                                                                  |
| Catalogs / groups / marketing / Flows | Included in the all-in-one release; Meta eligibility/complexity applies         |
| Business Agent / Conversation Routing | Meta-side; configure/observe only                                               |
| Data & media                          | All in Salesforce; no external archive                                          |
| Automatic messages                    | None; sending is agent-initiated only                                           |

### 7.5 Revised timeline for the all-in-one decision

| Workstream                                                                | Duration                 | Dependency                                              |
| ------------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------- |
| Salesforce Partner Program, namespace, Dev Hub, LMO                       | 2–8 weeks                | Salesforce approvals                                    |
| Meta Tech Provider, business verification, app review                     | 4–12+ weeks              | Meta approvals                                          |
| Foundation, data model, CI, permissions, settings                         | 3–4 weeks                | Namespace/Dev Hub                                       |
| Core messaging (webhook, Graph client, text, phone matching, record chat) | 6–8 weeks                | Meta test app/number                                    |
| Media + templates                                                         | 6–8 weeks                | Template approvals                                      |
| Inbox + notifications + Case/Lead routing                                 | 4–6 weeks                | Case/Lead config                                        |
| Rich messaging + Flows + catalogs + groups + marketing + coexistence      | 12–16 weeks              | Meta eligibility                                        |
| Embedded Signup                                                           | 4–6 weeks after approval | Meta Tech Provider                                      |
| Configuration/rules UI (mappings, routing, business logic)                | 4–6 weeks                | Core data model                                         |
| Usage metering (now); re-billing/invoicing (deferred)                     | 2–4 weeks now            | Meta credit line later                                  |
| Security review + AppExchange listing                                     | 8–12 weeks               | Partner Program, code complete                          |
| **Total (all-in-one)**                                                    | **12–18 months**         | Critical path: Partner/Meta approvals + security review |

**No pilot launch** under this decision. Manual credentials are for development/testing only; Embedded Signup is the commercial launch path.

### 7.6 What was done in the cleanup

- Archived `whatsappWidget_1`, `WhatsappMiddleware_2`, `WhatsappWidget_BE-main`, and the old `force-app` under `legacy/`.
- Moved the Salesforce DX project to the repository root.
- Added a new `force-app` skeleton with:
  - `WhatsAppConstants` + test
  - `WhatsApp_Settings__c` protected hierarchy custom setting (non-secret initial fields)
  - `WhatsApp_Credential__c` private credential object with Long Text Area fields (Custom Settings max out at 255 chars)
  - `WhatsApp_Event__e` platform event
  - Custom permissions (Admin/Agent/Template Manager/Bulk Send)
  - Permission sets (Admin/Agent)
  - Custom labels
  - Remote Site Settings for Meta Graph API and media CDN
  - `manifest/package.xml`
- Added proper `.gitignore`, `.forceignore`, `.prettierignore`, `README`, `CHANGELOG`, `SECURITY`, and legacy README.
- Added `docs/PARTNER_APPLICATION_GUIDE.md` (Salesforce ISV, Meta Tech Provider, Solution Partner/credit line as a solo developer).
- Added `docs/CONFIGURATION_MODEL.md` (setup app, object/field mapping, routing rules, business logic, no auto-send).
- Updated `sfdx-project.json`, `package.json`, `jest.config.js`, and the scratch org definition.
- Validated all XML/JSON and ran Prettier.

Not yet built: the data model objects, webhook, Graph client, LWC chat/inbox/setup, and tests beyond `WhatsAppConstantsTest`.

### 7.7 Decisions answered / remaining

**Answered:**

- **Launch:** all-in-one only; no pilot.
- **Billing:** deferred until the product is complete. Seat subscription now; client card on the client's own Meta account; usage metering now; per-message re-billing later when a Meta credit line is secured.
- **Twilio:** dropped for v1.
- **Embedded Signup:** must-have for launch.
- **Calling:** not needed.
- **Lead outreach:** WhatsApp action on every Lead; **no automatic messages**.
- **Media:** all data/media in Salesforce; ~10–12 MB inbound cap; 1-year retention at >30% media requires a Salesforce storage add-on or reduced retention/compression.
- **Cleanup:** done; changes staged for commit/push.

**Remaining:**

1. **File storage:** what is the org edition/user count/file storage entitlement? Buy a Salesforce storage add-on, reduce retention/compress, or both?
2. **Meta credit line:** when will you apply for Meta Solution Partner/Reseller? Until then, the client-paid model is the only supported billing flow.
3. **Case/Lead defaults:** default Lead owner/queue, Case record type/queue, Case creation timing (first inbound vs first agent reply), Lead conversion behavior.
4. **Partner applications:** who owns the Salesforce Partner Community/ISV application and the Meta Tech Provider/App Review? Start now.
5. **Configuration scope:** which mapping/rule conditions and actions are must-have for the first release? See `docs/CONFIGURATION_MODEL.md`.
6. **AgentExchange pricing/listing:** pricing model and listing assets (logo, screenshots, video, docs, support/SLA).
7. **Salesforce namespace/Dev Hub/LMO:** can you start these now? If not, source deployment is still possible, but the managed package cannot be created.
