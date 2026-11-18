# Configuration & Business Logic Model

Requirement: the client must be able to **map any object/field**, **design routing/business rules**, and **choose how the package behaves** without code changes.

This document defines the admin experience, the rule engine, and the extension points.

---

## 1. Principles

1. **Admin-configurable, not hardcoded.** Object mappings, routing, assignment, record creation, consent behavior, window rules, notifications, retention, and templates are configured by the client.
2. **No automatic outbound messages.** The package never sends a WhatsApp message on its own. Agents initiate messages; rules may create/assign/notify internal records only.
3. **Everything in Salesforce.** Configuration, credentials (private object), messages, media, and logs stay in the client's org. No external database or archive.
4. **Safe defaults.** If a mapping/rule is missing, the package fails closed with a clear setup message — never guesses a phone number or sends to the wrong record.
5. **Preview before save.** Admins can test a mapping/rule against a record and see what would happen.
6. **Least privilege.** Setup is admin-only; agents see only their conversations; template managers see templates; bulk send is a separate permission.

---

## 2. Setup app

A Lightning app **WhatsApp for Salesforce** with these tabs/pages:

### 2.1 Connection & Credentials

- Provider: Meta (Twilio hidden for v1; future compatibility).
- Meta App ID, App Secret, System User access token, token expiry.
- Messaging account ID (WABA ID), WhatsApp account ID (WAAC), phone number ID.
- Webhook verify token (generate/rotate).
- Salesforce Site URL + generated callback URL.
- Buttons:
  - **Test connection** — `GET /{phone-number-id}?fields=...`.
  - **Subscribe app to WABA** — `POST /{waba-id}/subscribed_apps`.
  - **Verify webhook** — show the exact Meta configuration and a test POST.
  - **Rotate token** — replace token, test, audit.
- Status: Connected / Not configured / Error.
- Security: values masked; only admins; secrets in `WhatsApp_Credential__c` (Long Text Area), never in logs.

### 2.2 Accounts & Phone Numbers

- One row per WABA/Messaging account and phone number.
- Display phone number, verified name, quality rating, throughput, messaging limit, status, timezone, currency, default flag.
- Sync from Meta; last sync time.
- Enable/disable a number for the widget/inbox.
- Set default number per brand/country/queue.

### 2.3 Object & Field Mapping

The core requirement: **map any object and any phone/name/country field**.

For each mapping:

| Setting              | Purpose                                                                 |
| -------------------- | ----------------------------------------------------------------------- |
| Object API name      | Lead, Contact, Account, Case, custom object.                            |
| Phone field          | The field to use for WhatsApp (Phone, MobilePhone, custom).             |
| Country code field   | Optional separate country code; if blank, use the default country code. |
| Name field           | Record name/display name field.                                         |
| Record type / filter | Optional filter to limit which records are eligible.                    |
| Priority             | If multiple mappings match, the highest priority wins.                  |
| Auto-create Lead     | If no record matches, create a Lead (configurable object/record type).  |
| Auto-create Contact  | Alternative to Lead.                                                    |
| Auto-create Case     | If a Contact/Account matches, create a Case.                            |
| Default owner/queue  | Where new records/conversations go.                                     |
| Duplicate handling   | Match existing by normalized phone/BSUID; ambiguous → flag for review.  |
| Active               | Enable/disable without deleting.                                        |

UI behavior:

- Object picker from `Schema.getGlobalDescribe()` (filtered to accessible objects).
- Field picker from `Schema.describeSObjects` (filtered to text/phone fields for phone; text for country/name).
- Validate field type, FLS, and object accessibility.
- **Preview**: choose a record, see the resolved phone (E.164), country code, matched object, and conversation that would be created.
- **Test inbound**: paste a phone number/BSUID, see which record(s) match and which rule wins.
- Multiple mappings per object are allowed (e.g., Mobile, Phone, WhatsApp_Number\_\_c); the widget shows a number selector.

### 2.4 Routing & Assignment Rules

A **rule builder** for inbound/outbound conversation behavior:

**When** (conditions — all/any):

- Object/record type
- Field equals/not equals/contains/starts with
- Phone country
- Consent status (opted in/out/unknown)
- Message type (text/media/template/reply)
- Keyword (STOP, START, custom)
- Business hours / holiday calendar
- Current owner/queue
- Conversation priority/SLA
- Existing open Case/Lead
- Custom condition JSON (advanced)

**Then** (actions — internal only):

- Create Lead / Contact / Case (with record type, owner/queue, fields).
- Assign conversation to a user/queue.
- Set priority, status, tags.
- Create a Task/Event.
- Set SLA/due date.
- Link to an existing record.
- Send an internal notification (bell/email/utility bar).
- Set consent status (only from verified inbound keywords; audit).
- Block/allow outbound (opt-out).
- Add to a report/dashboard category.

**Not allowed as an automatic action:** send a WhatsApp message. Sending is agent-initiated; if the client wants a template on a Flow-triggered event, that is a separate, explicit, opt-in Flow action with a warning and audit.

