# Standalone WhatsApp Widget Configuration Guide

Welcome to the Standalone WhatsApp Widget project! Before deploying and running this widget in your Salesforce environment, you must configure your Twilio credentials within the Apex backend. 

For security reasons, the original hardcoded credentials were removed before pushing to this repository. This guide will walk you through exactly which keys were removed and where you need to paste your actual keys to make the widget functional again.

## Where to configure the keys?

All configuration happens inside the Apex Controller file located here:
`force-app/main/default/classes/WhatsAppChatController.cls`

Open this file and look at the top section (around lines 6 to 10). You will see the following configuration block:

```java
private static final String ACCOUNT_SID = 'YOUR_TWILIO_ACCOUNT_SID'; // Your Twilio Account SID
private static final String AUTH_TOKEN = 'YOUR_TWILIO_AUTH_TOKEN';    // Your Twilio Auth Token
private static final String TWILIO_PHONE_NUMBER = '+14155238886'; // Your Twilio WhatsApp-enabled phone number
private static final String ENDPOINT = 'https://api.twilio.com/2010-04-01/Accounts/' + ACCOUNT_SID + '/Messages.json';
private static final String TEMPLATE_CONTENT_SID = 'HX229f5a04fd0510ce1b071852155d3e75'; // Your Twilio Approved Template SID
```

## Which keys need to be pasted?

You need to replace the placeholder strings with your actual Twilio Account credentials. 

### 1. `ACCOUNT_SID`
* **What it is:** Your unique Twilio Account Identifier.
* **Where to find it:** On your Twilio Console Dashboard under "Account Info".
* **Action:** Replace `'YOUR_TWILIO_ACCOUNT_SID'` with your actual SID.

### 2. `AUTH_TOKEN`
* **What it is:** The secret token used to authenticate your Twilio API requests.
* **Where to find it:** On your Twilio Console Dashboard right below the Account SID.
* **Action:** Replace `'YOUR_TWILIO_AUTH_TOKEN'` with your actual Token.

### 3. `TWILIO_PHONE_NUMBER` (Optional Check)
* **What it is:** The WhatsApp sender number registered in your Twilio account.
* **Action:** Currently set to `'+14155238886'`. If your Twilio WhatsApp sender number changes, update it here.

### 4. `TEMPLATE_CONTENT_SID` (Optional Check)
* **What it is:** The SID for the pre-approved WhatsApp message template used when starting a new conversation outside the 24-hour window.
* **Action:** Currently set to `'HX229f5a04fd0510ce1b071852155d3e75'`. If you create a new template in Twilio, update this SID.

## Security Best Practices
While you can hardcode these directly into the Apex class for quick testing, **it is highly recommended** to store these values in Salesforce **Custom Metadata Types** or **Named Credentials** for a production environment. This prevents your secrets from being exposed in your codebase and makes it easier to change credentials without modifying and deploying Apex code.
