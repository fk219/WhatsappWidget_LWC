import { LightningElement, api, track } from "lwc";

export default class WhatsappGlobalNotification extends LightningElement {
  @track notifications = [];
  @track unreadCount = 0;

  get hasNotifications() {
    return this.notifications.length > 0;
  }

  @api
  addNotification(recordId) {
    if (!recordId) return;
    this.unreadCount += 1;
    const now = new Date();
    const time = now.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });
    const notification = { id: `${now.getTime()}`, recordId, time };
    this.notifications = [notification, ...this.notifications].slice(0, 10);
  }

  handleNotificationClick(event) {
    const recordId = event.currentTarget.dataset.id;
    this.dispatchEvent(new CustomEvent("navigate", { detail: { recordId } }));
    if (this.unreadCount > 0) this.unreadCount -= 1;
  }
}