Rule features:

- Order/priority; first-match or all-match.
- Active/inactive; clone; version history.
- Dry-run against a record/phone.
- Conflict detection (multiple rules matching with different outcomes).
- Audit log of changes.
- Rule evaluation limits (max rules, max conditions) to protect governor limits.

### 2.5 Consent & Compliance

- Opt-in status, source, date, proof (text/URL/file).
- Marketing vs transactional consent.
- STOP/START keywords and languages.
- 24-hour window rules; template fallback.
- No auto-send.
- Outbound block on opt-out; admin override with reason + audit.
- CTWA referral/free-entry-point tracking.
- GDPR export/delete by phone/BSUID.
- Retention/legal hold (within Salesforce).

### 2.6 Templates

- Sync from Meta; list by status/category/language/quality.
- Create/edit/delete templates (with permission).
- Component builder: header (text/media), body variables, footer, buttons (quick reply/URL/phone), authentication/coupon/LTO/carousel later.
- Preview with sample values.
- Send from the composer; variable validation.
- Status/quality webhooks update the record.

### 2.7 Media & Retention

- Max inbound media size (default 10 MB; Apex heap limit).
- One-year retention decision: show a **storage dashboard** with current usage and projected growth.
- All media stays in Salesforce Files; no external archive.
- If projected storage exceeds the org entitlement, the setup page shows a hard warning and recommends a Salesforce storage add-on or reduced retention/compression.
- Compression/thumbnail options; video limits; document limits.
- Media cleanup batch respects legal hold.

### 2.8 Notifications

- Custom Notification Type / bell.
- Utility bar badge.
- Email to owner/queue/admin.
- Quiet hours.
- Per-user preferences.
- No customer-facing auto-send.

### 2.9 Diagnostics

- Webhook events (last 24h/7d): received, processed, failed, duplicate.
- API logs: status codes, errors, `fbtrace_id`, latency.
- Queue depth, retries, failed sends.
- Token expiry, permissions, Site/guest user, Named Credential, Remote Site, Platform Event, Custom Notification.
- One-click **Health Check** with pass/fail and remediation links.
- Retry failed webhook/API jobs.

### 2.10 Audit

- Admin config changes (who/when/what).
- Consent overrides.
- Message access/export.
- Rule changes.
- Use Salesforce Setup Audit Trail + package audit object for app-level changes.

---

## 3. Rule engine data model

### 3.1 `WhatsApp_Routing_Rule__c`

| Field                | Purpose                                     |
| -------------------- | ------------------------------------------- |
| `Name`               | Human-readable rule name.                   |
| `Description__c`     | What it does.                               |
| `Object_API_Name__c` | Scope: Lead, Contact, Case, custom, or Any. |
| `Priority__c`        | Evaluation order (lower = first).           |
| `Is_Active__c`       | Enable/disable.                             |
| `Match_Type__c`      | All / Any.                                  |
| `Conditions_JSON__c` | Array of conditions.                        |
| `Actions_JSON__c`    | Array of actions.                           |
| `Stop_On_Match__c`   | First match vs continue.                    |
| `Version__c`         | Rule version.                               |
| `Last_Tested__c`     | Last dry-run.                               |
| `Test_Result__c`     | Last dry-run result.                        |

### 3.2 Condition JSON (example)

```json
[
  { "field": "Lead.CountryCode", "operator": "equals", "value": "AE" },
  {
    "field": "Consent.Opt_In_Status__c",
    "operator": "equals",
    "value": "Opted In"
  },
  { "field": "Message.Type__c", "operator": "in", "value": ["text", "image"] }
]
```

Supported operators:

- equals, notEquals, contains, startsWith, endsWith, in, notIn, greaterThan, lessThan, isEmpty, isNotEmpty, between, matchesRegex (admin-only, guarded).

### 3.3 Action JSON (example)

```json
[
  {
    "type": "createRecord",
    "object": "Case",
    "recordType": "Support",
    "ownerQueue": "WhatsApp_Support"
  },
  {
    "type": "assignConversation",
    "queue": "WhatsApp_Support",
    "priority": "High"
  },
  {
    "type": "createTask",
    "subject": "Respond to WhatsApp message",
    "dueInMinutes": 60
  },
  {
    "type": "notify",
    "recipients": ["owner", "queue"],
    "template": "New WhatsApp Message"
  }
]
```

Action types:

- `createRecord`, `updateRecord`, `assignConversation`, `assignOwner`, `setPriority`, `setStatus`, `addTag`, `createTask`, `createEvent`, `notify`, `linkRecord`, `setSla`, `setConsent`, `blockOutbound`, `allowOutbound`, `addToCampaign` (later).

**No `sendMessage` action in v1.** If the client wants automated templates later, it must be an explicit Flow action with opt-in, rate limits, and audit.

### 3.4 Evaluation

