# WhatsApp for Salesforce — Scope Questionnaire

Answer as many as you can. Mark **TBD** if unknown. Recommended defaults are in parentheses.
The goal is to lock the **commercial scope**, **architecture**, and **v1 feature set** before cleanup/rewrite.

---

## A. Commercial model & packaging

1. Is this an **AppExchange product** for many customers, an **internal package** for one company, or both?
   - (Recommended: 2GP managed package for AppExchange; unlocked for internal/demo.)
2. Do you already have a **Salesforce Partner Program** account, a **namespace prefix**, a **Dev Hub**, and an **LMO (License Management Org)**?
3. If AppExchange: what is the target **launch date**, and who owns the **security review** submission?
4. Do you want **LMA seat licensing** only, or also **feature-based licensing** (per module: templates, marketing, analytics, omnichannel)?
5. Do you need **trial licenses**, **expiry**, or **usage-based billing**?
   - (No backend = no telemetry; LMA only. Usage billing would need a server or Salesforce add-on.)
6. Should the package be **branded** (your logo/name) or **white-label** for partners?
7. Do you need an **EULA**, **privacy policy**, **DPA**, **support/SLA**, and **documentation** ready for listing?
8. Who are the target buyers: **SMB**, **mid-market**, **enterprise**, or **specific industries** (financial services, healthcare, retail, logistics)?
9. Do you have **reference customers / design partners** for beta?
10. What is the **pricing model** (per user/month, per org/month, per message, tiered)?

## B. Provider & Meta onboarding

11. Must the package support **Meta Cloud API only**, or also **Twilio** and other BSPs?
    - (Recommended: Meta Cloud API direct for v1; BSP abstraction later. Twilio cannot expose every WABA feature.)
12. Will each customer bring **their own Meta app, WABA/Messaging account, phone number, and System User token**, or will you be a **Meta Tech Provider** with **Embedded Signup**?
    - (Recommended: manual "bring your own Meta app" for v1; Embedded Signup in phase 4.)
13. Do you already have a **Meta Business portfolio**, **verified business**, **app review** for `whatsapp_business_messaging` and `whatsapp_business_management`, and a **production phone number**?
14. Do you need **Embedded Signup** (customer clicks "Connect WhatsApp" inside Salesforce), or is a **setup wizard with pasted credentials** acceptable?
15. Do you need **Coexistence** with the WhatsApp Business app (same number used in both app and Cloud API)?
16. Do you need **multiple WABAs / Messaging accounts / phone numbers per Salesforce org**? How many?
17. Do you need **per-country / per-brand phone numbers** with routing rules?
18. Do you need **Meta Business Agent** or **Conversation Routing** partner features?
19. Do you need **WhatsApp Calling** (voice/video)? If yes, what telephony/WebRTC stack will provide the media path?
    - (Apex/LWC cannot carry call media; this requires SIP/WebRTC or Service Cloud Voice.)
20. Do you need **WhatsApp Payments** (India/Brazil/Mexico)? If yes, which payment provider?

## C. Salesforce clouds & routing

21. Primary cloud: **Sales Cloud**, **Service Cloud**, **both**, or **platform/custom**?
22. Should inbound messages create/update a **Lead**, **Contact**, **Case**, **custom object**, or just a WhatsApp profile?
23. If a phone number is unknown, what should happen?
    - Create Lead (recommended), create Contact, create WhatsApp Profile only, route to queue, or ignore.
24. Should each conversation create a **Case**? Per conversation, per inbound message, or manual?
25. Routing model:
    - Queue/assignment rules (recommended v1)
    - Omni-Channel Flow / skills-based routing
    - Round-robin / capacity-based custom routing
    - Manual claim from inbox
26. Do you need **Omni-Channel** specifically, or is Case ownership/queue enough?
27. Do you need **Service Console** integration (side panel, tabs, utility bar, macros, quick text, knowledge)?
28. Do you need **Entitlements/Milestones/SLAs**?
29. Do you need **Knowledge** article suggestions in the chat?
30. Do you need **Salesforce Quick Text** or a package-owned canned-response object?
31. Do you need **transfer between agents/queues**, internal notes, mentions, or collaboration?
32. Do you need **supervisor** views (all conversations, reassignment, SLA breaches)?
33. Do you need **Agentforce / Einstein** suggested replies, summarization, or autonomous agents?
34. Do you need **Experience Cloud** (portal users) access to chat? (Usually no.)

## D. Data model & records

