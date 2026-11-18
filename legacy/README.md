# Legacy / Archive

These projects are **not part of the active package**. They are kept for reference only.

| Path | Why archived |
|---|---|
| `legacy/prototype-force-app/` | The previous Salesforce DX prototype. It is not deployable (empty field metadata, invalid XML, missing platform event, broken LWC, no tests). Useful as a design reference for the chat UI, phone matching, status updates, and inbox concepts. |
| `legacy/whatsappWidget_1/` | Original LWC + Node/Socket.IO prototype. |
| `legacy/WhatsappWidget_BE-main/` | Node/Express + MongoDB + Twilio backend. Conflicts with the Salesforce-native requirement. |
| `legacy/whatsappMiddleware_2/` | Earlier duplicate of the Node backend. |
| `legacy/stale-docs/` | Old plan/spec, configuration guide, and Salesforce template leftovers. |

Do not import code from these folders into `force-app/` without reviewing it against the target architecture and security requirements.

To remove them permanently later:

```bash
git rm -r legacy/
```

(Coordinate with the team before rewriting git history; some of these blobs are large.)
