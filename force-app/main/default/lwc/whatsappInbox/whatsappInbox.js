import { LightningElement, track } from "lwc";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import { subscribe, unsubscribe, onError } from "lightning/empApi";
import getConversations from "@salesforce/apex/WhatsAppInboxController.getConversations";
import claimConversation from "@salesforce/apex/WhatsAppInboxController.claimConversation";
import closeConversation from "@salesforce/apex/WhatsAppInboxController.closeConversation";
import getCounts from "@salesforce/apex/WhatsAppInboxController.getCounts";

const CHANNEL_NAME = "/event/WhatsApp_Event__e";
const REFRESH_DEBOUNCE_MS = 500;

export default class WhatsappInbox extends LightningElement {
  @track conversations = [];
  @track filter = "mine";
  @track searchTerm = "";
  @track selectedId;
  @track isLoading = true;
  @track counts = { mine: 0, unassigned: 0, unread: 0 };
  @track errorMessage;

  subscription;
  refreshTimeout;

  connectedCallback() {
    this.load();
    this.subscribeToEvents();
  }

  disconnectedCallback() {
    this.unsubscribeFromEvents();
    clearTimeout(this.refreshTimeout);
  }

  async load() {
    this.isLoading = true;
    this.errorMessage = undefined;
    try {
      const [conversations, counts] = await Promise.all([
        getConversations({ filter: this.filter }),
        getCounts()
      ]);
      this.counts = counts || this.counts;
      this.conversations = (conversations || []).map((conversation) =>
        this.decorateConversation(conversation)
      );
      if (
        this.selectedId &&
        !this.conversations.some((item) => item.id === this.selectedId)
      ) {
        this.selectedId = undefined;
      }
    } catch (error) {
      this.errorMessage = this.getErrorMessage(error);
    } finally {
      this.isLoading = false;
    }
  }

  decorateConversation(conversation) {
    const unreadCount = conversation.unreadCount || 0;
    return {
      ...conversation,
      initials: this.getInitials(conversation.name),
      timeLabel: this.formatListTime(conversation.lastMessageAt),
      preview: conversation.preview || "No messages yet",
      hasUnread: unreadCount > 0,
      unreadLabel: unreadCount > 99 ? "99+" : String(unreadCount),
      itemClass:
        conversation.id === this.selectedId
          ? "conversation-item selected"
          : "conversation-item"
    };
  }

  getInitials(name) {
    if (!name) {
      return "WA";
    }
    return name
      .split(" ")
      .filter(Boolean)
      .map((part) => part.charAt(0))
      .join("")
      .substring(0, 2)
      .toUpperCase();
  }

  formatListTime(value) {
    if (!value) {
      return "";
    }
    const date = new Date(value);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
      return new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit"
      }).format(date);
    }
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric"
    }).format(date);
  }

  get filteredConversations() {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) {
      return this.conversations;
    }
    return this.conversations.filter((conversation) => {
      const haystack =
        `${conversation.name || ""} ${conversation.phone || ""} ${
          conversation.preview || ""
        }`.toLowerCase();
      return haystack.includes(term);
    });
  }

  get hasConversations() {
    return this.filteredConversations.length > 0;
  }

  get showEmptyList() {
    return !this.isLoading && !this.hasConversations;
  }

  get selectedConversation() {
    return this.conversations.find(
      (conversation) => conversation.id === this.selectedId
    );
  }

  get hasSelection() {
    return Boolean(this.selectedConversation);
  }

  get hasSelectedRecord() {
    return Boolean(this.selectedConversation?.recordId);
  }

  get selectedName() {
    return this.selectedConversation?.name || "WhatsApp conversation";
  }

  get selectedInitials() {
    return this.getInitials(this.selectedName);
  }

  get selectedPhone() {
    return this.selectedConversation?.phone || "";
  }

  get selectedStatus() {
    return this.selectedConversation?.status || "";
  }

  get selectedAssignedUser() {
    return this.selectedConversation?.assignedUserName || "Unassigned";
  }

  get selectedRecordId() {
    return this.selectedConversation?.recordId;
  }

  get selectedObjectApiName() {
    return this.selectedConversation?.objectApiName;
  }

  get mineCount() {
    return this.counts?.mine ?? 0;
  }

  get unassignedCount() {
    return this.counts?.unassigned ?? 0;
  }

  get unreadCount() {
    return this.counts?.unread ?? 0;
  }

  get filterMineVariant() {
    return this.filter === "mine" ? "brand" : "neutral";
  }

  get filterUnassignedVariant() {
    return this.filter === "unassigned" ? "brand" : "neutral";
  }

  get filterAllVariant() {
    return this.filter === "all" ? "brand" : "neutral";
  }

  handleFilter(event) {
    this.filter = event.currentTarget.dataset.filter;
    this.load();
  }

  handleSearch(event) {
    this.searchTerm = event.target.value;
  }

  handleSelect(event) {
    this.selectedId = event.currentTarget.dataset.id;
    this.conversations = this.conversations.map((conversation) => ({
      ...conversation,
      itemClass:
        conversation.id === this.selectedId
          ? "conversation-item selected"
          : "conversation-item"
    }));
  }

  async handleClaim() {
    if (!this.selectedId) {
      return;
    }
    try {
      await claimConversation({ conversationId: this.selectedId });
      this.showToast("Success", "Conversation claimed.", "success");
      await this.load();
    } catch (error) {
      this.showToast("Error", this.getErrorMessage(error), "error");
    }
  }

  async handleClose() {
    if (!this.selectedId) {
      return;
    }
    try {
      await closeConversation({ conversationId: this.selectedId });
      this.showToast("Success", "Conversation closed.", "success");
      this.selectedId = undefined;
      await this.load();
    } catch (error) {
      this.showToast("Error", this.getErrorMessage(error), "error");
    }
  }

  handleRefresh() {
    this.load();
  }

  subscribeToEvents() {
    subscribe(CHANNEL_NAME, -1, () => this.scheduleRefresh())
      .then((subscription) => {
        this.subscription = subscription;
      })
      .catch(() => {
        // Polling fallback is not required for v1.
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
        // Ignore teardown errors.
      }
      this.subscription = undefined;
    }
  }

  scheduleRefresh() {
    clearTimeout(this.refreshTimeout);
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    this.refreshTimeout = setTimeout(() => this.load(), REFRESH_DEBOUNCE_MS);
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