35. Should messages link to **any Salesforce object** (polymorphic) or only Lead/Contact/Account/Case?
36. Should the package add **custom fields** to standard objects (e.g., `WhatsApp_Number__c`, `WhatsApp_Opt_In__c`) or avoid changing standard objects?
37. Should a WhatsApp identity be a separate **`WhatsApp_Profile__c`** (recommended) or fields on Lead/Contact?
38. Should a conversation be a separate **`WhatsApp_Conversation__c`** (recommended) or derived from messages?
39. How long must messages/media be retained? Any **legal hold** or **eDiscovery** requirements?
40. Do you need **Field Audit Trail / Shield Platform Encryption**?
41. Do you need **GDPR export/delete** by phone/BSUID? Any data residency constraints?
42. Do you need **per-user read state** for a shared inbox, or is a single read flag enough?
43. Do you need **message status history** (queued/sent/delivered/read/failed with timestamps) for audit? (Recommended yes.)
44. Do you need **cost/pricing tracking** per message/conversation (Meta per-message pricing)? (Recommended yes.)
45. Do you need **CTWA ad attribution** (ad ID, click ID, referral source)?
46. Do you need **BSUID/username** support where phone numbers are hidden? (Recommended yes.)
47. How many messages/month and conversations/month do you expect at launch and in year one?
48. How many concurrent agents? How many phone numbers? How many WABAs?
49. What is the peak messages/minute? (This determines Site/Platform Event/Apex design.)
50. Do you need **data migration** from the existing Node/MongoDB/Twilio system? If yes, how much data?

## E. Messaging features (v1 scope)

51. Which outbound message types must v1 support?
    - Text (recommended v1)
    - Image/audio/video/document (recommended v1)
    - Template (recommended v1)
    - Location/contacts (v1 or v2)
    - Interactive buttons/list (v2)
    - Reaction/reply (v2)
    - Flows (v3)
    - Catalog/product/order (v4)
    - Payments (v4)
52. Which inbound message types must v1 render?
    - Text/status (v1)
    - Media (v1)
    - Interactive replies (v2)
    - Location/contacts (v2)
    - Reaction/reply (v2)
    - System/unsupported/errors (v2)
    - Flow responses (v3)
    - Orders (v4)
53. Do you need **mark as read** (blue ticks for the customer)? (Recommended yes.)
54. Do you need **typing indicators**? (Verify current API; likely v3.)
55. Do you need **link previews**? (Recommended yes, toggle.)
56. Do you need **message editing/deletion/revoke**? (Limited by API; v3.)
57. Do you need **group chats**? (v4)
58. Do you need **broadcast/bulk campaigns**? If yes, how many recipients, and do you need Marketing Messages API/MM Lite?
59. Do you need **scheduled messages**? (v3)
60. Do you need **canned responses/quick replies**? (v2)
61. Do you need **message templates with variables, media headers, buttons, carousels, auth/coupon/LTO**? Which types first?
62. Do you need a **template builder** inside Salesforce, or is syncing/using templates from Meta Business Manager enough?
63. Who approves template creation: Salesforce admin, marketing team, or Meta only?

## F. Media

64. What is the largest inbound media file you must store in Salesforce? (Apex limit ~12 MB; WhatsApp documents can be 100 MB.)
65. What is the largest outbound media file you must send? (Outbound can use a short-lived Salesforce ContentDistribution link; no Apex heap limit.)
66. Which media types are must-have: images, PDFs, Office docs, audio, video, stickers?
67. Do you need **in-app preview** for PDFs/Office docs, or is download enough?
68. Do you need **virus scanning**? (Not native; requires a third-party service.)
69. Do you need media **retention/archival** separate from messages?
70. Is it acceptable to tell agents "file too large to import; ask the customer to resend under 12 MB" for large inbound files?

## G. Templates & compliance

71. Which template categories do you need: Marketing, Utility, Authentication, all?
72. Do you need **authentication templates** (OTP/copy code/one-tap/zero-tap) for a specific use case?
73. Do you need **coupon codes**, **limited-time offers**, **carousels**, **catalog templates**?
74. Do you need **multi-language templates**? Which languages/locales?
75. Do you need **opt-in capture** from web forms, imports, Salesforce fields, inbound keywords, or all?
76. Do you need **marketing opt-in** separate from **transactional/utility** consent?
77. What are your **STOP/START keywords** and languages?
78. Do you need a **consent proof** field (source URL, timestamp, IP, screenshot/file)?
79. Do you need to **block all outbound** after opt-out, or only marketing?
80. Do you need **24-hour window** enforcement server-side and in UI? (Recommended yes.)
81. Do you need **CTWA free entry point** tracking and pricing? (v3)
82. Do you need **per-user marketing template limits** and **quality/pacing** handling? (v3/v4)
83. Do you need **Meta policy violation alerts** and **account restriction** handling? (Recommended yes.)

