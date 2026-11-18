# Partner Application Guide — Solo Developer / Individual

This guide explains how to apply as an individual or solo developer for:

1. **Salesforce ISV Partner** (to list on AgentExchange / AppExchange).
2. **Meta Tech Provider** (to use Embedded Signup and manage client WhatsApp accounts).
3. **Meta Solution Partner / Reseller add-on** (to get a credit line and re-bill clients).

> Requirements and fees change. Always confirm with Salesforce/Meta before paying for a legal entity or filing documents. This is a practical checklist, not legal advice.

---

## 1. The short answer for a solo developer

You can start building **today** as an individual with:

- A Salesforce Developer Edition / scratch org.
- A Meta developer account, app, test WhatsApp number, and test business portfolio.

To **sell** and **onboard clients** commercially, you will almost certainly need:

- A **legal business identity** (sole proprietorship or LLC/limited company).
- A **business email/domain**, website, privacy policy, and terms.
- A **Salesforce Partner Community** account and commercial agreement.
- A **Meta verified business** and **Tech Provider** status.
- A **security review** for the Salesforce package.
- Eventually a **Meta Solution Partner** agreement/credit line for re-billing.

**Sequence:** build a working pilot → form/register the business → apply for Salesforce Partner Community → verify the Meta business → Tech Provider/App Review → security review → list → apply for Solution Partner/credit line.

---

## 2. Salesforce ISV Partner (AgentExchange / AppExchange)

### 2.1 What it is

Salesforce's ISV track for companies that build apps/agents and list them on **AgentExchange** (the new name for AppExchange). The official page: [Become a Salesforce ISV Partner](https://www.salesforce.com/partners/become-an-isv-partner/).

### 2.2 Official five steps

From Salesforce's ISV page:

