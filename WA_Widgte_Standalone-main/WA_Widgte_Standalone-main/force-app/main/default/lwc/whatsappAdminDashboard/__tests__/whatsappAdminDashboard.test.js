import { createElement } from "lwc";
import WhatsappAdminDashboard from "c/whatsappAdminDashboard";

const flushPromises = () => Promise.resolve();

describe("c-whatsapp-admin-dashboard", () => {
  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
  });

  it("renders Twilio inputs by default", async () => {
    const element = createElement("c-whatsapp-admin-dashboard", {
      is: WhatsappAdminDashboard
    });
    document.body.appendChild(element);

    await flushPromises();

    const allInputs = element.shadowRoot.querySelectorAll("lightning-input");
    expect(allInputs.length).toBeGreaterThan(0);

    const labels = [...allInputs].map((i) => i.label);
    expect(labels).toEqual(
      expect.arrayContaining(["Twilio Account SID", "Twilio Auth Token"])
    );
  });

  it("switches to Meta inputs when provider changes", async () => {
    const element = createElement("c-whatsapp-admin-dashboard", {
      is: WhatsappAdminDashboard
    });
    document.body.appendChild(element);

    await flushPromises();

    const rg = element.shadowRoot.querySelector("lightning-radio-group");
    rg.dispatchEvent(new CustomEvent("change", { detail: { value: "Meta" } }));

    await flushPromises();

    const allInputs = element.shadowRoot.querySelectorAll("lightning-input");
    const labels = [...allInputs].map((i) => i.label);
    expect(labels).toEqual(
      expect.arrayContaining([
        "Meta App ID",
        "Meta Access Token",
        "Phone Number ID"
      ])
    );
  });
});
