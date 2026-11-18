# WhatsApp for Salesforce — Enterprise Analysis & Target Architecture

> Status: Analysis / pre-implementation
> Date: 2026-11-18
> Scope: Salesforce-native WhatsApp Business Platform (Cloud API) package, **no application middleware / no backend server**
>
> **Scope decisions are in [`DECISIONS.md`](DECISIONS.md).** Where this analysis recommends a different path (for example phased releases, Twilio, external media archive, pilot launch), the decisions document wins.

---

## 1. Executive summary

### 1.1 What this repository currently is

The repository contains **four separate attempts** at the same product:

| Project                                               | What it is                                                               | Status                                | Recommendation                                 |
| ----------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------- | ---------------------------------------------- |
| `WA_Widgte_Standalone-main/WA_Widgte_Standalone-main` | Salesforce DX project with Apex + LWC, Meta/Twilio dual-provider concept | **Partial prototype, not deployable** | Use as the base, but rewrite the Apex/LWC core |
| `whatsappWidget_1`                                    | Original LWC + Node/Socket.IO prototype                                  | Obsolete                              | Archive / remove                               |
| `WhatsappWidget_BE-main`                              | Node/Express + MongoDB + Twilio backend                                  | Obsolete for this requirement         | Archive / remove                               |
| `whatsappMiddleware_2`                                | Earlier duplicate of the Node backend                                    | Obsolete                              | Archive / remove                               |

Only the standalone DX project is relevant. Even that project **cannot be deployed today**: it has empty field metadata, invalid XML, missing metadata (platform event, permission sets, Named Credentials), no Apex tests, and a broken LWC.

### 1.2 The target

A **managed 2GP Salesforce package** (or unlocked package if internal-only) that lets a customer:

- Connect their own Meta WhatsApp Business Platform assets (WhatsApp account + Messaging account + phone number).
- Send/receive all supported WhatsApp message types from Salesforce.
- Manage templates, media, consent, conversations, routing, and analytics.
- Expose a Salesforce Site webhook for Meta callbacks.
- Run entirely inside the customer's Salesforce org (Apex + LWC + Salesforce Files + Platform Events + Salesforce Sites). No Node/Express/MongoDB/Heroku/Render service.

### 1.3 The honest constraint

"No middleware" is achievable for **messaging, templates, media, webhooks, real-time UI, consent, routing, analytics, and most WABA management APIs**. It is **not** achievable, without a media/telephony backend, for:

1. **WhatsApp Calling (voice/video)** — requires WebRTC/SIP media handling, not Apex/LWC. The package can support call-permission templates and call-event logging, but not actual calls.
2. **Inbound media above ~12 MB** — Apex heap limits prevent downloading/storing large audio/video/documents. Images (max 5 MB) fit; audio/video (max 16 MB) and documents (max 100 MB) do not. Outbound large files can be sent via a Salesforce `ContentDistribution` link, but inbound large files cannot be stored in Salesforce without a backend.
3. **WhatsApp Payments** — payment provider/gateway integration and country-specific compliance; out of scope for a pure Salesforce package.
4. **Meta-hosted Business Agent / Conversation Routing partner features** — mostly Meta-side/partner-side; the package can configure/observe some of it but not replace it.
5. **Very high webhook volume** — Salesforce Sites has request/bandwidth limits; high-volume inbound may exceed them. Need volume numbers.

Everything else is feasible natively. The package should be positioned as **"the complete WABA console inside Salesforce"**, with clear limits documented.

---

## 2. Repository inventory

### 2.1 File/LOC summary

- Current repo size (excluding `.git`): ~1.4 MB.
- Git pack: ~13.8 MiB, largely because `node_modules` was committed historically (`lwc-sandbox/node_modules`, `whatsappMiddleware_2/node_modules`).
- Salesforce metadata: 41 XML files, 26 JS files, 5 Apex classes, 5 HTML files, 4 CSS files.
- Apex: **0 test classes**. LWC: 2 test files, neither covers the chat widget, inbox, or Apex controllers.

### 2.2 The four projects

#### A. `WA_Widgte_Standalone-main/WA_Widgte_Standalone-main` (the base)

**Contents**

- Apex:
  - `WhatsAppChatController.cls` — REST webhook + `loadMessages` + `sendWhatsAppMessage`
  - `WhatsAppOutboundService.cls` — Twilio + Meta send
  - `WhatsAppConfigUtil.cls` — license + settings + mapping
  - `WhatsAppInboxController.cls` — conversation list
  - `WhatsAppArchiveBatch.cls` — retention batch
- LWC:
  - `whatsappChatWidget` — 1,012-line chat UI (broken)
  - `whatsappInbox` — two-pane inbox shell
  - `whatsappGlobalNotification` — utility bar shell
  - `whatsappAdminDashboard` — setup shell
  - `utilityService.js` — unused 10-line helper with an invalid `.js-meta.xml`
- Objects:
  - `WhatsAppMessage__c`, `WhatsApp_Opt_Out__c`, `App_License_Status__c` (hierarchy setting), `WhatsApp_Provider_Setting__mdt`, `WhatsApp_Object_Mapping__mdt`
- Docs:
  - `docs/superpowers/specs/...` and `docs/superpowers/plans/...` — stale, contradict the no-middleware requirement (hub telemetry, protected CMT edited via UI, Twilio)
  - `CONFIGURATION_GUIDE.md` — stale; references hardcoded Twilio keys that no longer exist in the code

**Verdict:** Product concept is good; implementation is a prototype. Reuse the concepts and the visual design ideas, not the code.

#### B. `whatsappWidget_1`

Original LWC + Node/Socket.IO prototype. It:

- Calls `http://localhost:3001` via `fetch`.
- Derives a phone number from `recordId.slice(-9)` — fundamentally wrong.
- Loads a 49 KB minified Socket.IO client from a static resource.
- Has no Salesforce data model.

**Verdict:** Obsolete. Archive/remove.

#### C. `WhatsappWidget_BE-main`

Node/Express + MongoDB + Twilio backend. It has some useful ideas:

- Retry with exponential backoff.
- Twilio status callbacks.
- Template send.
- Message status model.
- Phone formatting (UAE-specific).

But it is a server, has wildcard CORS, a lock file, MongoDB, and Twilio-specific logic. **Verdict:** Remove from the product; port only the retry/idempotency/status ideas to Apex.

#### D. `whatsappMiddleware_2`

Earlier, smaller duplicate of C. **Verdict:** Remove.

---

## 3. Deployment blockers and critical defects

These are not style issues; the package will not compile/deploy or will fail at runtime.

### 3.1 Object metadata

1. **Empty field files.** These files are 0 bytes:
   - `WhatsAppMessage__c/fields/Direction__c.field-meta.xml`
   - `Is_Read__c`, `Media_URL__c`, `Message__c`, `Phone_Number__c`, `Sent_By__c`, `Status__c`, `Timestamp__c`, `Twilio_Message_SID__c`
   - Result: every Apex reference to these fields fails validation.
2. **Invalid XML in `WhatsAppMessage__c.object-meta.xml`:**
   ```xml
   <enableStreamingApi>true</enableSharing>
   ```
   The closing tag is wrong. Deploy fails.
3. **`WhatsApp_Provider_Setting__mdt` and `WhatsApp_Object_Mapping__mdt` are `Protected` + `DeveloperControlled`.**
   - Subscribers cannot see or edit protected CMT records.
   - Apex **cannot DML** CMT records.
   - Therefore the Admin Dashboard cannot save credentials or mappings into them. The existing plan (save settings to CMT from LWC/Apex) is impossible as designed.
4. **`WhatsApp_Opt_Out__c` uses `ReadWrite` sharing.** Phone numbers and consent data are exposed org-wide. Should be Private with explicit access.
5. **No `NewWhatsAppMessage__e` platform event metadata.** Apex references `NewWhatsAppMessage__e`; it does not exist. Compile fails.
6. **No field for `Owner__c`.** `WhatsAppChatController.loadMessages` selects `Owner__c`; the object has standard `OwnerId`, not `Owner__c`. Runtime SOQL error.
7. **No indexes/external IDs on message IDs, phone numbers, media IDs.** Deduplication and matching will not scale.
8. **No `enableLicensing`/sharing strategy** documented for managed package use.

### 3.2 Apex

1. **`WhatsAppConfigUtil.isUserLicensed()` always returns `true`.** License enforcement is nonfunctional.
2. **`WhatsAppChatController.handleIncomingMessage` handles only:**
   - `entry[0]`, `changes[0]`, `messages[0]`, `statuses[0]`.
   - It ignores multiple entries/changes/messages/statuses in one payload.
   - It ignores media, interactive replies, location, contacts, reactions, flows, errors, system messages, template status updates, account/quality updates, and user preferences.
3. **No webhook signature verification.** `X-Hub-Signature-256` is not checked. Anyone who knows the URL can inject messages.
4. **No GET verification handler.** Meta's `hub.challenge` verification is not implemented.
5. **No idempotency.** Meta retries webhooks for up to 7 days; duplicates create duplicate messages.
6. **Guest-user execution is not designed.** The REST class inserts `WhatsAppMessage__c` directly; the Site guest user would need broad object permissions. Security review will reject.
7. **`routeToOmniChannel` is a placeholder** with commented-out code; `PendingServiceRouting` is not insertable via Apex anyway.
8. **Status mapping is Twilio-centric.** Field name `Twilio_Message_SID__c`; no normalized status model; no status history.
9. **`normalizePhone` assumes US (+1).** It breaks for international numbers.
10. **`processTwilioWebhook` does not validate Twilio signatures.**
11. **No callout retry/finalizer/queue.** Outbound sends happen synchronously in an Aura-enabled method; no retry, no rate-limit handling.
12. **No bulkification.** Sending to many recipients will hit callout limits.
13. **No `WITH USER_MODE` / `Security.stripInaccessible`.** Dynamic SOQL and DML do not enforce CRUD/FLS.
14. **Dynamic SOQL built from CMT object/field names** without describe validation; SOQL injection risk if a malicious admin edits mappings.
15. **No API logging/observability.** No `fbtrace_id`, request IDs, or error correlation.
16. **No tests.** 0% Apex coverage; production deployment requires 75%.
17. **`WhatsAppArchiveBatch` deletes messages without export, media cleanup, legal hold, or configurable retention.** It also has no tests.
18. **No support for multiple WABA phone numbers/accounts.**
19. **No template service, media service, consent service, conversation service, or routing service.**
20. **`WhatsAppInboxController` groups messages by parent record and truncates the record ID for the display name.** No unread counts, last message, search, filters, pagination, or real-time updates.

### 3.3 LWC chat widget (`whatsappChatWidget.js`, 1,012 lines)

The file is a merge-conflict-style accumulation of multiple versions. It is not production code.

**Duplicate declarations**

- `isChatOpen`, `currentContactId`, `messages`, `currentMessage`, `mediaUrl`, `contactName`, `contactInitials`, `isLoading`, `showLoadMoreButton`, `showNoMessages`, `showStartConversationButton`, `showMediaInput`, `hasUnreadMessages`, `unreadCount`, `offset`, `totalMessages`, `messageIds`, `lastMessageTimestamp` are declared two or three times.
- `connectedCallback` is defined twice (a method and an arrow class field). The arrow field wins; the method is dead.
- `disconnectedCallback` is defined twice.
- `subscribeToMessageEvents` is defined twice.
- `unsubscribeFromMessageEvents` is defined twice.
- `handleSubscriptionError` is defined twice.
- `handleNewMessage` is defined twice.

**Broken record handling**

- `@api recordId;` at line 13 and `@api set recordId(value)` at line 288. The class field shadows the accessor; the setter never runs. When the inbox changes `record-id={selectedRecordId}`, the widget does not reload the conversation.

