/**
 * Canonical values shared by Apex services, tests, and LWC DTOs.
 *
 * Keep this class free of business logic. It exists so status names, limits,
 * and provider identifiers do not drift across the codebase.
 */
public with sharing class WhatsAppConstants {
  public static final String PROVIDER_META = 'Meta';
  public static final String PROVIDER_TWILIO = 'Twilio';

  public static final String DIRECTION_INBOUND = 'Inbound';
  public static final String DIRECTION_OUTBOUND = 'Outbound';

  public static final String STATUS_QUEUED = 'Queued';
  public static final String STATUS_SENDING = 'Sending';
  public static final String STATUS_SENT = 'Sent';
  public static final String STATUS_DELIVERED = 'Delivered';
  public static final String STATUS_READ = 'Read';
  public static final String STATUS_RECEIVED = 'Received';
  public static final String STATUS_FAILED = 'Failed';
  public static final String STATUS_DELETED = 'Deleted';

  public static final String MESSAGE_TYPE_TEXT = 'text';
  public static final String MESSAGE_TYPE_IMAGE = 'image';
  public static final String MESSAGE_TYPE_AUDIO = 'audio';
  public static final String MESSAGE_TYPE_VIDEO = 'video';
  public static final String MESSAGE_TYPE_DOCUMENT = 'document';
  public static final String MESSAGE_TYPE_STICKER = 'sticker';
  public static final String MESSAGE_TYPE_LOCATION = 'location';
  public static final String MESSAGE_TYPE_CONTACTS = 'contacts';
  public static final String MESSAGE_TYPE_INTERACTIVE = 'interactive';
  public static final String MESSAGE_TYPE_TEMPLATE = 'template';
  public static final String MESSAGE_TYPE_REACTION = 'reaction';
  public static final String MESSAGE_TYPE_SYSTEM = 'system';
  public static final String MESSAGE_TYPE_UNSUPPORTED = 'unsupported';

  public static final String TEMPLATE_STATUS_APPROVED = 'APPROVED';
  public static final String TEMPLATE_STATUS_PENDING = 'PENDING';
  public static final String TEMPLATE_STATUS_REJECTED = 'REJECTED';
  public static final String TEMPLATE_STATUS_PAUSED = 'PAUSED';
  public static final String TEMPLATE_STATUS_DISABLED = 'DISABLED';

  public static final String CONSENT_OPTED_IN = 'Opted In';
  public static final String CONSENT_OPTED_OUT = 'Opted Out';
  public static final String CONSENT_UNKNOWN = 'Unknown';

  public static final String EVENT_TYPE_MESSAGE = 'Message';
  public static final String EVENT_TYPE_STATUS = 'Status';
  public static final String EVENT_TYPE_CONVERSATION = 'Conversation';
  public static final String EVENT_TYPE_NOTIFICATION = 'Notification';
  public static final String EVENT_TYPE_TEMPLATE = 'Template';
  public static final String EVENT_TYPE_ACCOUNT = 'Account';

  public static final Integer MAX_TEXT_LENGTH = 4096;
  public static final Integer MAX_CAPTION_LENGTH = 1024;
  public static final Integer MAX_INBOUND_MEDIA_MB = 10;
  public static final Integer MAX_APEX_HEAP_ASYNC_MB = 12;
  public static final Integer WEBHOOK_RETRY_DAYS = 7;
  public static final Integer WINDOW_HOURS = 24;
  public static final Integer MAX_BULK_SIZE = 200;

  public static final String GRAPH_API_VERSION_DEFAULT = 'v27.0';
  public static final String GRAPH_API_HOST = 'https://graph.facebook.com';
  public static final String MEDIA_HOST = 'https://lookaside.fbsbx.com';
  public static final String WEBHOOK_PATH = '/services/apexrest/whatsapp/webhook';

  private WhatsAppConstants() {
    // Utility class.
  }
}