## H. UX & branding

84. Should the chat look like **WhatsApp** (green bubbles, wallpaper) or **SLDS-native** with WhatsApp accents?
    - (Recommended: SLDS-native, WhatsApp-inspired, dark-mode ready.)
85. Where should the chat live: **record page only**, **floating launcher**, **Service Console side panel**, **full-page inbox**, **utility bar**, or all?
86. Do you need **mobile** support in the Salesforce Mobile app? (Recommended yes.)
87. Do you need **tablet** layouts?
88. Do you need **dark mode**?
89. Do you need **RTL** and **multi-language UI**?
90. Do you need **accessibility** WCAG 2.1 AA? (Recommended yes; AppExchange review expects it.)
91. Do you need **custom branding** (logo, colors, welcome message)?
92. Do you need **agent avatars / customer avatars**? (WhatsApp profile photos are not exposed by Cloud API; use initials/icons.)
93. Do you need **unread badges** in the utility bar and inbox? (Recommended yes.)
94. Do you need **desktop notifications** or only in-app bell/utility bar?
95. Do you need **sound notifications**? (Browser limitations; optional.)

## I. Security, compliance & operations

96. Do you need **Shield Platform Encryption**, **Field Audit Trail**, or **Event Monitoring**?
97. Do you need **HIPAA**, **PCI**, **SOC 2**, **ISO 27001**, **FedRAMP**, or **GDPR** compliance documentation?
98. Do you need **data residency** in a specific region (Hyperforce)?
99. Do you need **IP allowlisting** or **mTLS** for webhooks? (Meta supports mTLS; Salesforce Sites support varies.)
100.  Do you need **SSO** for agents? (Salesforce handles it.)
101.  What is the **support model** (24/7, business hours, community)?
102.  What is the **SLA** for message delivery/uptime?
103.  Do you need **audit logs** for admin config changes, consent overrides, and message access?
104.  Who can read message content: all agents, assigned agents, admins only, or permission-set based?
105.  Do you need **data masking** for phone numbers/emails in logs?
106.  Do you need **backup/restore** for WhatsApp data? (Salesforce backup or third-party.)
107.  Do you need **disaster recovery** / sandbox refresh strategy?
108.  Do you need **org migration** between sandboxes/production? How will credentials move?

## J. Delivery, team & timeline

109. Who is on the team: Salesforce dev, LWC dev, QA, architect, designer, DevOps, security reviewer?
110. What is the **budget** and **timeline**?
111. What is the **release cadence** (monthly, quarterly)?
112. Do you have **scratch orgs / sandboxes / Dev Hub / CI** already?
113. Which **source control** and CI (GitHub, GitLab, Azure DevOps, Bitbucket)?
114. Do you need **AppExchange security review** support, or will another team handle it?
115. Do you need **training/documentation** for admins/agents?
116. Do you need a **demo org / demo data / video** for sales?
117. What is the **success metric** (time to first response, resolution time, deflection, revenue, adoption)?
118. What are the **top 3 must-have features** for launch?
119. What are the **top 3 things you will not compromise on** (security, UX, speed, price, features)?
120. What would make you **delay launch**?

---

## Quick priority vote (pick one per row)

| Decision      | Options                                                                 | Your choice |
| ------------- | ----------------------------------------------------------------------- | ----------- |
| Packaging     | AppExchange managed / internal unlocked / both                          |             |
| Provider      | Meta direct / Meta + Twilio / Twilio only                               |             |
| Onboarding    | Manual credentials / Embedded Signup / both                             |             |
| Primary cloud | Sales / Service / both                                                  |             |
| Routing       | Case queue / Omni-Channel / custom inbox                                |             |
| v1 scope      | Core messaging / + templates+media / + inbox+notifications / everything |             |
| Media ceiling | 10 MB / 12 MB / must support 100 MB (needs backend)                     |             |
| Licensing     | LMA only / LMA + feature permissions / custom                           |             |
| UI style      | WhatsApp clone / SLDS-native / hybrid                                   |             |
| Compliance    | GDPR / HIPAA / PCI / none                                               |             |
| Languages     | English / multi-language (list)                                         |             |
| Timeline      | 3 months / 6 months / 12 months                                         |             |
