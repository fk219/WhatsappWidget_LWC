@IsTest
private class WhatsAppConstantsTest {
  @IsTest
  static void exposesCanonicalValues() {
    System.assertEquals('Meta', WhatsAppConstants.PROVIDER_META);
    System.assertEquals('Inbound', WhatsAppConstants.DIRECTION_INBOUND);
    System.assertEquals('Outbound', WhatsAppConstants.DIRECTION_OUTBOUND);
    System.assertEquals('Queued', WhatsAppConstants.STATUS_QUEUED);
    System.assertEquals('Delivered', WhatsAppConstants.STATUS_DELIVERED);
    System.assertEquals('text', WhatsAppConstants.MESSAGE_TYPE_TEXT);
    System.assertEquals('APPROVED', WhatsAppConstants.TEMPLATE_STATUS_APPROVED);
    System.assertEquals(4096, WhatsAppConstants.MAX_TEXT_LENGTH);
    System.assertEquals(10, WhatsAppConstants.MAX_INBOUND_MEDIA_MB);
    System.assert(WhatsAppConstants.GRAPH_API_VERSION_DEFAULT.startsWith('v'));
    System.assert(
      WhatsAppConstants.WEBHOOK_PATH.startsWith('/services/apexrest/')
    );
  }
}
