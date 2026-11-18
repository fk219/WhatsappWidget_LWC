import { LightningElement, api, track } from "lwc";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import { subscribe, unsubscribe, onError } from "lightning/empApi";
import getContext from "@salesforce/apex/WhatsAppChatController.getContext";
import sendText from "@salesforce/apex/WhatsAppChatController.sendText";

const CHANNEL_NAME = "/event/WhatsApp_Event__e";
const REFRESH_DEBOUNCE_MS = 400;

export default class WhatsappChat extends LightningElement {
  @api recordId;
  @api objectApiName;
  @api variant = "launcher";

  @track isOpen = false;
  @track isLoading = true;
  @track isSending = false;
  @track messages = [];
  @track currentMessage = "";
  @track recordName = "WhatsApp";
  @track conversationId;
  @track windowExpiresAt;
  @track consentStatus = "Unknown";
  @track errorMessage;
  @track now = Date.now();

  subscription;
  refreshTimer;
  windowTimer;
  refreshTimeout;

  connectedCallback() {
    this.loadContext();
    this.subscribeToEvents();
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    this.windowTimer = setInterval(() => {
      this.now = Date.now();
    }, 60000);
  }

  disconnectedCallback() {
    this.unsubscribeFromEvents();
    clearInterval(this.windowTimer);
    clearTimeout(this.refreshTimeout);
  }

  async loadContext() {
    if (!this.recordId) {
      this.isLoading = false;
      return;
    }
    this.isLoading = true;
    this.errorMessage = undefined;
    try {
      const result = await getContext({
        recordId: this.recordId,
        objectApiName: this.objectApiName
      });
      this.recordName = result.recordName || "WhatsApp";
      this.conversationId = result.conversationId;
      this.windowExpiresAt = result.windowExpiresAt;
      this.consentStatus = result.consentStatus || "Unknown";
      this.messages = this.decorateMessages(result.messages || []);
    } catch (error) {
      this.errorMessage = this.getErrorMessage(error);
    } finally {
      this.isLoading = false;
    }
  }

  decorateMessages(rawMessages) {
    let previousDate = null;
    return rawMessages.map((message) => {
      const date = message.Sent_At__c
        ? new Date(message.Sent_At__c)
        : new Date();
      const dateKey = date.toDateString();
      const showDateSeparator = dateKey !== previousDate;
      previousDate = dateKey;
      const isOutbound = message.Direction__c === "Outbound";
      const type = message.Type__c || "text";
      const isMedia = [
        "image",
        "audio",
        "video",
        "document",
        "sticker"
      ].includes(type);
      const isInteractive = type === "interactive";
      const isTemplate = type === "template";
      const isReaction = type === "reaction";
      const isSystem = type === "system" || type === "unsupported";
      const hasError =
        message.Status__c === "Failed" && message.Error_Message__c;

      return {
        ...message,
        isOutbound,
        isInbound: !isOutbound,
        isMedia,
        isInteractive,
        isTemplate,
        isReaction,
        isSystem,
        hasError,
        bubbleClass: isOutbound
          ? "message-row outbound"
          : "message-row inbound",
        contentClass: isSystem ? "message-content system" : "message-content",
        showDateSeparator,
        dateLabel: showDateSeparator ? this.formatDateLabel(date) : "",
        timeLabel: this.formatTime(date),
        statusLabel: this.getStatusLabel(message.Status__c),
        statusClass: this.getStatusClass(message.Status__c),
        senderLabel: isOutbound ? "You" : "Customer",
        mediaIcon: this.getMediaIcon(type),
        typeLabel: this.getTypeLabel(type)
      };
    });
  }