**Missing imports / handlers**

- `handleStartConversation` calls `sendTemplateMessage(...)` — not imported.
- `fetchContactDetails` calls `getContactDetails(...)` — not imported.
- HTML references `handleMediaFileChange` — not defined.
- `loadLatestMessages` calls `loadMessages({ contactId: currentContactId })`; Apex expects `recordId` and `objectApiName`. Real-time refresh never loads anything.

**Security / LWC anti-patterns**

- `lwc:dom="manual"` + `document.createElement` + `innerHTML` in `renderMessages` (lines 831–940). This is an XSS/security-review flag and an LWC anti-pattern.
- 18 occurrences of `innerHTML` / `lwc:dom` / `document.createElement`.
- No `lightning-formatted-text`/template iteration; manual DOM bypasses LWC sanitization.

**UX / correctness**

- `recordName` is always `"WhatsApp Conversation"`; no record name.
- `recordInitials` is always `"WA"`.
- `MESSAGES_PER_LOAD`, `offset`, `totalMessages` are unused; `loadMoreMessages` reloads all messages.
- `@track` on a `Set` (`messageIds`) does not track `.add()` mutations.
- No file upload; only a media URL text input (not implemented in HTML).
- No template picker; hardcoded `hello_world` template in dead code.
- No retry/resend for failed messages.
- No message types other than text/image/video/audio/PDF.
- No consent/opt-out UI.
- No accessibility: icon-only buttons lack `aria-label`, no focus management, no `aria-live` for new messages, no keyboard navigation.
- Fixed 350×550 px window; not responsive; `:host { position: fixed; }` prevents inline/console use and breaks the inbox embedding.
- Hardcoded `en-US`, `hour12: true`; no i18n/timezone strategy.
- Status icon mapping is incomplete (no `failed`, `queued`, `deleted`, `undelivered`, `received`).
- No optimistic reconciliation by WAMID; duplicates possible if the webhook arrives before the Apex response.

### 3.4 Other LWC

- `whatsappAdminDashboard` — UI shell only. Save dispatches a custom event nobody handles. No Apex, no persistence, no test connection, no mappings/templates/archive settings.
- `whatsappGlobalNotification` — UI shell only. No `empApi`, no `platformUtilityBarApi`, no navigation, no subscription. `addNotification()` is never called.
- `whatsappInbox` — UI shell only. No real-time updates, search, filters, unread counts, pagination, or record names. Embeds the fixed-position chat widget, so the right pane will be covered by the floating widget.
- `utilityService.js` — unused; has a `.js-meta.xml`, which is invalid for a service module.

### 3.5 Metadata / package gaps

- No `PermissionSet` for admins, agents, integration users, or template managers.
- No `CustomPermission` feature gates.
- No `NamedCredential` / `RemoteSiteSetting` / `CspTrustedSite`.
- No `PlatformEvent` metadata.
- No `CustomNotificationType`.
- No `CustomLabel` / translations.
- No `CustomTab`, `CustomApplication`, `FlexiPage`, `ListView`, or record page templates.
- No `CustomSite` / Site configuration. Webhook cannot be exposed.
- No `PlatformEventSubscriberConfig` (run-as user for webhook processing).
- No `StaticResource` for icons.
- No `manifest/package.xml`.
- No `sfdx-project.json` 2GP package aliases, dependencies, or namespace.
- No `.gitignore` (the root `.gitignore` is UTF-16 encoded and malformed).
- No `README` setup guide, `CHANGELOG`, `SECURITY`, or `LICENSE`.
- No CI/CD.
- No API version strategy; `sfdx-project.json` is 64.0, LWCs range from 58.0 to 64.0.
- No `sourceApiVersion` alignment or Graph API version strategy (hardcoded `v17.0`; current Meta docs examples use v27.0 as of Nov 2026).

### 3.6 Git / supply chain

- `node_modules` was committed historically (13.8 MiB pack). It is not in the current tree but is in history.
- No `.env` file was ever tracked, and no live-looking Meta/Twilio tokens were found in history. Still, run a secret scan before publishing.
- The root `.gitignore` is UTF-16 and only ignores `.env`; add proper ignores.

---

## 4. What is worth keeping

Keep the **product ideas**, not the implementation:

1. Record-level WhatsApp chat (floating or inline).
2. Full-page WhatsApp Inbox (two-pane).
3. Utility bar notifications / unread badges.
4. 24-hour customer service window + countdown + template fallback.
5. Opt-out/consent blocking.
6. Media messages (image/audio/video/document).
7. Template messages.
8. Admin setup wizard.
9. Phone matching across Lead/Contact/Account/custom objects.
10. Message status ticks.
11. Retention/archive concept.
12. WhatsApp-inspired visual language (green bubbles, date separators, checkmarks) — but rebuilt with SLDS tokens, accessibility, and responsive layout.
13. The `WhatsAppMessage__c` idea and polymorphic parent linking — redesigned.

Do **not** keep:

- The Node middleware, Socket.IO static resource, localhost `fetch` calls, Mongo models.
- The 1,012-line chat widget as-is.
- Protected CMT for editable settings/secrets.
- Hub telemetry / heartbeat lock (contradicts no-backend and LMA).
- Hardcoded Twilio templates/credentials.
- `innerHTML`/manual DOM rendering.
- US-only phone normalization.
- Message-owner-based sharing.

---

## 5. Target architecture — 100% Salesforce-native

### 5.1 High-level diagram

```
┌──────────────────────────────┐
│ WhatsApp user                │
└──────────────┬───────────────┘
               │ WhatsApp
┌──────────────▼───────────────┐
│ Meta WhatsApp Business       │
│ Platform (Cloud API)         │
│  - Graph API (outbound)      │
│  - Webhooks (inbound)        │
└───────┬───────────────┬──────┘
        │ HTTPS POST    │ HTTPS POST
        │ webhook       │ Graph API
┌───────▼───────────────▼──────────────────────────────┐
│ Customer Salesforce org                              │
│                                                      │
│  Salesforce Site (public HTTPS)                      │
│   └─ Apex REST /services/apexrest/whatsapp/webhook   │
│       ├─ GET  verify challenge                       │
│       └─ POST verify HMAC → insert staging record    │
│                                                      │
│  Staging: WhatsApp_Webhook_Event__c (guest create)   │
│       └─ Trigger → Queueable/Platform Event          │
│                                                      │
│  Processing services (without sharing):              │
│   ├─ parse payload, dedupe by WAMID                  │
│   ├─ upsert Profile / Conversation                   │
│   ├─ insert Message / Status / Media                 │
│   ├─ match Lead/Contact/Account/custom               │
│   ├─ download media to Salesforce Files              │
│   └─ publish WhatsApp_Event__e                       │
│                                                      │
│  Storage:                                            │
│   WhatsApp_Account__c, WhatsApp_Profile__c,          │
│   WhatsApp_Conversation__c, WhatsApp_Message__c,     │
│   WhatsApp_Message_Status__c, WhatsApp_Media__c,     │
│   WhatsApp_Template__c, WhatsApp_Consent__c,         │
│   WhatsApp_Object_Mapping__c, WhatsApp_API_Log__c,   │
│   WhatsApp_Outbound_Queue__c, WhatsApp_Webhook_Event__c │
│                                                      │
│  UI:                                                 │
│   LWC chat (record page) / Inbox (app page) /        │
│   Utility bar / Setup wizard / Template manager      │
│   + empApi subscription to WhatsApp_Event__e          │
│                                                      │
│  Outbound:                                           │
│   LWC → Apex service → Outbound Queue → Queueable    │
│   → Named Credential `callout:WhatsApp_Graph_API`    │
│   → Meta Graph API → status webhook → update UI       │
│                                                      │
│  Media:                                              │
│   Outbound: Salesforce File → ContentDistribution    │
│             short-lived public link → Meta fetches   │
│   Inbound:  Meta media URL → Apex (≤ heap limit)     │
│             → ContentVersion → ContentDocumentLink   │
└──────────────────────────────────────────────────────┘
```

### 5.2 Why this is still "no backend"

- The only public endpoint is a **Salesforce Site** served by Salesforce.
- All logic is Apex; all state is Salesforce objects/files.
- All scheduling is Salesforce Queueable/Batch/Scheduled Apex.
- All real-time is Salesforce Platform Events + empApi.
- All auth is Salesforce permission sets + Meta tokens stored in a private, admin-restricted `WhatsApp_Credential__c` object (Long Text Area; Custom Settings max out at 255 characters). Optional Shield Platform Encryption.
- No Node/Express/MongoDB/Heroku/Render/Cloud Function.