1. **Join the Partner Community** — [signup](https://partners.salesforce.com/pdx/s/signup).
2. **Build your solution.**
3. **Execute a commercial agreement.**
4. **Complete the security review.**
5. **Publish your listing on AgentExchange.**

### 2.3 What a solo developer needs

- **Business identity**: Partner Community login is tied to your partner business profile. A sole proprietorship can work in many regions, but you need a business name, address, phone, email, website, and tax/billing details. If your country requires a registered entity for B2B contracts, form an LLC/limited company.
- **Business email/domain**: avoid Gmail/Yahoo for the partner application; use `you@yourdomain.com`.
- **Website + privacy policy + terms**: required for the listing and Meta app review.
- **Support/SLA plan**: even a solo developer needs a support email and response expectations.
- **Security review readiness**: CRUD/FLS, no `innerHTML`, guest-user hardening, tests, secrets management, accessibility.
- **Technical assets**: Dev Hub, namespace, LMO/LMA, 2GP managed package, CI/CD.
- **Revenue share/fees**: Salesforce's commercial model includes a revenue-share fee; confirm current terms with the partner team.

### 2.4 Practical checklist

- [ ] Decide business name and legal structure (sole proprietor vs LLC/limited company).
- [ ] Register the business and get tax/billing details.
- [ ] Buy a domain and set up a business email.
- [ ] Publish a simple website with product, privacy policy, terms, and contact.
- [ ] Join the [Partner Community](https://partners.salesforce.com/pdx/s/signup).
- [ ] Apply to the ISV/AppExchange track and sign the commercial agreement.
- [ ] Get a Partner Developer Edition/Dev Hub and register a namespace.
- [ ] Create the LMO and install LMA.
- [ ] Build and test the package.
- [ ] Complete the security review.
- [ ] Publish the AgentExchange listing.

### 2.5 Can I apply as an individual without a company?

You can **start the Partner Community signup** and build with a Developer Edition, but the commercial agreement and listing generally require a **business identity**. If you don't have a company yet:

- Start with a **sole proprietorship** (if your country allows) and a business bank account.
- Or form a simple LLC/limited company.
- Use the business name consistently across Salesforce, Meta, your website, and bank/tax documents.
- Ask the Salesforce partner team specifically what they accept in your country before filing.

---

## 3. Meta Tech Provider

### 3.1 What it is

A **Tech Provider** builds WhatsApp solutions for clients, can use **Embedded Signup**, and manages client WhatsApp accounts. It does **not** get a Meta credit line by default; clients pay Meta directly (their card on their Messaging account).

Official guide: [Become a Tech Provider](https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/get-started-for-tech-providers).

### 3.2 Requirements

- A **Meta app** with the WhatsApp use case.
- A **business portfolio** linked to the app.
- **Business verification** (business name, address, phone, email, website, documents).
- **App Review** with **Advanced access** to:
  - `whatsapp_business_messaging` — send messages on behalf of clients.
  - `whatsapp_business_management` — manage client WhatsApp/Messaging accounts.
- App Review evidence:
  - Video showing a message created/sent from your app and received in WhatsApp.
  - Video showing template creation in your app.
  - App icon, privacy policy, category, and documentation.
- Tech Provider onboarding in **App Dashboard → Use cases → Customize → WhatsApp → Tech Provider onboarding**.
- A System User and a production phone number for testing/production.

### 3.3 Can a solo developer become a Tech Provider?

Yes, if you have a **verified business**. Meta's business verification is the gate; it generally expects a real business identity, not a personal profile. A sole proprietorship with business documents may work, depending on your country. If you don't have a business yet:

- Register a sole proprietorship/LLC.
- Create a business portfolio in Meta Business Suite using the business name.
- Verify the business with documents (registration, tax, utility bill, website, etc.).
- Then start App Review.

### 3.4 Embedded Signup

After Tech Provider approval:

- Configure Embedded Signup in the Meta app (`config_id`, allowed domains, privacy policy, data deletion callback).
- Implement the Facebook JS SDK + Apex token exchange in the package.
- Clients click "Connect WhatsApp" in Salesforce; Meta onboards their WABA/Messaging account and phone number.

---

## 4. Meta Solution Partner / Reseller add-on / BSP

### 4.1 What it is

The old **BSP (Business Solution Provider)** term is now split into:

- **Tech Provider** — builds/onboards clients; clients pay Meta directly.
- **Solution Partner / Technology Partner with Reseller add-on** — can have a **credit line**, pay Meta, and re-bill clients.

Official guide: [Get started as a Technology Partner with the Reseller add-on](https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/get-started-for-solution-partners).

### 4.2 Requirements (practical)

- **Tech Provider status first** (business verification + App Review).
- A **business portfolio**, **WhatsApp account (WABA)**, **Messaging account**, **Meta app**, **System User**, and **business phone number**.
- **Meta app review** for advanced permissions; you may reuse one app across clients, but each app has one webhook endpoint.
- **Contracts/Terms of Service** with Meta (accept in WhatsApp Manager).
- **Credit line / billing setup** with Meta; this is a commercial agreement, not self-serve.
- **Integration requirements**: Embedded Signup, webhooks, template management, phone registration, support, security/compliance.
- **Volume/business review**: Meta evaluates your business, technical capability, and support model. Expect a partner manager conversation.
- **Ongoing compliance**: WhatsApp Business Messaging Policy, data processing, support SLAs, monthly Cloud API updates.

### 4.3 Can a solo developer get a credit line?

It is **harder**. Meta generally expects:

- A verified business/legal entity.
- A track record (onboarded clients, message volume, support capability).
- A signed partner/reseller agreement and credit check.
- Financial/operational ability to carry credit risk.

A realistic path:

1. Become a **Tech Provider**.
2. Onboard clients with **their own cards** on their Messaging accounts (client-paid model).
3. Build volume and references.
4. Apply for the **Solution Partner/Reseller add-on** when you have a legal entity, volume, and support processes.
5. Only then add re-billing/credit-line features.

### 4.4 Billing model for now

- **Seat subscription** via Salesforce LMA.
- **Client pays Meta directly** with their card on their own Messaging account.
- The package stores **usage/pricing** from webhooks for dashboards and future re-billing.
- **Do not** build card charging or store card data now. Add invoicing/payment integration later when the credit line is approved.
- This matches your instruction: "billing add mat karo abhi pehle product ready karo pura."

---

## 5. Recommended sequence for you

| Step | Action                                                                         | Why                                                          |
| ---- | ------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| 1    | Register a sole proprietorship/LLC and business bank account                   | Required for partner agreements, Meta verification, payouts. |
| 2    | Buy a domain, set up business email, website, privacy policy, terms            | Required for Salesforce listing and Meta App Review.         |
| 3    | Join Salesforce Partner Community and apply to ISV track                       | Starts the commercial/partner process.                       |
| 4    | Get Partner Developer Edition/Dev Hub, register namespace, create LMO          | Unblocks the managed package.                                |
| 5    | Create Meta Business portfolio, verify business, create Meta app + test number | Unblocks Tech Provider/App Review.                           |
| 6    | Build the package (this repo)                                                  | Core product.                                                |
| 7    | Record App Review videos (send message, create template)                       | Required for Tech Provider.                                  |
| 8    | Complete Tech Provider onboarding + Embedded Signup                            | Enables client self-onboarding.                              |
| 9    | Complete Salesforce security review                                            | Required for AgentExchange listing.                          |
| 10   | Launch with client-paid Meta + seat subscription                               | No credit line needed.                                       |
| 11   | Apply for Solution Partner/credit line after traction                          | Enables re-billing later.                                    |

---

## 6. Links

### Salesforce

- Become an ISV Partner: https://www.salesforce.com/partners/become-an-isv-partner/
- Partner Community signup: https://partners.salesforce.com/pdx/s/signup
- ISV onboarding guide: https://www.salesforce.com/partners/isv-onboarding-guide/
- AgentExchange: https://agentexchange.salesforce.com/
- AppExchange consulting: https://appexchange.salesforce.com/consulting

### Meta

- Tech Provider: https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/get-started-for-tech-providers
- Solution Partner / Reseller add-on: https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/get-started-for-solution-partners
- Embedded Signup: https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/overview
- App Review: https://developers.facebook.com/docs/app-review
- Business verification: https://www.facebook.com/business/help/2058515294227817
- WhatsApp Manager: https://business.facebook.com/wa/manage/
- Meta App Dashboard: https://developers.facebook.com/apps/

---

## 7. Reality check

- **Salesforce security review** is the longest Salesforce gate; start preparing tests/security early.
- **Meta business verification + App Review** is the longest Meta gate; start it before the code is perfect, using a working demo.
- **Credit line/reseller** is a commercial negotiation, not a checkbox. Plan for client-paid billing first.
- **Solo developer**: possible, but you are also the support team, security reviewer, and finance department. Keep the first release focused and document everything.
- **Do not promise Embedded Signup at launch** until Meta approves Tech Provider/App Review. If approval slips, the launch slips. Have a manual-credentials fallback for early design partners, even if the commercial launch is all-in-one.
