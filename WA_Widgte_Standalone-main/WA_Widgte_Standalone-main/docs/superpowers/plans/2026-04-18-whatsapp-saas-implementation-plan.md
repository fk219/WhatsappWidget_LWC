# WhatsApp SaaS Implementation Plan (Phased Approach)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the standalone Twilio WhatsApp integration into a multi-tenant SaaS application that supports both Meta and Twilio APIs, dynamic object mapping, strict license enforcement, real-time multimedia, and Omni-Channel routing.

**Architecture:** The project is split into sequential phases (sprints). Core data and API integrations come first, followed by widget enhancements, and concluding with advanced features like the Admin Dashboard, Omni-Channel, and the WhatsApp Web Inbox UI.
_Note: The current architecture is Twilio-only. We will implement dual-support (Twilio OR Meta Official API) making it switchable._

---

## Phase 1: Core Data Model & Configuration Foundation

_Sprint Goal: Set up the secure metadata and genericize the `WhatsAppMessage__c` object so it can attach to any record (Lead, Contact, Custom)._

### Task 1.1: License & Setting Metadata

- [ ] **Step 1:** Create Protected Hierarchy Custom Setting `App_License_Status__c` (Fields: `Status__c` Text).
- [ ] **Step 2:** Create Protected Custom Metadata Type `WhatsApp_Provider_Setting__mdt`.
      Fields: `Provider_Type__c` (Picklist: 'Twilio', 'Meta'), `Twilio_Account_SID__c`, `Twilio_Auth_Token__c`, `Meta_App_ID__c`, `Meta_Access_Token__c`, `Phone_Number_ID__c`, `Business_Phone_Number__c`.
- [ ] **Step 3:** Create Protected Custom Metadata Type `WhatsApp_Object_Mapping__mdt`.
      Fields: `Object_API_Name__c`, `Primary_Phone_Field__c`, `Country_Code_Field__c` (Optional).

### Task 1.2: Polymorphic Message Object

- [ ] **Step 1:** Modify `WhatsAppMessage__c` object.
- [ ] **Step 2:** Delete the hardcoded `Contact__c` Master-Detail field.
- [ ] **Step 3:** Add `Parent_Record_Id__c` (Text 18) and `Parent_Object_API_Name__c` (Text 255).
- [ ] **Step 4:** Ensure the object OWD is set to **Private**.

---

## Phase 2: Dual API Integration (Twilio + Meta)

_Sprint Goal: Refactor the Apex controller to dynamically choose the API provider and handle incoming/outgoing messages for both Twilio and Meta Official API._

### Task 2.1: The Config & License Utility

- [ ] **Step 1:** Create `WhatsAppConfigUtil.cls`.
- [ ] **Step 2:** Implement `checkLicenseStatus()` to read `App_License_Status__c` and verify `UserInfo.isCurrentUserLicensed()`. Throw `AuraHandledException` if unlicensed.
- [ ] **Step 3:** Implement `getActiveProviderSettings()` to query `WhatsApp_Provider_Setting__mdt`.

### Task 2.2: Dual API Outbound Service

- [ ] **Step 1:** Create `WhatsAppOutboundService.cls`.
- [ ] **Step 2:** Port existing Twilio outbound logic into `sendViaTwilio(params)`.
- [ ] **Step 3:** Implement `sendViaMeta(params)` using the official WhatsApp Cloud API endpoint (`https://graph.facebook.com/v17.0/{Phone_Number_ID}/messages`).
- [ ] **Step 4:** Create a master `sendMessage(recordId, objectApiName, message, mediaUrl)` method that: 1. Checks license. 2. Gets dynamic phone number via `WhatsApp_Object_Mapping__mdt`. 3. Checks the active provider (Twilio or Meta) and routes to the correct send method.

### Task 2.3: Dual Webhook Listener

- [ ] **Step 1:** Refactor `@RestResource` in `WhatsAppChatController.cls`.
- [ ] **Step 2:** Implement signature validation for both Twilio (`X-Twilio-Signature`) and Meta (`X-Hub-Signature-256`).
- [ ] **Step 3:** Parse incoming payloads dynamically based on the provider format.
- [ ] **Step 4:** Dynamically search across all mapped objects (Lead, Contact, etc.) to find the matching `Parent_Record_Id__c` for the incoming phone number.

