# WhatsApp Integration SaaS Design Specification

## Overview
This specification details the transformation of a single-org Salesforce WhatsApp integration into a commercial, multi-tenant SaaS application (AppExchange Managed Package). The application allows users to connect either the Official WhatsApp Cloud API (Meta) or Twilio, providing a rich, real-time messaging interface directly within Salesforce records.

## 1. Security & Monetization (License Enforcement)
*   **AppExchange LMA:** The package will be distributed using the License Management Application (LMA). Salesforce physically restricts access so that if a client pays for 2 licenses, only 2 users can be assigned the package license.
*   **Hub Telemetry:** A scheduled Apex job will securely ping a central external Hub (owned by the ISV) daily with usage statistics (message volume, active users).
*   **Heartbeat Lock:** If the Hub indicates an unpaid status, a Protected Custom Setting (`App_Status__c`) is flipped to `LOCKED`. The LWC widget will check this setting on initialization and display a hard block ("Subscription Expired") if locked.

## 2. Admin Configuration App (Setup Wizard)
A dedicated Lightning App available only to System Administrators for configuring the package.

### 2.1 Provider Configuration
*   **API Selection:** Toggle between [Official WhatsApp Cloud API] and [Twilio].
*   **Credential Storage:** Securely store Meta App ID/Token or Twilio SID/Token in Protected Custom Metadata Types.
*   **Visibility Settings:** Toggle to show/hide the connected business phone number in the widget UI.

### 2.2 Object & Field Mapping
*   **Dynamic Object Selection:** Admin selects which objects the widget can be placed on (e.g., Lead, Contact, Account, Custom Objects).
*   **Phone Field Mapping:** For each selected object, the Admin can map multiple phone fields (e.g., `Phone`, `MobilePhone`, `WhatsApp_Number__c`).
*   **Country Code Mapping:** Optional configuration to map a separate field that holds the country code, which the Apex controller will concatenate with the phone number at runtime.

### 2.3 Template Management
*   **Template Syncing:** A UI to fetch and display approved templates directly from the Meta/Twilio API.
*   **Template Creation:** A form to create new templates (with variables) and submit them to Meta for approval directly from Salesforce.
*   **Template Status:** Display approval status (Approved, Pending, Rejected) for each template.

## 3. The Chat Widget (LWC)

### 3.1 UI/UX & Responsiveness
*   **Form Factor:** The widget will be built as a responsive LWC, compatible with desktop (record page sidebar), tablets, and the Salesforce Mobile App.
*   **Number Selection:** If the Admin mapped multiple phone fields (e.g., Mobile, Alternate, WhatsApp), the widget will display a dropdown allowing the user to select which number to send the message to.
*   **Message Metadata:** Each message bubble will clearly stamp:
    *   The sender's name (which Salesforce user sent it, or if it was inbound).
    *   Timestamp.
    *   Delivery Status (Sent, Delivered, Read) with native WhatsApp-style checkmarks.
    *   Date/Time separator lines (e.g., "TODAY", "YESTERDAY").

### 3.2 Real-Time Communication
*   **Platform Events:** Utilizes `empApi` to subscribe to a custom Platform Event (`NewWhatsAppMessage__e`).
*   **Inbound Webhooks:** A secure `@RestResource` endpoint receives webhooks from Meta/Twilio and publishes the Platform Event, ensuring the chat UI updates instantly without a page refresh.

### 3.3 Rich Media Support
*   **Sending Media:** Users can upload images, PDFs, short audio, and short video files. The LWC will pass these to Apex, which will upload them to Salesforce Files (ContentVersion) and generate a public URL to pass to the WhatsApp API.
*   **Receiving Media:** Inbound webhooks containing media URLs will be processed. The LWC will use standard HTML5 tags (`<audio>`, `<video>`, `<img>`, `<embed>`) to stream and display the media directly in the chat history.

## 4. Data Architecture & Storage

