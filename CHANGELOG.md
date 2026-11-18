# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Enterprise analysis, scope questionnaire, decisions, configuration model, partner application guide, and packaging primer in `docs/`.
- Clean Salesforce DX project skeleton at the repository root.
- Custom permissions for Admin, Agent, Template Manager, and Bulk Send.
- Custom labels for the product and common UI strings.
- `WhatsAppConstants` Apex class and test.
- `WhatsApp_Settings__c` protected hierarchy custom setting (non-secret initial fields).
- `WhatsApp_Credential__c` private credential object (Long Text Area) for Meta tokens/secrets, because Custom Settings are limited to 255 characters.
- `WhatsApp_Event__e` platform event for real-time UI.
- Remote Site Settings for Meta Graph API and media CDN.

### Changed

- Archived the legacy Node/Express/MongoDB/Socket.IO prototypes under `legacy/`.
- Archived the previous broken `force-app` under `legacy/prototype-force-app/`.
- Replaced the malformed UTF-16 `.gitignore` with a proper UTF-8 ignore file.

### Removed

- Node middleware projects from the active build.
- Stale `docs/superpowers` plan/spec and `CONFIGURATION_GUIDE.md` from the active docs (kept under `legacy/stale-docs/`).
- Unused `utilityService.js` helper from the active package (kept in the legacy prototype).

## [0.1.0] - TBD

- First deployable package skeleton.