---

## Phase 3: The Universal LWC Chat Widget

_Sprint Goal: Upgrade the existing LWC to sit on any record page, handle multimedia, and enforce the 24-hour compliance rule._

### Task 3.1: Dynamic Context & Number Selection

- [ ] **Step 1:** Update `whatsappChatWidget.js` to accept standard `@api recordId` and `@api objectApiName`.
- [ ] **Step 2:** Add a UI dropdown allowing the user to select which phone number to text (e.g., Mobile vs Alternate) if multiple fields are mapped.

### Task 3.2: Message Metadata & UI Polish

- [ ] **Step 1:** Update the message renderer to clearly stamp the Sender's Name (Salesforce User or Customer) on each bubble.
- [ ] **Step 2:** Ensure delivery status (Sent, Delivered, Read) with WhatsApp-style checkmarks is displayed correctly based on the webhook status.
- [ ] **Step 3:** Ensure the widget is fully responsive for Desktop sidebars, Tablets, and the Salesforce Mobile App.

### Task 3.3: 24-Hour Rule Compliance

- [ ] **Step 1:** Add a getter `get is24HourWindowOpen()` in JS. Calculate difference between `lastMessageTimestamp` (if Inbound) and `Date.now()`.
- [ ] **Step 2:** Add UI countdown timer (e.g., "14h 30m remaining").
- [ ] **Step 3:** If the window is closed, disable the text `<textarea>` and show a "Send Template" button.

### Task 3.4: Multimedia Support

- [ ] **Step 1:** Add file upload UI for Audio, Video, and PDF.
- [ ] **Step 2:** Pass base64 data to Apex, save as `ContentVersion` (Salesforce Files), and generate a Public Link.
- [ ] **Step 3:** Update the chat history renderer to display `<audio>`, `<video>`, and `<embed>` (PDF) tags natively in the chat bubbles.

---

## Phase 4: Advanced Features (Omni-Channel & Inbox UI)

_Sprint Goal: Implement the Enterprise features: routing unassigned leads, global notifications, the Admin Setup Wizard, and the full-page WhatsApp Inbox._

### Task 4.1: Omni-Channel Routing for Unlicensed Owners

- [ ] **Step 1:** In the webhook listener, after finding the `Parent_Record_Id__c`, check if the `OwnerId` has an active Widget License.
- [ ] **Step 2:** If unlicensed (or unassigned), do NOT assign the message to the current owner.
- [ ] **Step 3:** Create a `PendingServiceRouting` record linked to the `WhatsAppMessage__c` and push it to a predefined Omni-Channel "WhatsApp Queue".
- [ ] **Step 4:** Create an Apex Trigger on `AgentWork` (or use Omni-Channel flows) so when a licensed agent accepts the chat, the parent Lead/Contact ownership is instantly transferred to that agent.

### Task 4.2: Global Notifications (Utility Bar)

- [x] **Step 1:** Create LWC `whatsappGlobalNotification` targeting `lightning__UtilityBar`.
- [ ] **Step 2:** Subscribe to `NewWhatsAppMessage__e`. If an event fires for a record owned by the current user, increment an unread badge using `lightning/platformUtilityBarApi`.

### Task 4.3: The "WhatsApp Inbox" LWC

- [ ] **Step 1:** Create a full-page LWC `whatsappInbox`.
- [ ] **Step 2:** Build the Left Pane: List all active conversations (grouped by Parent Record) sorted by latest message timestamp, showing unread badges.
- [ ] **Step 3:** Build the Right Pane: Embed the refactored `whatsappChatWidget` component, dynamically passing the `recordId` selected from the Left Pane.

### Task 4.4: The Admin Dashboard (Setup Wizard)

- [x] **Step 1:** Create LWC `whatsappAdminDashboard`.
- [ ] **Step 2:** Build UI tabs for: - **API Config:** Input Twilio/Meta keys. - **Object Mapping:** Select Object, Primary Phone Field, Country Code Field. - **Template Sync:** Fetch and view approved Meta templates. - **Archive Settings:** Set rules for auto-deleting media > 6 months old.
- [ ] **Step 3:** Connect the UI to Apex controllers that save settings to the Custom Metadata Types created in Phase 1.