*   **WhatsApp_Message__c (Custom Object):**
    *   Stores individual messages.
    *   **Polymorphic Linking:** Uses `Parent_Record_Id__c` (Text/18) instead of a hardcoded lookup, allowing messages to link to *any* Salesforce object dynamically.
    *   Stores direction, status, timestamps, media URLs, and the sender's User lookup.
*   **Accessibility:** Because messages are stored in a standard Custom Object, Salesforce Admins can easily build standard Salesforce Reports and Dashboards to audit chat history, agent response times, and message volume.

## 5. Compliance & Advanced Features

### 5.1 The WhatsApp 24-Hour Customer Service Window
Meta enforces a strict rule where businesses can only send free-form messages within 24 hours of a customer's last inbound message. Outside this window, only pre-approved templates are allowed.
*   **Countdown Timer UI:** The chat widget will display a real-time countdown (e.g., "⏱️ 14h 30m remaining to reply") based on the timestamp of the last inbound message.
*   **Auto-Lock Input:** Once the 24-hour window expires, the standard text input box and media upload buttons will automatically disable. The UI will prompt the agent with a "Send Template" button, enforcing Meta's compliance rules at the UI level.

### 5.2 Chat History Archiving (Storage Management)
To prevent customers from hitting their Salesforce data and file storage limits (which are expensive), the app includes automated archiving.
*   **Auto-Archive Batch Job:** In the Admin Setup Wizard, admins can configure retention policies:
    *   *Example:* "Delete Media Files older than [ 6 ] months."
    *   *Example:* "Export chat history to PDF, attach to the parent record, and delete individual `WhatsApp_Message__c` records after [ 1 ] year."
*   **Scheduled Execution:** A daily Apex Scheduled Job will run these rules automatically in the background.

## 6. Omni-Channel Routing & The "WhatsApp Inbox"

### 6.1 Unassigned & Unlicensed Lead Routing
*   **Data Silos:** The sharing model is set to Private. Agents only see messages for leads they own.
*   **Omni-Channel Fallback:** If an inbound message arrives for a Lead owned by an unlicensed user (e.g., a default Admin owner), the webhook creates a `PendingServiceRouting` record.
*   **Agent Reassignment:** The message is pushed to a "WhatsApp Queue" via Omni-Channel. When a licensed agent accepts the work item, Salesforce automatically reassigns ownership of the Lead to that agent, granting them immediate access to the chat history.

### 6.2 The "WhatsApp Inbox" LWC (WhatsApp Web Clone)
In addition to the record-level widget, the app provides a full-page "Inbox" experience.
*   **Two-Pane Layout:** A custom LWC tab that mimics WhatsApp Web. The left pane shows a list of all active conversations (grouped by Lead/Contact) sorted by the most recent message. The right pane shows the full chat history for the selected conversation.
*   **Unread Indicators:** The left pane displays unread message badges.
*   **Global Access:** Agents can manage 20 different conversations simultaneously from this single UI without needing to open 20 different Lead records.

### 6.3 Global Notifications & Utility Bar
Agents must know when a customer messages them, even if they are viewing a completely different record.
*   **Utility Bar Component:** The app will include a small LWC designed for the Salesforce Utility Bar (the persistent bar at the bottom of the screen). It acts as a global notification hub. If the agent is on Lead #2 and Lead #1 sends a message, the Utility Bar icon will flash/badge with an unread count.
*   **Native Custom Notifications:** Admins will have a configuration option to route alerts to Salesforce's native "Bell" icon (Custom Notification Type) instead of, or in addition to, the custom Utility Bar component. Clicking the notification will route the agent directly to the relevant Lead record or the WhatsApp Inbox.

## 7. Brainstorming: Missing Features & Considerations

*   **Opt-Out / Consent Management:** Critical for compliance (GDPR/TCPA). We need a mechanism to flag a record as "Do Not WhatsApp" and physically block the widget from sending outbound messages to that number.
*   **Concurrent Webhook Limits:** High volumes of incoming messages could hit Apex concurrent execution limits. The webhook should immediately insert a raw staging record and use an asynchronous Platform Event Trigger to process the actual logic and media downloading.