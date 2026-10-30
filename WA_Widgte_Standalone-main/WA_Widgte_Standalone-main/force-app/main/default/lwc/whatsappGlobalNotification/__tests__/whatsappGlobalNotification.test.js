import { createElement } from "lwc";
import WhatsappGlobalNotification from "c/whatsappGlobalNotification";

const flushPromises = () => Promise.resolve();

describe("c-whatsapp-global-notification", () => {
  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
  });

  it("renders empty state by default", async () => {
    const element = createElement("c-whatsapp-global-notification", {
      is: WhatsappGlobalNotification
    });
    document.body.appendChild(element);

    await flushPromises();

    expect(element.shadowRoot.querySelector(".empty-state")).not.toBeNull();
  });

  it("adds notifications via public api", async () => {
    const element = createElement("c-whatsapp-global-notification", {
      is: WhatsappGlobalNotification
    });
    document.body.appendChild(element);

    element.addNotification("001000000000001");
    await flushPromises();

    const items = element.shadowRoot.querySelectorAll(".notification-item");
    expect(items.length).toBe(1);
  });
});