  formatDateLabel(date) {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === today.toDateString()) {
      return "Today";
    }
    if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    }
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: date.getFullYear() === today.getFullYear() ? undefined : "numeric"
    }).format(date);
  }

  formatTime(date) {
    return new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  getStatusLabel(status) {
    switch (status) {
      case "Queued":
        return "Clock";
      case "Sent":
        return "✓";
      case "Delivered":
        return "✓✓";
      case "Read":
        return "✓✓";
      case "Failed":
        return "!";
      case "Received":
        return "↓";
      default:
        return "";
    }
  }

  getStatusClass(status) {
    if (status === "Read") {
      return "status read";
    }
    if (status === "Failed") {
      return "status failed";
    }
    return "status";
  }

  getMediaIcon(type) {
    switch (type) {
      case "image":
        return "utility:image";
      case "audio":
        return "utility:volume_high";
      case "video":
        return "utility:video";
      case "document":
        return "utility:file";
      case "sticker":
        return "utility:emoji";
      default:
        return "utility:file";
    }
  }

  getTypeLabel(type) {
    switch (type) {
      case "image":
        return "Photo";
      case "audio":
        return "Audio message";
      case "video":
        return "Video";
      case "document":
        return "Document";
      case "sticker":
        return "Sticker";
      case "template":
        return "Template message";
      case "interactive":
        return "Interactive response";
      case "reaction":
        return "Reaction";
      case "location":
        return "Location";
      case "contacts":
        return "Contact card";
      default:
        return "Message";
    }
  }

  get isInline() {
    return this.variant === "inline";
  }

  get showChat() {
    return this.isInline || this.isOpen;
  }

  get showLauncher() {
    return !this.isInline && !this.isOpen;
  }

  get showCloseButton() {
    return !this.isInline;
  }

  get chatWindowClass() {
    return this.isInline ? "chat-window inline" : "chat-window";
  }

  get isWindowOpen() {
    return this.windowExpiresAt
      ? new Date(this.windowExpiresAt).getTime() > this.now
      : false;
  }

  get windowLabel() {
    if (!this.windowExpiresAt) {
      return "No inbound message";
    }
    const remaining = new Date(this.windowExpiresAt).getTime() - this.now;
    if (remaining <= 0) {
      return "24h window closed";
    }
    const hours = Math.floor(remaining / 3600000);
    const minutes = Math.floor((remaining % 3600000) / 60000);
    return `${hours}h ${minutes}m left`;
  }

  get isOptedOut() {
    return this.consentStatus === "Opted Out";
  }

  get isWindowClosed() {
    return !this.isWindowOpen;
  }

  get windowDotClass() {
    return this.isWindowOpen ? "status-dot online" : "status-dot";
  }

  get isComposerDisabled() {
    return this.isSending || !this.isWindowOpen || this.isOptedOut;
  }

  get isSendDisabled() {
    return this.isComposerDisabled || !this.currentMessage.trim();
  }

  get hasMessages() {
    return this.messages.length > 0;
  }

  get showEmptyState() {
    return !this.isLoading && !this.hasMessages;
  }

  get placeholder() {
    if (this.isOptedOut) {
      return "Customer opted out of WhatsApp messages.";
    }
    if (!this.isWindowOpen) {
      return "24-hour window closed. Send an approved template.";
    }
    return "Type a message...";
  }

  get consentClass() {
    return this.isOptedOut ? "consent-badge opted-out" : "consent-badge";
  }

  toggleChat() {
    if (this.isInline) {
      return;
    }
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.loadContext();
      this.scrollToBottom();
    }
  }

  renderedCallback() {
    const input = this.template.querySelector(".message-input");
    if (input && input.value !== this.currentMessage) {
      input.value = this.currentMessage;
    }
  }

  handleRefresh() {
    this.loadContext().then(() => this.scrollToBottom());
  }

  handleInput(event) {
    this.currentMessage = event.target.value;
    this.autoGrow(event.target);
  }

  autoGrow(textarea) {
    if (!textarea) {
      return;
    }
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
  }

  handleKeyUp(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      this.handleSend();
    }
  }

  async handleSend() {
    if (this.isSendDisabled) {
      return;
    }
    const message = this.currentMessage.trim();
    this.isSending = true;
    this.currentMessage = "";
    const input = this.template.querySelector(".message-input");
    if (input) {
      input.value = "";
      input.style.height = "auto";
    }

    try {
      await sendText({
        recordId: this.recordId,
        objectApiName: this.objectApiName,
        message
      });
      await this.loadContext();
      this.scrollToBottom();
    } catch (error) {
      this.showToast("Error", this.getErrorMessage(error), "error");
      this.currentMessage = message;
    } finally {
      this.isSending = false;
    }
  }

  scrollToBottom() {
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    requestAnimationFrame(() => {
      const container = this.template.querySelector(".chat-messages-container");
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    });
  }

  subscribeToEvents() {
    subscribe(CHANNEL_NAME, -1, (event) => this.handlePlatformEvent(event))
      .then((subscription) => {
        this.subscription = subscription;
      })
      .catch(() => {
        // Polling fallback is not required for v1; refresh is available.
      });
    onError(() => {
      this.showToast(
        "Warning",
        "Real-time updates are temporarily unavailable.",
        "warning"
      );
    });
  }

  async unsubscribeFromEvents() {
    if (this.subscription) {
      try {
        await unsubscribe(this.subscription);
      } catch {
        // Ignore unsubscribe errors during teardown.
      }
      this.subscription = undefined;
    }
  }

  handlePlatformEvent(event) {
    const payload = event?.data?.payload;
    if (!payload) {
      return;
    }
    const matchesRecord =
      payload.Record_Id__c && payload.Record_Id__c === this.recordId;
    const matchesConversation =
      payload.Conversation_Id__c &&
      payload.Conversation_Id__c === this.conversationId;
    if (!matchesRecord && !matchesConversation) {
      return;
    }
    clearTimeout(this.refreshTimeout);
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    this.refreshTimeout = setTimeout(() => {
      this.loadContext().then(() => this.scrollToBottom());
    }, REFRESH_DEBOUNCE_MS);
  }

  showToast(title, message, variant) {
    this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
  }

  getErrorMessage(error) {
    if (error?.body?.message) {
      return error.body.message;
    }
    if (error?.body?.pageErrors?.[0]?.message) {
      return error.body.pageErrors[0].message;
    }
    return error?.message || "Something went wrong.";
  }
}
