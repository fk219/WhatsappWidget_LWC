# WhatsApp for Salesforce

Enterprise, Salesforce-native integration for the **WhatsApp Business Platform (Meta Cloud API)**.

> **Status: architecture / scaffolding.** The previous prototype is archived under `legacy/` and is not deployable. The new package is being built in `force-app/`.

## What this is

A Salesforce package that lets teams:

- Send and receive WhatsApp messages from Lead, Contact, Account, Case, and custom records.
- Manage approved templates, media, consent/opt-out, the 24-hour customer service window, and conversation routing.
- Work from a record-level chat, a full-page inbox, and a utility bar notification center.
- Run entirely inside the customer's Salesforce org:
  - Apex for logic and Graph API callouts
  - Salesforce Sites for the public webhook
  - Salesforce Files for media
  - Platform Events + `lightning/empApi` for real-time UI
  - LMA for licensing
  - **No Node/Express/MongoDB/Heroku/Render middleware**

## Documentation

| Document                                                                     | Purpose                                                                                                             |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| [`docs/ENTERPRISE_ANALYSIS.md`](docs/ENTERPRISE_ANALYSIS.md)                 | Current-state audit, target architecture, data model, WABA capability matrix, security, packaging, roadmap, tooling |
| [`docs/DECISIONS.md`](docs/DECISIONS.md)                                     | Recorded scope decisions and their implications                                                                     |
| [`docs/IMPLEMENTATION_STATUS.md`](docs/IMPLEMENTATION_STATUS.md)             | What is built, what is next, and current validation status                                                          |
| [`docs/CONFIGURATION_MODEL.md`](docs/CONFIGURATION_MODEL.md)                 | Setup app, object/field mapping, routing rules, business logic, no auto-send                                        |
| [`docs/PARTNER_APPLICATION_GUIDE.md`](docs/PARTNER_APPLICATION_GUIDE.md)     | Salesforce ISV, Meta Tech Provider, Solution Partner/credit line as a solo developer                                |
| [`docs/SCOPE_QUESTIONNAIRE.md`](docs/SCOPE_QUESTIONNAIRE.md)                 | 120-question scope questionnaire                                                                                    |
| [`docs/SALESFORCE_PACKAGING_PRIMER.md`](docs/SALESFORCE_PACKAGING_PRIMER.md) | Namespace, Dev Hub, LMO/LMA, 2GP, security review explained                                                         |

## Repository layout

```
force-app/                 # New package source
legacy/                    # Archived prototypes (reference only)
docs/                      # Architecture, scope, packaging docs
config/                    # Scratch org definition
manifest/                  # Deployment manifest
scripts/                   # Setup/deploy/test scripts
```

## Prerequisites

- Salesforce CLI (`sf`)
- A Dev Hub (for scratch orgs / 2GP packages)
- A Salesforce org with Service Cloud, Sales Cloud, Sites, and Platform Events
- A Meta WhatsApp Business Platform app, Messaging account, and phone number

## Quick start (source deployment, no package yet)

```bash
# 1. Install dependencies
npm install

# 2. Authorize your Dev Hub and create a scratch org
sf org login web --set-default-dev-hub --alias devhub
sf org create scratch --definition-file config/project-scratch-def.json --alias wa-dev --set-default

# 3. Deploy the package source
sf project deploy start --target-org wa-dev

# 4. Run Apex tests
sf apex run test --target-org wa-dev --code-coverage --result-format human

# 5. Run LWC unit tests
npm run test:unit
```

## Packaging

The namespace is intentionally blank until the Salesforce partner assets are registered. See [`docs/SALESFORCE_PACKAGING_PRIMER.md`](docs/SALESFORCE_PACKAGING_PRIMER.md). Do not create a managed package before the namespace is registered.

## Contributing

- Keep all logic inside Salesforce; no application middleware.
- No secrets in source, Custom Metadata records, or logs.
- No `innerHTML` / manual DOM in LWC.
- Enforce CRUD/FLS and use Named Credentials/Remote Site Settings for callouts.
- Add Apex tests and LWC Jest tests for every change.
- Run `npm run lint`, `npm run test:unit`, and `npm run scan` before opening a PR.

## License

Proprietary. All rights reserved until a license is selected.
