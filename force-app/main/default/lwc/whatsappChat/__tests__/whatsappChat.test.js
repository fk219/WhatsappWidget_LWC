import { createElement } from "lwc";
import WhatsappChat from "c/whatsappChat";
import getContext from "@salesforce/apex/WhatsAppChatController.getContext";

jest.mock(
  "@salesforce/apex/WhatsAppChatController.getContext",
  () => ({ default: jest.fn() }),
  { virtual: true }
);
jest.mock(
  "@salesforce/apex/WhatsAppChatController.sendText",
  () => ({ default: jest.fn() }),
  { virtual: true }
);
jest.mock(
  "lightning/empApi",
  () => ({
    subscribe: jest.fn(() => Promise.resolve({ id: "test-subscription" })),
    unsubscribe: jest.fn(() => Promise.resolve()),
    onError: jest.fn()
  }),
  { virtual: true }
);

const flushPromises = () => Promise.resolve();

describe("c-whatsapp-chat", () => {
  beforeAll(() => {
    global.requestAnimationFrame = (callback) => callback();
  });

  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    jest.clearAllMocks();
  });

  it("renders the launcher and opens the conversation", async () => {
    getContext.mockResolvedValue({
      recordName: "Acme Ltd",
      conversationId: "a01000000000001",
      windowExpiresAt: new Date(Date.now() + 3600000).toISOString(),
      consentStatus: "Opted In",
      messages: []
    });

    const element = createElement("c-whatsapp-chat", { is: WhatsappChat });
    element.recordId = "001000000000001";
    document.body.appendChild(element);

    await flushPromises();
    await flushPromises();

    const launcher = element.shadowRoot.querySelector("button.launcher");
    expect(launcher).not.toBeNull();

    launcher.click();
    await flushPromises();

    expect(element.shadowRoot.querySelector(".chat-window")).not.toBeNull();
    expect(element.shadowRoot.querySelector(".record-name").textContent).toBe(
      "Acme Ltd"
    );
  });

  it("shows the empty state when there are no messages", async () => {
    getContext.mockResolvedValue({
      recordName: "Acme Ltd",
      conversationId: "a01000000000001",
      windowExpiresAt: new Date(Date.now() + 3600000).toISOString(),
      consentStatus: "Opted In",
      messages: []
    });

    const element = createElement("c-whatsapp-chat", { is: WhatsappChat });
    element.recordId = "001000000000001";
    document.body.appendChild(element);

    await flushPromises();
    await flushPromises();
    element.shadowRoot.querySelector("button.launcher").click();
    await flushPromises();
    await flushPromises();

    expect(element.shadowRoot.querySelector(".empty-state")).not.toBeNull();
  });
});
