# Implementation Status

> Date: 2026-11-18
> Branch: `main`

## Built and validated

### Data model

- 17 custom objects plus the existing credential/settings/event metadata.
- 294 generated fields, validated XML.
- Key objects:
  - `WhatsApp_Account__c`
  - `WhatsApp_Profile__c`
  - `WhatsApp_Conversation__c`
  - `WhatsApp_Message__c`
  - `WhatsApp_Message_Status__c`
  - `WhatsApp_Media__c`
  - `WhatsApp_Template__c`
  - `WhatsApp_Consent__c`
  - `WhatsApp_Object_Mapping__c`
  - `WhatsApp_Routing_Rule__c`
  - `WhatsApp_Rule_Log__c`
  - `WhatsApp_Webhook_Event__c`
  - `WhatsApp_API_Log__c`
  - `WhatsApp_Outbound_Queue__c`
  - `WhatsApp_Usage__c`
  - `WhatsApp_Conversation_Member__c`

### Permissions

- `WhatsApp_Admin`
- `WhatsApp_Agent`
- `WhatsApp_Template_Manager`
- `WhatsApp_Bulk_Send`
- `WhatsApp_Integration`
- `WhatsApp_Guest_Webhook` (create-only staging access for the Site guest profile)

### Configuration

- `WhatsApp_Settings__c` protected hierarchy custom setting (non-secret).
- `WhatsApp_Credential__c` private object (Long Text Area tokens/secrets; Custom Settings max 255 chars).
- Remote Site Settings for `graph.facebook.com` and `lookaside.fbsbx.com`.
- `WhatsApp_Event__e` platform event.

### Apex

- `WhatsAppConstants` + test.
- `WhatsAppException`.
- `WhatsAppSettingsService` — typed settings/credential access.
- `WhatsAppGraphClient` — Graph GET/POST/DELETE, token, timeout, error mapping, API log, fbtrace_id.
- `WhatsAppWebhookResource` — GET verification, HMAC SHA-256, create-only staging, duplicate handling.
- `WhatsAppWebhookEventTrigger` / handler / queueable — async processing.
- `WhatsAppWebhookProcessor` — text/status/media-placeholder parsing, profile/conversation/message/status upserts, platform events.
- `WhatsAppAccountService`, `WhatsAppProfileService`, `WhatsAppConversationService`, `WhatsAppEventService`.
- `WhatsAppPhoneMatcher` — validated dynamic SOQL, E.164 fallback, auto-create Lead.
- `WhatsAppOutboundService` + `WhatsAppOutboundQueueable` — text send, consent block, 24h window, queue, Graph callout, status update.
- `WhatsAppChatController` — context, message load, send, access checks.
- Tests:
  - `WhatsAppGraphClientTest`
  - `WhatsAppWebhookResourceTest`
  - `WhatsAppWebhookProcessorTest`
  - `WhatsAppOutboundServiceTest`
  - `WhatsAppPhoneMatcherTest`
  - `WhatsAppTestDataFactory`

### LWC

- `whatsappChat` — SLDS-native, WhatsApp-inspired record chat:
  - Launcher and responsive panel
  - Record context, messages, date separators, status ticks
  - 24h window label, consent badge
  - Composer, Enter-to-send, refresh
  - empApi subscription to `WhatsApp_Event__e`
  - No `innerHTML`
  - Jest tests (launcher/open/empty state)

### Validation run

- Apex parser (`@apexdevtools/apex-parser`): 24 files, 0 syntax errors.
- XML: all metadata well-formed.
- Prettier: passes.
- ESLint (LWC): passes.
- Jest: 2 tests pass.

## Not built yet

- `whatsappSetup` admin UI (object/field mapping, routing rules, diagnostics).
- `whatsappInbox` full-page inbox.
- `whatsappUtilityBar` notifications.
- Template sync/create/delete/send and template picker.
- Media upload/download and Salesforce Files preview.
- Consent UI and opt-out keyword processing.
- Case creation/assignment service and Lead conversion re-parenting.
- Usage metering (`WhatsApp_Usage__c` rollups).
- Settings/credential setup screen and connection test.
- Webhook retry scheduler.
- Full test coverage (Apex compile/deploy needs a Dev Hub; tests are written but not executed against an org).
- AppExchange packaging, LMA, security review, CI.

## Next slice

1. `WhatsAppAdminController` + `whatsappSetup`:
   - Connection/credential status
   - Object/field mapping builder with preview
   - Routing rule list + JSON editor (conditions/actions)
   - Diagnostics (webhook/API logs, queue depth)
2. `whatsappInbox`:
   - Conversation list, search/filter, unread, assignment, active chat
3. Templates + media:
   - Sync/create/delete templates
   - Template picker and variable input
   - Media upload/download with Salesforce Files
4. Case/Lead routing:
   - One Case per conversation
   - Lead conversion re-parenting
   - Assignment rules

## Important constraints

- Apex heap: inbound media above ~10–12 MB cannot be stored in Salesforce Files; document and show a "too large" state.
- All data/media stay in Salesforce; 1-year retention at >30% media requires a Salesforce storage add-on or reduced retention/compression.
- Embedded Signup requires Meta Tech Provider status; manual credentials are for development/testing.
- No automatic messages: only agent-initiated sends.