- Runs in `WhatsAppRoutingService` during webhook processing, after profile/conversation creation, before notifications.
- Bulk-safe: evaluate once per conversation, not per message.
- Governor-safe: limit rules/conditions; cache active rules; no SOQL in loops.
- Deterministic: priority + first-match; log the matched rule and actions.
- Dry-run: `WhatsAppRoutingRulePreview` Apex method evaluates without DML.

### 3.5 Extensibility

Not every business rule can be pre-built. Provide three layers:

1. **Rule builder** — common routing/assignment/record creation.
2. **Salesforce Flow** — invocable Apex actions for advanced logic:
   - `WhatsApp_Send_Message` (agent-initiated only)
   - `WhatsApp_Send_Template`
   - `WhatsApp_Create_Conversation`
   - `WhatsApp_Update_Consent`
   - `WhatsApp_Assign_Conversation`
   - `WhatsApp_Create_Case`
   - `WhatsApp_Find_Record_By_Phone`
   - `WhatsApp_Sync_Templates`
   - `WhatsApp_Test_Connection`
3. **Apex extension** — `Callable` interface / registered class name for developers:
   - `global interface WhatsAppExtension { void onInbound(WhatsAppContext ctx); void onOutbound(WhatsAppContext ctx); }`
   - Registered via `WhatsApp_Settings__c.Extension_Class__c`; called with try/catch; failures logged, never block message storage.

This gives the client "all possibilities" without the package hardcoding every scenario.

---

## 4. Additional objects

| Object                     | Purpose                                                                                                                                   |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `WhatsApp_Routing_Rule__c` | Rule definitions (conditions/actions JSON).                                                                                               |
| `WhatsApp_Rule_Log__c`     | Which rule matched, actions executed, duration, errors.                                                                                   |
| `WhatsApp_Usage__c`        | Daily/monthly usage rollup: messages by category, billable, estimated cost, provider, account. Used for dashboards and future re-billing. |
| `WhatsApp_Setup_Check__c`  | Health check results (optional; could be transient).                                                                                      |
| `WhatsApp_Consent__c`      | Consent/opt-in/out audit.                                                                                                                 |
| `WhatsApp_Audit__c`        | App-level config/consent overrides (optional; Setup Audit Trail covers some).                                                             |

---

## 5. UI components

| Component                      | Purpose                                                                                                           |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `whatsappSetup`                | Shell with tabs for connection, accounts, mappings, rules, consent, templates, media, notifications, diagnostics. |
| `whatsappConnection`           | Credentials/test/subscribe/webhook.                                                                               |
| `whatsappAccountList`          | Accounts/phone numbers.                                                                                           |
| `whatsappObjectMapping`        | Object/field mapping builder + preview.                                                                           |
| `whatsappRuleBuilder`          | Conditions/actions builder + dry-run.                                                                             |
| `whatsappTemplateManager`      | Template sync/create/list/status.                                                                                 |
| `whatsappMediaSettings`        | Size/retention/storage dashboard.                                                                                 |
| `whatsappDiagnostics`          | Health checks, logs, retries.                                                                                     |
| `whatsappConsentSettings`      | Keywords, consent behavior, 24h window.                                                                           |
| `whatsappNotificationSettings` | Bell/email/utility bar preferences.                                                                               |

All components: SLDS-native, admin-only, no `innerHTML`, accessible, mobile-responsive.

---

## 6. Permissions

| Permission set              | Access                                                                          |
| --------------------------- | ------------------------------------------------------------------------------- |
| `WhatsApp_Admin`            | Setup, credentials, mappings, rules, templates, diagnostics, all conversations. |
| `WhatsApp_Agent`            | Chat/inbox, send/receive, view own/assigned conversations, consent badge.       |
| `WhatsApp_Template_Manager` | Template CRUD/sync (no credentials).                                            |
| `WhatsApp_Bulk_Send`        | Bulk/scheduled sends (no credentials).                                          |
| `WhatsApp_Integration`      | System/integration user for webhook/media processing; no UI.                    |

- Credentials object: Admin only; field-level security; optional Shield.
- Rule builder: Admin only.
- Consent override: Admin only with audit.
- Agents cannot edit mappings/rules/credentials.

---

## 7. Validation rules for the setup UI

- Object must be accessible and queryable; field must exist and be the right type.
- Phone field must be text/phone; country code field text; name field text.
- No hardcoded record IDs; use lookups/queues by developer name.
- Rule conditions must reference mapped fields/known context; unknown fields fail validation.
- Rule JSON must be valid and within size limits.
- No rule may contain an automatic `sendMessage` action in v1.
- Test connection must pass before enabling the widget.
- Webhook must verify before enabling inbound.
- Storage projection must be acknowledged before setting 1-year retention.

---

## 8. What "all possibilities" realistically means

A package cannot pre-build every business process. The enterprise pattern is:

- **Configuration** for the 80% (mappings, routing, assignment, consent, templates, retention).
- **Flow** for the 15% (client-specific automation using invocable actions).
- **Apex extension** for the 5% (complex integrations/industry logic).

This is more maintainable and certifiable than a giant hardcoded rules engine, and it lets the client own their business logic while the package owns the WhatsApp mechanics.
