import { LightningElement, track } from "lwc";

export default class WhatsappAdminDashboard extends LightningElement {
  @track selectedProvider = "Twilio";

  @track twilioSid = "";
  @track twilioToken = "";
  @track metaAppId = "";
  @track metaToken = "";
  @track metaPhoneId = "";
  @track businessNumber = "";

  get providerOptions() {
    return [
      { label: "Twilio API", value: "Twilio" },
      { label: "Meta Official Cloud API", value: "Meta" }
    ];
  }

  get isTwilio() {
    return this.selectedProvider === "Twilio";
  }

  get isMeta() {
    return this.selectedProvider === "Meta";
  }

  handleProviderChange(event) {
    this.selectedProvider = event.detail.value;
  }

  handleInputChange(event) {
    const key = event.target.dataset.key;
    if (!key) return;
    this[key] = event.target.value;
  }

  handleSave() {
    this.dispatchEvent(
      new CustomEvent("save", {
        detail: {
          provider: this.selectedProvider,
          twilioSid: this.twilioSid,
          twilioToken: this.twilioToken,
          metaAppId: this.metaAppId,
          metaToken: this.metaToken,
          metaPhoneId: this.metaPhoneId,
          businessNumber: this.businessNumber
        }
      })
    );
  }
}