The **Meta app** is still external configuration (the customer's WhatsApp Business Platform assets). That is not a backend; it is the service being integrated.

### 5.3 Required Salesforce configuration (post-install)

These cannot be fully packaged and must be guided by the setup wizard:

1. **Create/activate a Salesforce Site** (or Experience Cloud site) with a public guest user.
2. Grant the guest profile:
   - Apex class access: the webhook REST class only.
   - Object: `WhatsApp_Webhook_Event__c` — **Create only** (no Read/Edit/Delete).
   - No CRM object access.
3. Set the Site URL in package settings; show the exact callback URL.
4. Configure Meta webhook:
   - Callback URL: `https://<site-domain>/services/apexrest/whatsapp/webhook`
   - Verify token: generated by the package / entered by admin.
   - Subscribe to fields: `messages`, `message_template_status_update`, `message_template_quality_update`, `template_category_update`, `phone_number_quality_update`, `account_update`, `business_capability_update`, `user_preferences`, and (optional) `calls`, `history`, `smb_message_echoes`.
5. Create/activate the Named Credential (packaged) and verify the endpoint.
6. Assign permission sets: Admin, Agent, Template Manager, Integration.
7. Configure the platform event trigger run-as user (integration user) for media/ownership, or use the default.
8. Configure routing: default queue/owner, case creation, Omni-Channel flow (optional).
9. Configure retention/archiving.
10. Run the setup health check.

### 5.4 Configuration storage strategy

| Data                                                                                  | Storage                                            | Why                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Meta token, app secret, verify token                                                  | **`WhatsApp_Credential__c` private custom object** | Long Text Area supports tokens >255 chars; admin-only permission set; Apex `without sharing` accessor; optional Shield encryption. Custom Settings cannot store >255 chars, and protected CMT cannot be DML'd from the admin UI. |
| Org-wide non-secret settings (API version, default country, feature flags, retention) | **Protected Hierarchy Custom Setting**             | Apex can DML it; subscribers cannot see it; Admin UI can write it.                                                                                                                                                               |
| WABA / phone number records                                                           | `WhatsApp_Account__c` custom object                | Multiple numbers/accounts; admin UI CRUD; reports.                                                                                                                                                                               |
| Object/field mappings                                                                 | `WhatsApp_Object_Mapping__c` custom object         | Admins must edit; CMT cannot be DML'd from UI.                                                                                                                                                                                   |
| Templates                                                                             | `WhatsApp_Template__c` custom object               | Synced from Meta; UI CRUD/status; reports.                                                                                                                                                                                       |
| Consent                                                                               | `WhatsApp_Consent__c` custom object                | Audit/history; per-channel opt-in.                                                                                                                                                                                               |
| Webhook raw events                                                                    | `WhatsApp_Webhook_Event__c` custom object          | Guest create-only; audit/retry.                                                                                                                                                                                                  |
| API logs                                                                              | `WhatsApp_API_Log__c` custom object                | Observability; retention.                                                                                                                                                                                                        |
| Outbound queue                                                                        | `WhatsApp_Outbound_Queue__c` custom object         | Retry/rate-limit/bulk.                                                                                                                                                                                                           |

**Do not** use protected CMT for anything the admin must edit. **Do not** use unprotected CMT for secrets.

### 5.5 Webhook design

**Apex REST class** `WhatsAppWebhookResource`:

- `@RestResource(urlMapping='/whatsapp/webhook/*')`
- `global without sharing` (because the guest user has no CRM access; the class only validates and stages).
- `@HttpGet`:
  - Read `hub.mode`, `hub.verify_token`, `hub.challenge`.
  - Constant-time compare with the configured verify token.
  - Return `hub.challenge` as `text/plain` with 200; otherwise 403.
  - Set `Cache-Control: no-store`.
- `@HttpPost`:
  - Read raw body (Blob) **before** JSON parsing.
  - Verify `X-Hub-Signature-256` = `sha256=<hex>` using `Crypto.generateMac('HmacSHA256', body, appSecret)`; constant-time compare.
  - Verify `object == 'whatsapp_business_account'`.
  - Verify `entry[].id` matches the configured Messaging account (if configured).
  - Verify `metadata.phone_number_id` matches a configured `WhatsApp_Account__c` (if present).
  - Reject payloads over the configured max size.
  - Insert one `WhatsApp_Webhook_Event__c` per entry/change (or one per payload) with:
    - `Dedupe_Key__c` unique (hash of WABA + field + message/status id + timestamp).
    - `Payload__c` (Long Text; typical payload is small; for >128 KB, store a ContentVersion or reject with a documented limit).
    - `Status__c = 'Received'`.
  - Return 200 immediately. If staging insert fails, return 500 so Meta retries.
  - Never return CRM data or error details to the caller.

**Processing**:

- A trigger on `WhatsApp_Webhook_Event__c` (after insert) enqueues `WhatsAppWebhookProcessQueueable`.
- The queueable (or platform event trigger) runs as a dedicated integration user where possible; it:
  - Re-reads the raw payload.
  - Parses all entries/changes/messages/statuses (not just `[0]`).
  - Upserts by external IDs (WAMID, status key, template ID, media ID).
  - Creates/updates profile, conversation, message, status history, media placeholder.
  - Matches CRM records by normalized phone/BSUID.
  - Applies opt-in/out keywords and `user_preferences`.
  - Publishes `WhatsApp_Event__e`.
  - Enqueues media download, notifications, routing.
  - Marks the staging record Processed/Failed with error.
- A scheduled retry job processes Failed/Received events older than N minutes.

**Why staging + async**:

- Meta requires a fast 200; Apex callouts (media download) and DML can be slow.
- Guest user gets minimal permissions (create-only staging).
- Retries/idempotency are explicit.
- Security review is easier to defend.

### 5.6 Outbound design

**LWC** → `WhatsAppChatController.sendMessage(...)`:

1. Check license + custom permission.
2. Check record access (`WITH USER_MODE` on the parent record).
3. Resolve phone number from mapping (E.164, default country, country-code field).
4. Check consent/opt-out.
5. Check 24-hour window for non-template messages.
6. Validate message type/length/media.
7. Insert `WhatsApp_Message__c` with status `Queued` (optimistic UI).
8. Insert `WhatsApp_Outbound_Queue__c` with idempotency key.
9. Enqueue `WhatsAppOutboundQueueable`.
10. Return message ID + status.

**Queueable**:

- Calls `WhatsAppGraphClient.sendMessage(...)` via Named Credential.
- Parses `messages[0].id` (WAMID) and updates the message.
- On retryable errors (429, 5xx, 131056 pair rate limit, 131057 maintenance), schedules a retry with backoff via Finalizer/queue record.
- On permanent errors, marks Failed with error code/message and notifies the agent.
- Publishes `WhatsApp_Event__e`.
- Logs to `WhatsApp_API_Log__c` with `fbtrace_id`.
- Never logs the access token or full payload with PII.

**Bulk/scheduled**:

- Use `WhatsApp_Outbound_Queue__c` + a scheduled dispatcher or Batch.
- Respect Meta throughput (default 80 msg/s per phone number) and pair rate limit (1 msg/6s per recipient).
- Chunk into Queueables; avoid 100-callout limit.

### 5.7 Real-time design

**Platform Event** `WhatsApp_Event__e`:

- `Event_Type__c` (Message/Status/Conversation/Notification/Template/Account)
- `Message_Id__c` (18)
- `Conversation_Id__c` (18)
- `Record_Id__c` (18)
- `Status__c` (20)
- `Unread_Count__c` (Number)
- `Occurred_At__c` (DateTime)

**LWC**:

- Subscribe with `lightning/empApi` to `/event/WhatsApp_Event__e`, replay ID `-1`.
- On event, if it matches the current `recordId`/`conversationId`, refresh messages/conversation (debounced 300 ms).
- Utility bar subscribes to all events for the current user; updates `lightning/platformUtilityBarApi` badge; clicking opens the inbox or record.
- Inbox subscribes; updates conversation list and active thread.
- Fallback: refresh on window focus and a 30–60s poll if empApi fails.

**Why not CDC**: Platform Events give a controlled payload, are packageable, and avoid exposing all field changes. CDC can be a later optimization if volume requires it.

### 5.8 Media design

**Outbound**:

1. LWC uses `lightning-file-upload` to upload to a `WhatsApp_Media__c` record (or a ContentVersion linked to the message).
2. Apex validates MIME/size.
3. Create a `ContentDistribution` with a short expiry (e.g., 1 hour).
4. Send the `DistributionPublicUrl` to Meta as the media `link`.
5. On status `sent`, delete the ContentDistribution (or let it expire).
6. Store the `ContentDocumentId` for in-app preview.

**Why**: Avoids Apex heap limits for large files; Meta fetches the file directly from Salesforce's content delivery domain. The link is short-lived and can be revoked.

**Inbound**:

1. Webhook contains media ID + MIME + caption/filename.
2. Processor inserts `WhatsApp_Media__c` status `Pending`.
3. Queueable:
   - `GET /{media-id}?phone_number_id=...` → `url` (valid 5 min), `mime_type`, `file_size`, `sha256`.
   - If `file_size` > configured max (e.g., 10 MB), mark `Too Large` and notify the agent.
   - Else `GET url` with Bearer token → Blob.
   - Insert `ContentVersion` + `ContentDocumentLink` to the message.
   - Update `WhatsApp_Media__c` status `Downloaded`.
4. LWC renders image/audio/video via Salesforce file URL; documents show a download card.

**Hard limits**:

- Apex sync heap 6 MB, async 12 MB.
- WhatsApp image max 5 MB → fits.
- Audio/video max 16 MB → only files under ~10–12 MB can be imported; larger must be handled as "too large".
- Document max 100 MB → only files under ~10–12 MB can be imported.
- Media IDs from webhooks expire in 7 days; URLs expire in 5 minutes. Download promptly.

### 5.9 Template design

- Sync all templates for the Messaging account:
  - `GET /{waba-id}/message_templates?fields=id,name,language,category,status,quality_score,components,rejected_reason,parameter_format&limit=100`
  - Follow `paging.next`.
  - Upsert by `Template_ID__c`.
- Store components JSON; parse into UI-friendly fields (header/body/footer/buttons).
- Create/edit/delete via API; status webhooks update `Status__c`, `Quality_Score__c`, `Rejection_Reason__c`.
- Send:
  - Build `template` payload from the selected template + variable values.
  - Support text/image/video/document headers, body variables, quick-reply/URL/phone buttons.
  - Add authentication, coupon, LTO, carousel, catalog templates in later phases.
- UI:
  - Template list with status/quality/category/language filters.
  - Template picker in the composer (only Approved templates).
  - Template builder (name, category, language, header, body, footer, buttons, preview).
  - Sync/test/delete actions with admin permission.

### 5.10 Routing / assignment design

**v1 (simple, reliable)**:

- On inbound message, if conversation has no owner:
  - Assign to `WhatsApp_Account__c.Default_Owner__c` or a queue.
  - Optionally create a Case/Lead per settings.
- Conversation list filters: Mine, Unassigned, All, Closed.
- Agent can claim/reassign/close.

**v2 (Service Cloud)**:

- Create/update a Case per conversation (or per inbound message, configurable).
- Use Case queue/assignment rules for routing.
- Add a `WhatsApp Conversation` related list/component on Case.
- Use Omni-Channel Flow "Route Work" (not direct `PendingServiceRouting` DML) for skills-based routing; this requires admin configuration and a Service Channel.
- SLA/milestones via Entitlements.

**v3 (advanced)**:

- Round-robin/capacity-based custom routing.
- Supervisor view, transfer, internal notes, collaboration.
- Agentforce/AI suggested replies.

### 5.11 Consent / compliance design

- `WhatsApp_Consent__c` per phone/BSUID:
  - `Opt_In_Status__c` (Unknown/Opted In/Opted Out)
  - `Marketing_Opt_In__c`
  - `Transactional_Opt_In__c`
  - `Opt_In_Source__c`, `Opt_In_Date__c`
  - `Opt_Out_Source__c`, `Opt_Out_Date__c`
  - `Proof__c` (text/URL/file)
  - `Record_Id__c`, `Object_API_Name__c`
- Inbound keywords:
  - STOP/UNSUBSCRIBE/OPTOUT/CANCEL/END/QUIT → opt out.
  - START/YES/UNSTOP → opt in (if configured).
  - Normalize case, punctuation, whitespace; support multiple languages.
  - Do not send marketing after opt-out; allow one confirmation if required by policy (configurable).
- Meta `user_preferences` webhook → update marketing preferences.
- UI:
  - Consent badge in the chat header.
  - Block composer when opted out.
  - Admin can override with reason (audit).
- 24-hour window:
  - `Conversation.Last_Inbound_At__c`, `Window_Expires_At__c`.
  - Server-side block for free-form; template fallback.
  - UI countdown; disabled composer; "Send Template" button.
  - Calling also resets the window (if/when calling is supported).
  - CTWA free entry point window is separate; track referral + FEP for analytics.

### 5.12 Security design

| Threat                   | Control                                                                                                                                                                           |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Forged webhook           | HMAC SHA-256 signature verification with app secret; constant-time compare; reject invalid.                                                                                       |
| Replay/duplicate         | Unique `WAMID__c`/`Dedupe_Key__c`; idempotent upserts; status precedence.                                                                                                         |
| Guest user data exposure | Guest profile only Apex class + create on staging; no CRM object access; no read/edit/delete.                                                                                     |
| SOQL injection           | Allowlist object/field names from `WhatsApp_Object_Mapping__c`; validate against describe; `Database.queryWithBinds`; no string concatenation of user input.                      |
| CRUD/FLS bypass          | `WITH USER_MODE` for user-facing queries; `Security.stripInaccessible` for DML; `without sharing` only in system services with explicit checks.                                   |
| XSS                      | No `innerHTML`; template iteration; `lightning-formatted-text`; URL allowlist; sanitize filenames.                                                                                |
| Open redirect            | Validate record IDs/URLs; use `NavigationMixin` with record IDs.                                                                                                                  |
| Secret leakage           | Private `WhatsApp_Credential__c` object; admin-only permission set; never log tokens/secrets; mask in UI; rotate; least-privilege System User; Shield encryption where available. |
| Token theft              | Named Credential/Protected Setting; Shield encryption if available; restrict admin access; monitor API logs.                                                                      |
| Excessive permissions    | Permission sets; custom permissions; least privilege; no `Modify All Data` for agents.                                                                                            |
| Data retention/PII       | Configurable retention; archive/export; delete media/files; Field Audit Trail/Shield; GDPR delete/export.                                                                         |
| Malicious files          | MIME/size validation; block executables; virus scanning is not native—document.                                                                                                   |
| API abuse                | Rate limits/queue; monitor 429/131056; backoff; alerting.                                                                                                                         |
| Package tampering        | Managed package; no hardcoded IDs/secrets; code review; code analyzer.                                                                                                            |

### 5.13 Observability

- `WhatsApp_API_Log__c`:
  - Correlation ID, operation, endpoint, method, status, duration, response code, error code/subcode, `fbtrace_id`, message/conversation, user.
  - Request/response bodies truncated and redacted (no tokens, mask phone/email).
- `WhatsApp_Webhook_Event__c`:
  - Raw payload, status, attempts, error, processed time.
- Health dashboard (LWC):
  - Last webhook received/processed, failures in 24h, queue depth, API error rate, media failures, token expiry, template sync status, account quality/throughput.
- Alerts:
  - Custom Notification to admins on repeated failures, token expiry, account restrictions, template rejection.
  - Optional email.
- Retention:
  - Auto-purge API logs/webhook events after N days (configurable).
  - Never log secrets.

### 5.14 Licensing

- Use **LMA (License Management App)** for AppExchange:
  - `UserInfo.isCurrentUserLicensed('namespace')` for current user.
  - Query `PackageLicense` for org status/expiration/allowed/used licenses.
  - Query `UserPackageLicense` (or custom permission assignments) for seat checks.
- Use **Custom Permissions** for features:
  - `WhatsApp_Admin`
  - `WhatsApp_Agent`
  - `WhatsApp_Template_Manager`
  - `WhatsApp_Analytics_Viewer`
  - `WhatsApp_Bulk_Send`
- No hub telemetry/heartbeat. If you need trial/expiry, use LMA trial licenses and `PackageLicense.ExpirationDate`; no external service.
- If usage-based billing/telemetry is required, that needs a backend or a Salesforce add-on; out of scope for "no backend".

### 5.15 Package strategy

| Option                   | Use when                              | Pros                                        | Cons                                                     |
| ------------------------ | ------------------------------------- | ------------------------------------------- | -------------------------------------------------------- |
| **2GP Managed Package**  | AppExchange / commercial distribution | IP protection, LMA, upgrade path, namespace | Security review, packaging constraints, slower iteration |
| **2GP Unlocked Package** | Single customer / internal            | Fast, source visible, easy CI               | No IP protection, no LMA, customer can modify            |
| **1GP Managed**          | Legacy partner                        | Mature LMA                                  | Older tooling; 2GP preferred                             |

Recommendation: **2GP Managed Package** with a namespace (e.g., `wapp`), a Dev Hub, and an LMO for LMA. Use unlocked for internal dev/demo only.

---

## 6. WABA capability coverage matrix

Legend:

- **Native** = feasible in Apex/LWC without a backend.
- **Native + Site** = feasible with Salesforce Site webhook.
- **Limited** = feasible with documented limits.
- **Partner/External** = requires a Meta partner/tech provider or external media/telephony service.
- **Out of scope v1** = roadmap later.

### 6.1 Messaging

| Capability                 | API/Webhook                  | Feasibility | Phase | Notes                                                                           |
| -------------------------- | ---------------------------- | ----------- | ----- | ------------------------------------------------------------------------------- |
| Text messages              | `POST /messages` type `text` | Native      | 1     | 4,096-char limit; link preview flag.                                            |
| Image                      | type `image`                 | Native      | 2     | Max 5 MB; caption 1,024 chars.                                                  |
| Audio                      | type `audio`                 | Limited     | 2     | Max 16 MB; inbound >~12 MB cannot be stored.                                    |
| Video                      | type `video`                 | Limited     | 2     | Max 16 MB; H.264/AAC; inbound >~12 MB cannot be stored.                         |
| Document                   | type `document`              | Limited     | 2     | Max 100 MB; inbound >~12 MB cannot be stored; outbound via ContentDistribution. |
| Sticker                    | type `sticker`               | Native      | 3     | WebP 100 KB static / 500 KB animated.                                           |
| Location                   | type `location`              | Native      | 2     | Lat/long/name/address.                                                          |
| Contacts                   | type `contacts`              | Native      | 2     | vCard payload.                                                                  |
| Interactive reply buttons  | type `interactive`           | Native      | 2     | Up to 3 buttons.                                                                |
| Interactive list           | type `interactive`           | Native      | 2     | Up to 10 sections/rows.                                                         |
| Interactive media carousel | type `interactive`           | Native      | 3     | Cards with media/buttons.                                                       |
| Reaction                   | type `reaction`              | Native      | 2     | Send/receive emoji reactions.                                                   |
| Contextual reply           | `context.message_id`         | Native      | 2     | Quote/reply rendering.                                                          |
| Mark as read               | `status: read`               | Native      | 2     | Blue ticks for customer.                                                        |
| Typing indicator           | `typing_indicator`           | Native      | 3     | Verify current API payload.                                                     |
| Link preview               | `text.preview_url`           | Native      | 1     | Toggle per message.                                                             |
| Message edit/revoke events | webhook `edit`/`revoke`      | Limited     | 3     | Receive/render; business-side edit may not be available.                        |
| System messages            | webhook `system`             | Native      | 3     | Number change, etc.                                                             |
| Unsupported messages       | webhook `unsupported`        | Native      | 3     | Render a placeholder.                                                           |
| Errors                     | webhook `errors`             | Native      | 1     | Map error codes; notify.                                                        |
| Groups                     | Groups API/webhooks          | Native      | 4     | Requires group setup; message/participant management.                           |
| Address messages           | type `address`               | Native      | 3     | Newer type; verify API.                                                         |
| Location request           | interactive                  | Native      | 3     | Request customer location.                                                      |

### 6.2 Templates

| Capability                      | Feasibility   | Phase | Notes                                                |
| ------------------------------- | ------------- | ----- | ---------------------------------------------------- |
| Sync/list templates             | Native        | 2     | Pagination; store components JSON.                   |
| Create template                 | Native        | 2     | Name/category/language/components; approval by Meta. |
| Edit template                   | Native        | 3     | Limited by Meta rules.                               |
| Delete/archive template         | Native        | 2     | Confirm; Meta rules.                                 |
| Template status webhooks        | Native + Site | 2     | Approved/Rejected/Paused/Disabled.                   |
| Quality score webhooks          | Native + Site | 2     | Update template quality.                             |
| Category updates                | Native + Site | 2     | Update category.                                     |
| Media headers                   | Native        | 2     | Upload media; header handle.                         |
| Buttons (quick reply/URL/phone) | Native        | 2     | Build components.                                    |
| Authentication templates        | Native        | 3     | Copy code/one-tap/zero-tap; security review.         |
| Coupon codes                    | Native        | 3     | Template components.                                 |
| Limited-time offer              | Native        | 3     | Template components.                                 |
| Carousel templates              | Native        | 3     | Media cards.                                         |
| Catalog/product templates       | Native        | 4     | Commerce eligibility.                                |
| Template library/import         | Native        | 3     | JSON import.                                         |

### 6.3 Media

| Capability                | Feasibility | Phase | Notes                                                                     |
| ------------------------- | ----------- | ----- | ------------------------------------------------------------------------- |
| Upload media              | Native      | 2     | Multipart; ≤12 MB Apex heap; use ContentDistribution for larger outbound. |
| Get media URL             | Native      | 2     | URL valid 5 min; media ID 7 days inbound.                                 |
| Download media            | Limited     | 2     | ≤~12 MB; larger cannot be stored.                                         |
| Delete media              | Native      | 2     | Cleanup.                                                                  |
| ContentDistribution links | Native      | 2     | Short-lived public link for outbound.                                     |
| In-app preview            | Native      | 2     | Salesforce file URL; images/audio/video; PDFs as download.                |
| Media retention/cleanup   | Native      | 2     | Batch/scheduled.                                                          |

### 6.4 Accounts / phone numbers

| Capability                                        | Feasibility      | Phase | Notes                                                             |
| ------------------------------------------------- | ---------------- | ----- | ----------------------------------------------------------------- |
| WhatsApp account (WAAC) / Messaging account       | Native           | 1     | Store IDs; one or many.                                           |
| Phone number list/status                          | Native           | 1     | `GET /{waba-id}/phone_numbers`.                                   |
| Phone number registration                         | Native           | 4     | `POST /{phone-number-id}/register`; 2FA.                          |
| Two-step verification                             | Native           | 4     | Set/verify PIN.                                                   |
| Business profile                                  | Native           | 3     | Get/update about/address/email/websites/vertical/profile picture. |
| Display name / OBA status                         | Native           | 3     | Read/update where allowed; approval by Meta.                      |
| Quality rating / throughput                       | Native + Site    | 2     | Webhooks `phone_number_quality_update`, `account_alerts`.         |
| Messaging limits                                  | Native + Site    | 2     | `account_alerts`, `business_capability_update`.                   |
| Conversational components (ice breakers/commands) | Native           | 3     | `POST /{phone-number-id}/conversational_automation`.              |
| QR codes / message links                          | Native           | 3     | Generate/manage.                                                  |
| Official Business Account                         | Native/read-only | 3     | Status from API/webhooks.                                         |

### 6.5 Webhooks

| Field                                | Feasibility   | Phase | Notes                                          |
| ------------------------------------ | ------------- | ----- | ---------------------------------------------- |
| `messages`                           | Native + Site | 1     | Text/status/media/interactive/etc.             |
| `message_template_status_update`     | Native + Site | 2     | Update template.                               |
| `message_template_quality_update`    | Native + Site | 2     | Update quality.                                |
| `message_template_components_update` | Native + Site | 3     | Update components.                             |
| `template_category_update`           | Native + Site | 2     | Update category.                               |
| `phone_number_quality_update`        | Native + Site | 2     | Update account.                                |
| `account_update`                     | Native + Site | 2     | Violations/offboarding.                        |
| `account_alerts`                     | Native + Site | 2     | Limits/profile/OBA.                            |
| `business_capability_update`         | Native + Site | 2     | Limits/capabilities.                           |
| `user_preferences`                   | Native + Site | 2     | Marketing opt-out.                             |
| `calls`                              | Native + Site | 4     | Log call events; actual calls need WebRTC/SIP. |
| `history`                            | Native + Site | 4     | Coexistence history sync.                      |
| `smb_app_state_sync`                 | Native + Site | 4     | Coexistence contacts.                          |
| `smb_message_echoes`                 | Native + Site | 4     | Coexistence messages.                          |
| `security`                           | Native + Site | 3     | Security settings changes.                     |
| `payment_configuration_update`       | Native + Site | 4     | Payments.                                      |
| `partner_solutions`                  | Native + Site | 4     | Multi-partner.                                 |

### 6.6 Analytics / commerce / advanced

| Capability                       | Feasibility      | Phase | Notes                                                    |
| -------------------------------- | ---------------- | ----- | -------------------------------------------------------- |
| Messaging analytics              | Native           | 3     | Business Management API; snapshots.                      |
| Pricing analytics                | Native           | 3     | Per-message costs; store snapshots.                      |
| Template analytics               | Native           | 3     | Sent/delivered/read/button clicks.                       |
| Conversation analytics           | Native           | 3     | Deprecated conversation-based pricing; still useful.     |
| CTWA referral / ad attribution   | Native           | 3     | Inbound `referral`; store ad/click IDs.                  |
| Free entry point window          | Native           | 3     | Track for pricing.                                       |
| Catalogs / product messages      | Native           | 4     | Commerce eligibility; product sync.                      |
| Orders                           | Native           | 4     | Inbound order payloads.                                  |
| Payments (India/Brazil/Mexico)   | Partner/External | 4     | Payment gateway; compliance; out of scope.               |
| WhatsApp Flows                   | Native           | 3     | Send existing flows; receive `nfm_reply`; builder later. |
| Calling (voice/video)            | Partner/External | 4     | WebRTC/SIP media stack; Apex/LWC cannot carry media.     |
| Marketing Messages API           | Native           | 4     | Separate onboarding/eligibility; max price.              |
| Direct Send                      | Native           | 4     | New API; verify account eligibility.                     |
| Coexistence                      | Partner/External | 4     | Embedded Signup/Tech Provider; history/smb webhooks.     |
| Embedded Signup                  | Partner/External | 4     | FB JS SDK + Apex token exchange; Tech Provider.          |
| Meta Business Agent              | Partner/External | 4     | Meta-hosted; configure/observe only.                     |
| Conversation Routing             | Partner/External | 4     | Multi-partner routing.                                   |
| Business-scoped user IDs (BSUID) | Native + Site    | 1     | Phone may be omitted; identity model must handle.        |
| Usernames                        | Native + Site    | 2     | Profile username.                                        |
| Block/unblock users              | Native           | 3     | `block_users` API.                                       |
| Opt-in/opt-out                   | Native           | 1     | Keywords + consent object.                               |
| Data privacy/delete              | Native           | 3     | Retention/export/delete.                                 |

---

## 7. Target data model

### 7.1 Configuration

**`WhatsApp_Settings__c` (Protected Hierarchy Custom Setting)**

Org-wide, non-secret configuration. Apex-DML-able, hidden from subscribers.

- Webhook: `Site_URL__c`, `Webhook_Path__c`, `Enforce_Signature__c`, `Max_Payload_KB__c`.
- CRM: `Default_Country_Code__c`, `Auto_Create_Lead__c`, `Auto_Create_Contact__c`, `Auto_Create_Case__c`, `Default_Lead_Owner__c`, `Default_Queue_Id__c`, `Case_Record_Type_Id__c`.
- Behavior: `Enable_Read_Receipts__c`, `Enable_Typing_Indicators__c`, `Enable_Marketing_Opt_In__c`, `Opt_Out_Keywords__c`, `Opt_In_Keywords__c`, `Enable_Notifications__c`, `Notification_Type__c`.
- Media: `Max_Inbound_Media_MB__c`, `Content_Distribution_Expiry_Hours__c`, `Delete_Distribution_After_Send__c`.
- Retention: `Message_Retention_Days__c`, `Media_Retention_Days__c`, `Log_Retention_Days__c`, `Archive_Enabled__c`, `Legal_Hold__c`.
- Advanced: `Enable_Flows__c`, `Enable_Catalogs__c`, `Enable_Groups__c`, `Enable_Calling_Events__c`, `Enable_Coexistence__c`.
- Operations: `Integration_User_Id__c`, `Setup_Status__c`, `Last_Health_Check__c`.

**`WhatsApp_Credential__c` (private custom object)**

Provider credentials and account identifiers. OWD Private; only the `WhatsApp_Admin` permission set has access. Long Text Area fields are required because Custom Settings are limited to 255 characters and protected CMT cannot be DML'd from an admin UI.

- `Label__c`, `Provider__c`, `App_Id__c`, `Messaging_Account_Id__c`, `Phone_Number_Id__c`
- `Access_Token__c` (Long Text Area), `App_Secret__c` (Long Text Area), `Verify_Token__c`, `Token_Expiry__c`
- `Is_Active__c`, `Last_Tested__c`, `Setup_Status__c`, `Notes__c`
- Optional Shield Platform Encryption; never log; mask in UI; rotate.

### 7.2 Core objects

| Object                            | Purpose                                      | Key fields                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `WhatsApp_Credential__c`          | Provider credentials/account identifiers     | `Label__c`, `Provider__c`, `App_Id__c`, `Messaging_Account_Id__c`, `Phone_Number_Id__c`, `Access_Token__c`, `App_Secret__c`, `Verify_Token__c`, `Token_Expiry__c`, `Is_Active__c`, `Last_Tested__c`, `Setup_Status__c`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `WhatsApp_Account__c`             | One record per WhatsApp account/phone number | `Messaging_Account_Id__c`, `WhatsApp_Account_Id__c`, `Phone_Number_Id__c`, `Display_Phone_Number__c`, `Verified_Name__c`, `Quality_Rating__c`, `Throughput_Level__c`, `Messaging_Limit__c`, `Status__c`, `Is_Default__c`, `Timezone__c`, `Currency__c`, `Last_Sync__c`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `WhatsApp_Profile__c`             | WhatsApp identity (phone/BSUID/username)     | `Wa_Id__c` (external ID, unique), `BSUID__c` (external ID, unique), `Username__c`, `Profile_Name__c`, `Phone__c`, `Parent_Record_Id__c`, `Parent_Object_API_Name__c`, `First_Seen__c`, `Last_Seen__c`, `Blocked__c`, `Source__c`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `WhatsApp_Conversation__c`        | Thread                                       | `Conversation_Key__c` (unique), `Account__c`, `Profile__c`, `Parent_Record_Id__c`, `Parent_Object_API_Name__c`, `Assigned_User__c`, `Assigned_Queue__c`, `Status__c`, `Last_Inbound_At__c`, `Window_Expires_At__c`, `Last_Message_At__c`, `Last_Message_Preview__c`, `Unread_Count__c`, `Message_Count__c`, `Case__c`, `Priority__c`, `SLA_Due_At__c`, `Closed_At__c`, `Close_Reason__c`, `CTWA_Ad_Id__c`, `CTWA_Click_Id__c`, `Is_Group__c`, `Group_Id__c`                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `WhatsApp_Message__c`             | Individual message                           | `WAMID__c` (external ID, unique), `Conversation__c`, `Account__c`, `Direction__c`, `Sender_Type__c`, `Sent_By__c` (User), `From_Number__c`, `To_Number__c`, `Type__c`, `Body__c`, `Caption__c`, `Media__c`, `Template__c`, `Reply_To_WAMID__c`, `Reply_To_Message__c`, `Context_JSON__c`, `Interactive_JSON__c`, `Location_JSON__c`, `Contacts_JSON__c`, `Reaction_Emoji__c`, `Reaction_Target_WAMID__c`, `Status__c`, `Status_Updated_At__c`, `Sent_At__c`, `Delivered_At__c`, `Read_At__c`, `Failed_At__c`, `Error_Code__c`, `Error_Title__c`, `Error_Message__c`, `Pricing_Category__c`, `Pricing_Type__c`, `Pricing_Billable__c`, `Pricing_Model__c`, `Is_Forwarded__c`, `Forwarding_Score__c`, `Is_Deleted__c`, `Is_Edited__c`, `Is_View_Once__c`, `Language__c`, `Template_Name__c`, `Template_Language__c`, `Template_Variables_JSON__c`, `Provider__c`, `Source__c` |
| `WhatsApp_Message_Status__c`      | Status history                               | `Message__c`, `Status__c`, `Timestamp__c`, `Recipient_Id__c`, `Error_Code__c`, `Error_Message__c`, `Pricing_Category__c`, `Pricing_Type__c`, `Pricing_Billable__c`, `Raw_JSON__c`, `Dedupe_Key__c` (unique)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `WhatsApp_Media__c`               | Media metadata/file link                     | `Meta_Media_Id__c` (unique), `Message__c`, `Direction__c`, `Mime_Type__c`, `File_Name__c`, `File_Size__c`, `SHA256__c`, `Content_Version_Id__c`, `Content_Document_Id__c`, `Download_Status__c`, `Download_Attempts__c`, `Last_Error__c`, `Expires_At__c`, `Content_Distribution_Id__c`, `Public_Url__c`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `WhatsApp_Template__c`            | Synced/created templates                     | `Template_Id__c` (unique), `Account__c`, `Name__c`, `Language__c`, `Category__c`, `Status__c`, `Quality_Score__c`, `Components_JSON__c`, `Header_Type__c`, `Header_Text__c`, `Body_Text__c`, `Footer_Text__c`, `Buttons_JSON__c`, `Variable_Count__c`, `Rejection_Reason__c`, `Last_Synced__c`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `WhatsApp_Consent__c`             | Opt-in/out audit                             | `Wa_Id__c`, `BSUID__c`, `Phone__c`, `Record_Id__c`, `Object_API_Name__c`, `Opt_In_Status__c`, `Marketing_Opt_In__c`, `Transactional_Opt_In__c`, `Opt_In_Source__c`, `Opt_In_Date__c`, `Opt_Out_Source__c`, `Opt_Out_Date__c`, `Proof__c`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `WhatsApp_Object_Mapping__c`      | Object/field mapping                         | `Object_API_Name__c`, `Phone_Field__c`, `Country_Code_Field__c`, `Phone_Field_Label__c`, `Record_Name_Field__c`, `Priority__c`, `Is_Active__c`, `Create_If_Missing__c`, `Default_Owner__c`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `WhatsApp_Webhook_Event__c`       | Raw webhook staging/audit                    | `Event_Type__c`, `Field__c`, `WABA_Id__c`, `Phone_Number_Id__c`, `Dedupe_Key__c` (unique), `Payload__c`, `Status__c`, `Error__c`, `Attempts__c`, `Received_At__c`, `Processed_At__c`, `Signature_Valid__c`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `WhatsApp_API_Log__c`             | API observability                            | `Correlation_Id__c`, `Operation__c`, `Endpoint__c`, `Method__c`, `Status_Code__c`, `Duration_Ms__c`, `Request_Body__c`, `Response_Body__c`, `Error_Code__c`, `Error_Subcode__c`, `FBTrace_Id__c`, `Message__c`, `User__c`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `WhatsApp_Outbound_Queue__c`      | Durable outbound queue                       | `Message__c`, `Status__c`, `Attempts__c`, `Next_Attempt_At__c`, `Last_Error__c`, `Priority__c`, `Scheduled_At__c`, `Idempotency_Key__c` (unique)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `WhatsApp_Conversation_Member__c` | Per-user read/assignment                     | `Conversation__c`, `User__c`, `Role__c`, `Last_Read_At__c`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

### 7.3 Design notes

- **Polymorphic linking**: `Parent_Record_Id__c` (18) + `Parent_Object_API_Name__c` (255) allows any object. Validate object/field names via describe; never trust client input.
- **Profile vs CRM record**: a WhatsApp identity can exist before a Lead/Contact; use `WhatsApp_Profile__c` as the stable identity, link to CRM when matched. This avoids duplicate profiles and supports BSUID-only users.
- **Conversation as the sharing/assignment anchor**: messages belong to conversations; access is checked against the parent record/conversation, not message owner.
- **Per-user read state**: `WhatsApp_Conversation_Member__c.Last_Read_At__c`; unread count is computed or denormalized. Do not use a single `Is_Read__c` for a shared inbox.
- **Status history**: one row per status transition, unique by message+status+timestamp; update message current status only if the new status is "higher" (queued < sent < delivered < read; failed can override).
- **External IDs**: `WAMID__c`, `Meta_Media_Id__c`, `Template_Id__c`, `Dedupe_Key__c`, `Idempotency_Key__c` are unique external IDs for idempotency.
- **Long text**: `Body__c` 131,072; `Payload__c` 131,072; `Components_JSON__c` 131,072. For larger raw payloads, use a ContentVersion or document the limit.
- **No hardcoded IDs**; all queues/owners/record types configurable.
- **No `Owner__c` custom field**; use standard `OwnerId`.

---

## 8. Target UI/UX

### 8.1 Components

| Component                  | Target         | Notes                                                                                      |
| -------------------------- | -------------- | ------------------------------------------------------------------------------------------ |
| `whatsappChat`             | Record page    | Modes: `launcher` (floating bubble), `inline` (panel), `console` (side panel). Responsive. |
| `whatsappInbox`            | App page / tab | Two-pane; conversation list + active chat; search/filters; unread; real-time.              |
| `whatsappUtilityBar`       | Utility bar    | Unread badge; recent notifications; open inbox/record; `platformUtilityBarApi`.            |
| `whatsappSetup`            | App page / tab | Setup wizard; connection test; webhook; mappings; routing; retention; health.              |
| `whatsappTemplates`        | App page / tab | Template list/detail/builder; sync; status; preview.                                       |
| `whatsappComposer`         | Child          | Text, emoji, attach, template, interactive, location, contact, reaction.                   |
| `whatsappMessage`          | Child          | Renders each type; status ticks; reply; media; errors.                                     |
| `whatsappTemplatePicker`   | Child/modal    | Approved templates; variable input; preview.                                               |
| `whatsappConsentBadge`     | Child          | Opt-in/out status; window timer.                                                           |
| `whatsappMediaPreview`     | Child          | Image/audio/video/PDF card.                                                                |
| `whatsappDiagnostics`      | Child          | Health checks; logs; retry.                                                                |
| `whatsappConversationList` | Child          | List item; avatar; name; preview; time; unread; channel.                                   |

### 8.2 UX principles

- **SLDS-first**, WhatsApp-inspired: use SLDS tokens, spacing, typography; green accent only for WhatsApp actions; dark mode support via styling hooks.
- **Responsive**: 320px mobile → full-screen; tablet → two-pane; desktop → sidebar/floating.
- **Accessible**: WCAG 2.1 AA; `aria-label` on icon buttons; focus trap in modals; `aria-live="polite"` for new messages; keyboard send (Enter, Shift+Enter newline); visible focus; color contrast; alt text; screen-reader labels for status ticks.
- **No `innerHTML`/manual DOM**: use `lwc:if`/`for:each`/template components.
- **i18n**: Custom Labels; `Intl.DateTimeFormat`; user locale/timezone; RTL support.
- **Mobile**: Salesforce Mobile app; touch targets ≥44px; safe-area insets; no hover-only actions.
- **Error states**: clear, actionable; retry; don't leak stack traces.
- **Empty states**: no messages, no conversation selected, no templates, setup incomplete.
- **Loading**: skeletons/spinners; optimistic sends; disable while sending.
- **Performance**: paginate messages (cursor by timestamp+Id), lazy media, debounce events, avoid loading all conversations.

### 8.3 Message rendering

- Text: preserve line breaks; linkify URLs safely (use `lightning-formatted-rich-text`? Avoid HTML injection; build link segments or use `lightning-formatted-url` per link).
- Media: image/video/audio/PDF/file card; caption; download.
- Template: header/body/footer/buttons; show template name/category.
- Interactive: buttons/list/carousel; show selected response.
- Location: map link; coordinates.
- Contacts: vCard card/download.
- Reaction: emoji badge on target message; reaction picker.
- Reply: quoted context above the bubble.
- System: centered gray text.
- Unsupported: "Unsupported message type" with raw JSON (admin only).
- Status ticks: queued (clock), sent (single check), delivered (double check), read (blue double check), failed (!), deleted (trash).
- Date separators: Today/Yesterday/date; localized.
- Sender name/avatar for group/team; agent name for outbound.
- Unread divider.

### 8.4 Composer

- Text area auto-grow; 4,096-char counter.
- Emoji picker (optional; can use native emoji input).
- Attach: image/audio/video/document; validate MIME/size before upload; progress.
- Template: opens picker; disabled unless approved; shows variable inputs; preview.
- Interactive: buttons/list builder (admin/agent with permission).
- Location: map picker or lat/long input.
- Contact: select Salesforce Contact; build vCard.
- Reaction: picker on a message.
- Reply: quote.
- Send: Enter; Shift+Enter newline.
- 24h window closed: disable text/attach; show "Send Template".
- Opt-out: disable all outbound; show consent badge.
- Offline/error: queue and retry; show failed state.

---

## 9. Apex architecture

### 9.1 Layering

```
UI Controllers (@AuraEnabled)
  ├─ WhatsAppChatController
  ├─ WhatsAppInboxController
  ├─ WhatsAppAdminController
  └─ WhatsAppTemplateController
        ↓
Domain Services
  ├─ WhatsAppConversationService
  ├─ WhatsAppMessageService
  ├─ WhatsAppOutboundService
  ├─ WhatsAppTemplateService
  ├─ WhatsAppMediaService
  ├─ WhatsAppConsentService
  ├─ WhatsAppRoutingService
  └─ WhatsAppAnalyticsService
        ↓
Integration
  ├─ WhatsAppGraphClient
  ├─ WhatsAppWebhookResource
  ├─ WhatsAppWebhookProcessor
  └─ WhatsAppOutboundQueueable
        ↓
Data
  ├─ WhatsAppSelector
  ├─ WhatsAppSettingsService
  └─ WhatsAppSecurity
```

### 9.2 Key classes

| Class                             | Responsibility                                                                                              |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `WhatsAppGraphClient`             | HTTP GET/POST/DELETE/multipart; Named Credential; token; version; timeout; retry; error parsing; API log.   |
| `WhatsAppWebhookResource`         | `@RestResource`; GET challenge; POST HMAC + staging; 200 fast.                                              |
| `WhatsAppWebhookProcessor`        | Parse all payload shapes; idempotent upserts; publish events; enqueue media/routing.                        |
| `WhatsAppWebhookProcessQueueable` | Async processing; retries; callouts; Finalizer.                                                             |
| `WhatsAppMessageService`          | Create/upsert messages; dedupe; status precedence; status history; events.                                  |
| `WhatsAppConversationService`     | Upsert conversation; window; unread; assignment; close/reopen; case.                                        |
| `WhatsAppProfileService`          | Upsert profile by Wa ID/BSUID; identity; link to CRM.                                                       |
| `WhatsAppPhoneMatcher`            | Normalize; SOSL/query; mapping priority; create Lead/Contact; ambiguity.                                    |
| `WhatsAppOutboundService`         | Validate; build payloads for all types; queue; return status.                                               |
| `WhatsAppOutboundQueueable`       | Call Graph; update; retry; rate limit; log.                                                                 |
| `WhatsAppTemplateService`         | Sync/create/edit/delete; parse components; build send payload.                                              |
| `WhatsAppMediaService`            | Upload/download; ContentVersion/Distribution; size/MIME; cleanup.                                           |
| `WhatsAppConsentService`          | Opt-in/out; keywords; `user_preferences`; proof.                                                            |
| `WhatsAppRoutingService`          | Owner/queue; Case; Omni-Channel Flow; SLA.                                                                  |
| `WhatsAppNotificationService`     | Custom Notification; utility bar event; email.                                                              |
| `WhatsAppAnalyticsService`        | Sync analytics; daily rollups.                                                                              |
| `WhatsAppSetupService`            | Test connection; subscribe app; diagnostics; permissions; Site URL.                                         |
| `WhatsAppRetentionBatch`          | Archive/export/delete; media cleanup; legal hold.                                                           |
| `WhatsAppInvocable`               | Flow actions: Send Message/Template, Create Conversation, Consent, Sync Templates, Test Connection, Assign. |
| `WhatsAppSecurity`                | License/custom permission; CRUD/FLS; describe validation; strip inaccessible; safe errors.                  |
| `WhatsAppSelector`                | Typed SOQL; user mode; pagination; no dynamic injection.                                                    |
| `WhatsAppConstants`               | Picklist values, status order, limits, error codes.                                                         |
| `WhatsAppTestDataFactory`         | Test data for all objects.                                                                                  |
| `WhatsAppHttpCalloutMock`         | Mock Graph API responses.                                                                                   |

### 9.3 Apex standards

- `with sharing` for UI controllers; `without sharing` only for system services with explicit access checks.
- `WITH USER_MODE` for user-facing queries; `Security.stripInaccessible` for DML.
- `Database.queryWithBinds` for dynamic SOQL; validate object/field names via describe; allowlist.
- No `System.debug` of secrets/PII; use `WhatsApp_API_Log__c`.
- `AuraHandledException` with user-safe messages; log details.
- Bulkify triggers/queueables; no SOQL/DML in loops.
- Use `Finalizer` for retries; `Database.AllowsCallouts` where needed.
- Use `Test.getEventBus().deliver()` for platform events.
- Use `HttpCalloutMock` for all callouts; no real callouts in tests.
- 85%+ coverage target; 100% for critical webhook/security paths.

---

## 10. Security & compliance checklist

### 10.1 AppExchange security review

- [ ] CRUD/FLS enforced on all user-facing queries/DML.
- [ ] No SOQL injection (allowlist, binds, describe validation).
- [ ] No XSS (`innerHTML`, `eval`, `document.write`, unsafe URLs).
- [ ] No open redirects.
- [ ] No hardcoded secrets/IDs.
- [ ] Named Credentials/Remote Site Settings for callouts.
- [ ] Guest user least privilege; staging create-only.
- [ ] HMAC signature verification; replay/dedupe.
- [ ] Safe error messages; no stack traces/PII.
- [ ] Secure file upload (MIME/size; no executables).
- [ ] CSRF protection for any Visualforce (avoid VF; LWC/Apex handles).
- [ ] Session security; no sensitive data in URLs.
- [ ] Logging redaction.
- [ ] Tests for security paths.
- [ ] Accessibility (WCAG 2.1 AA).
- [ ] Mobile responsiveness.
- [ ] Package upgrade/uninstall behavior documented.
- [ ] LMA integration.
- [ ] Privacy policy/EULA.
- [ ] Checkmarx/Code Analyzer clean or documented false positives.

### 10.2 Compliance

- **Opt-in**: store proof/source/date; block marketing without opt-in; honor `user_preferences`.
- **Opt-out**: STOP keywords; block all outbound (or marketing only, configurable); audit.
- **24-hour window**: server-side enforcement; template fallback.
- **Data retention**: configurable; archive/export; delete media/files; legal hold.
- **GDPR**: export/delete by phone/BSUID; document process; sub-processor (Meta) DPA.
- **HIPAA**: WhatsApp is not HIPAA-compliant; do not position for PHI.
- **PCI**: do not handle card data in chat; payments out of scope.
- **Financial services**: WhatsApp Business Messaging Policy; template categories; opt-in.
- **Shield**: Field Audit Trail/Platform Encryption compatibility; test encrypted fields; don't assume CMT encryption.
- **Data residency**: Hyperforce/org region; Meta data processing; document.

---

## 11. Packaging, CI/CD, and testing

### 11.1 Repo structure (target)

```
whatsapp-for-salesforce/
├── force-app/main/default/
│   ├── applications/
│   ├── tabs/
│   ├── flexipages/
│   ├── layouts/
│   ├── listViews/
│   ├── classes/
│   │   ├── api/
│   │   ├── config/
│   │   ├── webhook/
│   │   ├── messaging/
│   │   ├── crm/
│   │   ├── ui/
│   │   ├── automation/
│   │   ├── security/
│   │   ├── util/
│   │   └── tests/
│   ├── triggers/
│   ├── lwc/
│   ├── objects/
│   ├── platformEvents/
│   ├── customMetadata/
│   ├── customSettings/
│   ├── permissionsets/
│   ├── customPermissions/
│   ├── namedCredentials/
│   ├── remoteSiteSettings/
│   ├── cspTrustedSites/
│   ├── customNotificationTypes/
│   ├── labels/
│   ├── staticresources/
│   └── ...
├── manifest/package.xml
├── config/
│   ├── project-scratch-def.json
│   └── package-definition.json
├── scripts/
│   ├── setup.sh
│   ├── deploy.sh
│   ├── test.sh
│   ├── package-version.sh
│   └── apex/
├── docs/
│   ├── ENTERPRISE_ANALYSIS.md
│   ├── SCOPE_QUESTIONNAIRE.md
│   ├── ARCHITECTURE.md
│   ├── SETUP_GUIDE.md
│   ├── ADMIN_GUIDE.md
│   ├── USER_GUIDE.md
│   ├── SECURITY.md
│   ├── API_COVERAGE.md
│   └── RELEASE_NOTES.md
├── .github/workflows/
├── sfdx-project.json
├── package.json
├── eslint.config.js
├── jest.config.js
├── .prettierrc
├── .forceignore
├── .gitignore
├── README.md
├── CHANGELOG.md
├── SECURITY.md
└── LICENSE
```

### 11.2 `sfdx-project.json` (2GP managed)

```json
{
  "packageDirectories": [
    {
      "path": "force-app",
      "default": true,
      "package": "WhatsApp for Salesforce",
      "versionName": "v1.0.0",
      "versionNumber": "1.0.0.NEXT",
      "definitionFile": "config/package-definition.json"
    }
  ],
  "name": "whatsapp-for-salesforce",
  "namespace": "wapp",
  "sfdcLoginUrl": "https://login.salesforce.com",
  "sourceApiVersion": "66.0"
}
```

> Verify the current API version supported by your Dev Hub; use the latest stable, not a guess.

### 11.3 CI/CD pipeline

**On pull request:**

1. Prettier check.
2. ESLint (LWC).
3. Salesforce Code Analyzer (PMD, ESLint, RetireJS, CPG) — fail on High/Critical.
4. LWC Jest unit tests + coverage.
5. Apex tests in a scratch org (or a persistent CI sandbox).
6. Deploy to a fresh scratch org; run smoke tests.
7. Package version create (validation only) for release branches.
8. Secret scan (`gitleaks`/`secretlint`).
9. Accessibility test (`jest-axe`).

**On main/tag:**

1. Create package version.
2. Promote.
3. Generate install link.
4. Publish release notes.
5. Optional: install in a clean scratch org and run end-to-end smoke tests with a Meta test number (manual gate).

**Recommended tools:**

- Salesforce CLI (`sf`).
- `@salesforce/plugin-packaging`, `@salesforce/plugin-code-analyzer`.
- `sfdx-git-delta` for incremental deploys.
- `sfdx-hardis` for CI/CD, backups, monitoring.
- `sfpowerkit` for metadata utilities.
- `shane-sfdx-plugins` for describe/query.
- `sfdx-plugin-source-read` for readable profiles/permissions.

### 11.4 Testing strategy

- **Apex unit tests**: Graph client, webhook, processor, outbound, templates, media, phone matcher, consent, routing, retention, invocable, security.
- **LWC Jest**: chat, inbox, composer, message, setup, templates, utility bar; mock Apex/empApi/navigation/LMS/file upload; `jest-axe`.
- **Integration**: scratch org with test data; mock Graph API; simulate webhook payloads; `Test.getEventBus().deliver()`; `System.runAs`.
- **Manual E2E**: Meta test number; send/receive text/media/template; verify ticks, window, opt-out, inbox, notifications.
- **Security tests**: invalid HMAC, duplicate payloads, oversized payloads, SOQL injection attempts, XSS strings, FLS/CRUD.
- **Performance/load**: 1k/10k/100k messages; API callout limits; platform event limits; Sites limits.
- **Upgrade test**: install v1.0, create data, upgrade to v1.1, verify data/behavior.
- **Uninstall test**: verify data loss warning; export.

---

## 12. Cleanup / refactor plan

### 12.1 Keep / rewrite / remove

| Item                                                   | Action             | Reason                                                                       |
| ------------------------------------------------------ | ------------------ | ---------------------------------------------------------------------------- |
| `WA_Widgte_Standalone-main/.../force-app`              | **Rewrite**        | Base product; code not deployable.                                           |
| `whatsappChatWidget` JS/HTML/CSS                       | **Rewrite**        | Duplicate code, broken imports, manual DOM, fixed layout. Keep visual ideas. |
| `whatsappInbox`                                        | **Rewrite**        | Shell; no real-time/search/filters; embedding broken.                        |
| `whatsappGlobalNotification`                           | **Rewrite**        | Shell; no empApi/utility bar.                                                |
| `whatsappAdminDashboard`                               | **Rewrite**        | Shell; no persistence.                                                       |
| `utilityService.js`                                    | **Remove**         | Unused; invalid meta.                                                        |
| `WhatsAppChatController`                               | **Split/rewrite**  | Too many responsibilities; webhook/parse bugs.                               |
| `WhatsAppOutboundService`                              | **Rewrite**        | Synchronous; Twilio-centric; US-only phone logic.                            |
| `WhatsAppConfigUtil`                                   | **Rewrite**        | Fake license; protected CMT editability issue.                               |
| `WhatsAppInboxController`                              | **Rewrite**        | Scalability/UX gaps.                                                         |
| `WhatsAppArchiveBatch`                                 | **Rewrite**        | Deletes without export/media/legal hold.                                     |
| Objects                                                | **Rebuild**        | Empty fields, invalid XML, missing objects.                                  |
| `App_License_Status__c`                                | **Remove**         | Hub-era; use LMA.                                                            |
| `WhatsApp_Provider_Setting__mdt`                       | **Replace**        | Protected/developer-controlled; not editable via UI.                         |
| `WhatsApp_Object_Mapping__mdt`                         | **Replace**        | Same; use custom object.                                                     |
| `WhatsApp_Opt_Out__c`                                  | **Replace**        | ReadWrite sharing; use consent object.                                       |
| `docs/superpowers/*`                                   | **Archive/remove** | Stale/contradicts no-middleware.                                             |
| `CONFIGURATION_GUIDE.md`                               | **Replace**        | Stale/hardcoded credentials.                                                 |
| `whatsappWidget_1`                                     | **Remove/archive** | Obsolete Socket.IO prototype.                                                |
| `WhatsappWidget_BE-main`                               | **Remove/archive** | Node/MongoDB backend; not allowed.                                           |
| `whatsappMiddleware_2`                                 | **Remove/archive** | Duplicate backend.                                                           |
| `scripts/apex/hello.apex`, `scripts/soql/account.soql` | **Remove**         | Template leftovers.                                                          |
| Root `.gitignore`                                      | **Rewrite**        | UTF-16, incomplete.                                                          |
| `sfdx-project.json`                                    | **Update**         | 2GP package config, namespace, API version.                                  |
| `package.json`                                         | **Update**         | Name, scripts, dev deps.                                                     |
| Tests                                                  | **Add**            | 0 Apex tests; only 2 LWC tests.                                              |
| Docs                                                   | **Add**            | Setup/admin/user/security/API coverage/release.                              |

### 12.2 Proposed first cleanup (after scope confirmation)

1. Create a branch `chore/repo-cleanup`.
2. Move obsolete projects to `legacy/`:
   - `whatsappWidget_1`
   - `WhatsappWidget_BE-main`
   - `whatsappMiddleware_2`
3. Move the standalone project to the repo root (`force-app` at root) or create `whatsapp-for-salesforce/`.
4. Remove `docs/superpowers` and `CONFIGURATION_GUIDE.md`; replace with new docs.
5. Remove `utilityService.js`, template scripts, `.vscode` leftovers not needed.
6. Add proper `.gitignore`, `.forceignore`, `README`, `manifest/package.xml`.
7. Fix/rebuild metadata; add permission sets, Named Credentials, platform events, custom notification, labels, tabs, app.
8. Rewrite Apex/LWC incrementally with tests.
9. Run Code Analyzer; fix security findings.
10. Rewrite git history to remove `node_modules` blobs (optional; coordinate with team).

**Do not delete anything until the scope questions are answered** — the old code is useful as a reference for phone matching, status updates, and UI ideas.

### 12.3 Git history cleanup

- Current pack: ~13.8 MiB; largest blobs are `node_modules`.
- No `.env` or live secrets found in history.
- To remove `node_modules` from history:
  - `git filter-repo --path-glob '*/node_modules/*' --invert-paths`
  - or BFG `--delete-folders node_modules`
- Force-push and notify collaborators; rotate any credentials if history is shared.
- Add `node_modules/`, `.sfdx/`, `.sf/`, `.env`, `coverage/`, `dist/`, `lwc-sandbox/` to `.gitignore`.

---

## 13. Roadmap and estimates

Assumptions: 1 senior Salesforce dev + 1 LWC dev + 1 QA/architect part-time; 2-week sprints.

| Phase                                  | Duration        | Deliverables                                                                                                                                                                                                           |
| -------------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **0. Foundation & cleanup**            | 2–3 weeks       | Repo cleanup; 2GP package; CI; data model; permission sets; settings; Named Credentials; platform events; test harness; architecture/security docs.                                                                    |
| **1. Core messaging MVP**              | 4–5 weeks       | Graph client; setup connection; webhook (GET/HMAC/staging/processor); inbound text/status; outbound text; phone matching; profile/conversation/message objects; record chat LWC; platform events; 24h window; opt-out. |
| **2. Media + templates**               | 4–5 weeks       | Media upload/download; ContentVersion/ContentDistribution; image/audio/video/document; template sync/create/list/send; template picker; status webhooks; retention.                                                    |
| **3. Inbox + notifications + routing** | 3–4 weeks       | Conversation inbox; assignment; unread; search/filters; utility bar; Custom Notifications; Case/Lead creation; queue/Omni-Channel; health dashboard.                                                                   |
| **4. Advanced WABA**                   | 6–8 weeks       | Interactive (buttons/list/carousel); location/contacts/reaction/reply/read receipts/typing; Flows; catalogs; groups; marketing; coexistence; analytics; calling events.                                                |
| **5. AppExchange readiness**           | 6–8 weeks       | Security review; accessibility; performance; scale; LMA; packaging; docs; demo; EULA/privacy; listing.                                                                                                                 |
| **Total**                              | **~6–8 months** | Depends on scope, team, Meta approvals, security review.                                                                                                                                                               |

**Critical path**: Meta app/permissions, Salesforce Site/guest user, security review, AppExchange listing. Start these early.

---

## 14. Tooling, skills, and plugins

### 14.1 Official Salesforce skills/plugins (use these)

**Repo**: `https://github.com/forcedotcom/sf-skills` (Apache-2.0, 1.2k stars, actively maintained).

Install for OpenCode/Claude Code/Codex/Cursor:

```bash
npx skills add forcedotcom/sf-skills
```

For Claude Code plugin:

```bash
# Follow the official installation guide; the repo includes a .claude-plugin marketplace manifest.
```

**Most relevant skills/plugins for this project:**

| Skill/plugin                                    | Why                                                    |
| ----------------------------------------------- | ------------------------------------------------------ |
| `salesforce-development`                        | Core build/test/deploy workflow.                       |
| `dx-isv-partner`                                | AppExchange/ISV packaging, LMA, security review.       |
| `dx-packaging`                                  | 2GP package creation, versioning, promotion, upgrades. |
| `integration`                                   | Apex callouts, Named Credentials, external services.   |
| `platform-trust-security`                       | Security review, CRUD/FLS, secrets, guest user.        |
| `salesforce-code-quality`                       | Code Analyzer/PMD/ESLint setup and fixes.              |
| `service-omni`                                  | Omni-Channel/Service Cloud routing.                    |
| `service-engagement`                            | Case/Service Cloud engagement patterns.                |
| `experience-lwc` / `platform-lightning-widgets` | LWC architecture, SLDS, accessibility, testing.        |
| `platform-observability`                        | Logging, monitoring, health checks.                    |
| `dx-org-lifecycle`, `dx-devops`                 | Scratch orgs, CI/CD, DevOps Center.                    |

### 14.2 Community skills (optional; check licenses)

| Repo                                     | License                                    | Notes                                                                               |
| ---------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------- |
| `Clientell-Ai/salesforce-skills`         | Apache-2.0                                 | Apex, Flow, LWC, SOQL, security, deployments; works with 50+ tools.                 |
| `PranavNagrecha/AwesomeSalesforceSkills` | PolyForm Small Business (source-available) | 1,040 skill packages, 70 agents, MCP server; powerful but check commercial license. |
| `ehebert7/salesforce-claude-framework`   | MIT                                        | Community framework/agents/commands; optional.                                      |
| `SalesforceLabs/lsc-for-claude`          | Check license                              | Life Sciences Cloud-specific; not relevant.                                         |

### 14.3 Salesforce DX MCP server — important

The official **Salesforce DX MCP Server** (`@salesforce/mcp`, `salesforcecli/mcp`) reached **end of life on November 2, 2026** and is archived. Salesforce now delivers tooling as **skills** (`forcedotcom/sf-skills`). Do not start a new project on the EOL MCP server. If you must keep it, pin `0.30.15`; it is unsupported.

Optional MCP servers that are still useful:

- `context7` — up-to-date library/docs context.
- `github` — issues/PRs.
- `playwright` — browser E2E (if needed).
- A custom project MCP for Meta docs/payload validation (optional).

### 14.4 CLI plugins

```bash
npm install -g @salesforce/cli
sf plugins install @salesforce/plugin-packaging
sf plugins install @salesforce/plugin-code-analyzer
sf plugins install @salesforce/plugin-scratchorgs
sf plugins install @salesforce/plugin-data
sf plugins install @salesforce/plugin-deploy-retrieve
sf plugins install @salesforce/plugin-limits
sf plugins install @salesforce/plugin-org
sf plugins install @salesforce/plugin-user
sf plugins install @salesforce/plugin-apex
sf plugins install @salesforce/plugin-soql
sf plugins install @salesforce/plugin-auth
sf plugins install sfdx-git-delta
sf plugins install sfdx-hardis
sf plugins install sfpowerkit
sf plugins install shane-sfdx-plugins
sf plugins install sfdx-plugin-source-read
```

### 14.5 VSCode extensions

- Salesforce Extension Pack (Salesforce CLI Integration, Apex, LWC, Visualforce, Lightning).
- Salesforce Code Analyzer.
- ESLint.
- Prettier.
- Jest.
- Apex Log Analyzer.
- Salesforce Inspector Reloaded (browser extension, not VSCode).
- GitLens.
- XML.
- Mermaid preview.

### 14.6 Testing/code quality libraries

```bash
npm install --save-dev \
  @salesforce/eslint-config-lwc \
  @lwc/eslint-plugin-lwc \
  @salesforce/eslint-plugin-aura \
  @salesforce/eslint-plugin-lightning \
  eslint \
  prettier \
  prettier-plugin-apex \
  @salesforce/sfdx-lwc-jest \
  jest \
  jest-axe
```

Optional Apex mocking libraries:

- `fflib-apex-mocks` / `fflib-apex-common` (financial force; check license/namespace).
- `ApexMock` (community).
- Built-in `HttpCalloutMock` + `Test.getEventBus()` is sufficient for most.

### 14.7 Custom project skills (recommended)

Create repo-local skills so every agent follows the same patterns:

```
skills/
├── whatsapp-cloud-api/SKILL.md      # endpoints, payloads, error codes, media limits
├── salesforce-2gp/SKILL.md          # package commands, versioning, LMA
├── webhook-security/SKILL.md        # HMAC, guest user, staging, dedupe
├── apex-integration/SKILL.md        # Named Credentials, callouts, mocks
├── lwc-chat-ui/SKILL.md             # SLDS, accessibility, empApi, no innerHTML
├── apex-testing/SKILL.md            # TestDataFactory, HttpCalloutMock, event bus
├── lwc-testing/SKILL.md             # Jest, mocks, jest-axe
├── release/SKILL.md                 # package version, promote, install, upgrade
└── security-review/SKILL.md         # CRUD/FLS, SOQL injection, XSS, guest user
```

### 14.8 Reference repos

- `trailheadapps/lwc-recipes` — LWC patterns.
- `trailheadapps/dreamhouse-lwc` — app structure, Jest, SLDS.
- `trailheadapps/apex-recipes` — Apex patterns.
- `forcedotcom/sf-skills` — official skills.
- `Monish-giri/WhatsApp-Integration` — a Salesforce-native WhatsApp Cloud API reference (not production-grade; useful for Site/webhook/media patterns).
- `AniketSharma-05/Salesforce-WhatsApp-Integration-Rest-Api-` — basic Apex/LWC reference.

---

## 15. Open questions

See `docs/SCOPE_QUESTIONNAIRE.md` for the full questionnaire. The top blocking decisions are:

1. **Distribution**: AppExchange managed package vs internal unlocked package? (Namespace, LMA, security review.)
2. **Provider**: Meta Cloud API direct only, or also Twilio/BSP? (All WABA features strongly favor Meta direct.)
3. **Onboarding**: customer-provided Meta app/token vs ISV Tech Provider + Embedded Signup? (Manual first vs Meta partnership.)
4. **Cloud**: Sales Cloud, Service Cloud (Case/Omni-Channel), or both? (Routing/data model.)
5. **v1 scope**: core messaging + media + templates + inbox + notifications vs "everything" (Flows, catalogs, groups, marketing, coexistence, calling)?
6. **Media ceiling**: accept ~10–12 MB inbound media limit? (Hard Apex constraint.)
7. **Routing**: Case/queue assignment vs Omni-Channel vs custom inbox assignment?
8. **Licensing**: LMA only vs LMA + custom permissions? (No hub.)
9. **Volume**: messages/month, concurrent agents, phone numbers/WABAs? (Sites/Platform Event/Apex limits.)
10. **Compliance**: GDPR, HIPAA, PCI, Shield, data residency, retention?
11. **Languages/regions**: English only vs multi-language; default country code(s)?
12. **Branding/UX**: WhatsApp clone vs SLDS-native? (Recommend SLDS-native with WhatsApp-inspired chat.)
13. **Team/timeline**: who builds it, when, budget?
14. **Existing assets**: Meta app/WABA/phone number, Salesforce Partner Program/namespace/Dev Hub/LMO?
15. **Native Salesforce WhatsApp**: any conflict with Salesforce's native Messaging for WhatsApp channel? (Positioning/integration.)

---

## 16. Appendix — file-by-file findings

### 16.1 `WhatsAppChatController.cls`

- Line 17: `SELECT ... Owner__c` — field does not exist; use `OwnerId`.
- Lines 35–61: REST `@HttpPost` only; no `@HttpGet` verification; no signature check.
- Lines 64–89: Twilio parsing; no signature; only `MediaUrl0`.
- Lines 92–135: Meta parsing; only first entry/change/message/status; no media/interactive/etc.
- Lines 138–201: direct insert; no dedupe; no profile/conversation; owner = record owner or current user; opt-out exact keywords only; event `ContactId__c` misnamed.
- Lines 204–227: Omni-Channel placeholder; PSR not insertable via Apex.
- Lines 229–248: status update by Twilio SID; no precedence; no history.
- Lines 250–263: opt-out object; no consent source/proof.
- Lines 265–275: form parser; no signature.

### 16.2 `WhatsAppOutboundService.cls`

- Lines 4–111: synchronous send; no queue/retry; `objectApiName` from client; dynamic SOQL not validated; no FLS.
- Lines 114–135: Twilio; basic auth in header; no status callback.
- Lines 138–173: Meta; `v17.0` hardcoded; media always `image`; no MIME/type; no template/interactive.
- Lines 176–192: US-centric normalization.

### 16.3 `WhatsAppConfigUtil.cls`

- Lines 4–15: license check only current user; custom setting lock.
- Lines 18–23: `isUserLicensed` always true.
- Lines 26–40: first CMT record; no active flag; no multi-account.
- Lines 43–55: mapping by object; no field validation.

### 16.4 `WhatsAppInboxController.cls`

- Lines 4–34: aggregate on messages; owner filter; truncated ID; no name/unread/last message/pagination/search.

### 16.5 `WhatsAppArchiveBatch.cls`

- Lines 1–39: hardcoded 6/12 months; deletes only; no export/media/legal hold/tests.

### 16.6 `whatsappChatWidget.js`

- Line 13 vs 288: `@api recordId` field shadows setter.
- Lines 21–37, 150–167, 223–241: duplicate field declarations.
- Lines 44–59, 243–257: duplicate `connectedCallback`.
- Lines 54–59, 322–328: duplicate `disconnectedCallback`.
- Lines 88–114, 678–704: duplicate `subscribeToMessageEvents`.
- Lines 117–127, 706–716: duplicate `handleSubscriptionError`.
- Lines 130–140, 753–763: duplicate `unsubscribeFromMessageEvents`.
- Lines 143–149, 766–774: duplicate `handleNewMessage`.
- Lines 330–346: `getContactDetails` not imported.
- Lines 357–387: loads all messages; no pagination.
- Lines 389–418: reloads all messages.
- Lines 557–650: optimistic send; no WAMID reconciliation.
- Lines 652–676: `sendTemplateMessage` not imported.
- Lines 719–750: `this.subscription` never set; dead.
- Lines 776–820: `loadMessages({ contactId })` wrong params.
- Lines 831–940: manual DOM/`innerHTML`.
- Lines 942–949: `setTimeout` scroll; no cleanup.
- Lines 984–994: refresh.
- HTML line 47: `lwc:dom="manual"`.
- HTML line 78: `handleMediaFileChange` not defined.
- CSS line 2: `:host { position: fixed; }`; fixed 350×550; no responsive/inline mode.

### 16.7 Metadata

- `WhatsAppMessage__c.object-meta.xml` line 11: invalid closing tag.
- Empty field XML files: 9.
- `WhatsApp_Provider_Setting__mdt` / `WhatsApp_Object_Mapping__mdt`: protected + developer-controlled; not editable via UI.
- `WhatsApp_Opt_Out__c`: `sharingModel` ReadWrite.
- `whatsappChatWidget.js-meta.xml`: targetConfig only Contact; API 60; no `lightning__RecordAction`.
- `utilityService.js-meta.xml`: invalid for a service module.
- `sfdx-project.json`: namespace empty; API 64; no 2GP package.
- `package.json`: generic name; no package/scan/CI scripts.
- `.gitignore`: UTF-16; incomplete.

---

## 17. Glossary

- **WABA**: WhatsApp Business Account (now split into WhatsApp account (WAAC) and Messaging account).
- **WAAC**: WhatsApp account; holds a phone number/business presence.
- **Messaging account**: holds templates/billing; the existing WABA ID identifies it.
- **WAMID**: WhatsApp message ID (`wamid...`).
- **BSUID**: Business-scoped user ID; stable per business; phone may be omitted.
- **CSW**: Customer service window; 24 hours after a user message/call.
- **FEP**: Free entry point window; up to 7 days after a CTWA response.
- **CTWA**: Click-to-WhatsApp ad.
- **MM API**: Marketing Messages API for WhatsApp.
- **LMA**: License Management App.
- **2GP**: Second-generation managed package.
- **PSR**: PendingServiceRouting (Omni-Channel; not insertable via Apex).
- **CMT**: Custom Metadata Type.
- **Named Credential**: Salesforce-managed callout endpoint/auth.
- **Site guest user**: public Site user; minimal permissions.
- **ContentDistribution**: Salesforce public content delivery link.
