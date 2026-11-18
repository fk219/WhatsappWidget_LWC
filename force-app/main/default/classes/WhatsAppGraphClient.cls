/**
 * Low-level Meta Graph API client.
 *
 * - Uses the packaged Remote Site Setting for graph.facebook.com.
 * - Reads the access token from WhatsApp_Credential__c via WhatsAppSettingsService.
 * - Logs every call to WhatsApp_API_Log__c with a correlation ID and fbtrace_id.
 * - Never logs the access token or app secret.
 *
 * A Named Credential can replace the host later without changing callers.
 */
public without sharing class WhatsAppGraphClient {
  private static final Integer MAX_LOG_BODY = 131072;
  private static final Integer TIMEOUT_MS = 60000;

  public static HttpResponse get(String path, Map<String, String> query) {
    return send('GET', path, query, null);
  }

  public static HttpResponse post(String path, Object body) {
    return send('POST', path, null, body);
  }

  public static HttpResponse deleteResource(String path) {
    return send('DELETE', path, null, null);
  }

  private static HttpResponse send(
    String method,
    String path,
    Map<String, String> query,
    Object body
  ) {
    Long startMs = Datetime.now().getTime();
    String endpoint = buildEndpoint(path, query);
    String correlationId = correlationId();
    String requestBody = body == null ? null : JSON.serialize(body);
    HttpResponse response = null;
    String errorCode;
    String errorSubcode;
    String errorMessage;
    String fbTraceId;

    try {
      HttpRequest request = new HttpRequest();
      request.setEndpoint(endpoint);
      request.setMethod(method);
      request.setTimeout(TIMEOUT_MS);
      request.setHeader(
        'Authorization',
        'Bearer ' + WhatsAppSettingsService.getAccessToken()
      );
      request.setHeader('Content-Type', 'application/json');
      request.setHeader('Accept', 'application/json');
      if (requestBody != null) {
        request.setBody(requestBody);
      }
      response = new Http().send(request);
    } catch (Exception e) {
      logCall(
        correlationId,
        method,
        endpoint,
        null,
        startMs,
        requestBody,
        null,
        null,
        null,
        'CALLOUT',
        e.getMessage()
      );
      throw new WhatsAppException(
        'Unable to reach Meta. Check the Remote Site Setting and network access.'
      );
    }

    Integer statusCode = response.getStatusCode();
    String responseBody = response.getBody() == null ? '' : response.getBody();
    fbTraceId = response.getHeader('x-fb-trace-id');

    if (statusCode < 200 || statusCode >= 300) {
      Map<String, Object> error = parseError(responseBody);
      errorCode = stringValue(error.get('code'));
      errorSubcode = stringValue(error.get('error_subcode'));
      errorMessage = stringValue(error.get('message'));
      if (String.isBlank(errorMessage)) {
        errorMessage = 'Meta returned HTTP ' + statusCode;
      }
      if (String.isNotBlank(stringValue(error.get('fbtrace_id')))) {
        fbTraceId = stringValue(error.get('fbtrace_id'));
      }
      logCall(
        correlationId,
        method,
        endpoint,
        statusCode,
        startMs,
        requestBody,
        responseBody,
        errorCode,
        errorSubcode,
        fbTraceId,
        errorMessage
      );
      throw new WhatsAppException(
        buildUserMessage(statusCode, errorCode, errorMessage)
      );
    }

    logCall(
      correlationId,
      method,
      endpoint,
      statusCode,
      startMs,
      requestBody,
      responseBody,
      null,
      null,
      fbTraceId,
      null
    );
    return response;
  }

  private static String buildEndpoint(String path, Map<String, String> query) {
    String endpoint = WhatsAppSettingsService.getBaseUrl();
    if (!path.startsWith('/')) {
      endpoint += '/';
    }
    endpoint += path;
    if (query != null && !query.isEmpty()) {
      String separator = '?';
      for (String key : query.keySet()) {
        String value = query.get(key);
        if (String.isBlank(value)) {
          continue;
        }
        endpoint +=
          separator +
          EncodingUtil.urlEncode(key, 'UTF-8') +
          '=' +
          EncodingUtil.urlEncode(value, 'UTF-8');
        separator = '&';
      }
    }
    return endpoint;
  }

  private static Map<String, Object> parseError(String responseBody) {
    try {
      Map<String, Object> root = (Map<String, Object>) JSON.deserializeUntyped(
        responseBody
      );
      Object error = root.get('error');
      if (error instanceof Map<String, Object>) {
        return (Map<String, Object>) error;
      }
    } catch (Exception e) {
      // Fall through to an empty error map.
    }
    return new Map<String, Object>();
  }

  private static String buildUserMessage(
    Integer statusCode,
    String errorCode,
    String errorMessage
  ) {
    if (statusCode == 401 || statusCode == 403) {
      return 'Meta rejected the access token or permissions. Reconnect WhatsApp and check app review.';
    }
    if (statusCode == 429) {
      return 'Meta rate limit reached. The message will be retried.';
    }
    String suffix = String.isBlank(errorCode)
      ? ''
      : ' (code ' + errorCode + ')';
    return 'Meta API error: ' + errorMessage + suffix;
  }

  private static String stringValue(Object value) {
    return value == null ? null : String.valueOf(value);
  }

  private static String correlationId() {
    return String.valueOf(Datetime.now().getTime()) +
      '-' +
      String.valueOf(Math.abs(Crypto.getRandomInteger()));
  }

  private static String truncate(String value, Integer maxLength) {
    if (value == null || value.length() <= maxLength) {
      return value;
    }
    return value.substring(0, maxLength);
  }

  private static void logCall(
    String correlationId,
    String method,
    String endpoint,
    Integer statusCode,
    Long startMs,
    String requestBody,
    String responseBody,
    String errorCode,
    String errorSubcode,
    String fbTraceId,
    String errorMessage
  ) {
    try {
      WhatsApp_API_Log__c log = new WhatsApp_API_Log__c(
        Correlation_Id__c = correlationId,
        Operation__c = truncate(method + ' ' + endpoint, 100),
        Endpoint__c = truncate(endpoint, 255),
        Method__c = method,
        Status_Code__c = statusCode,
        Duration_Ms__c = Decimal.valueOf(Datetime.now().getTime() - startMs),
        Request_Body__c = truncate(requestBody, MAX_LOG_BODY),
        Response_Body__c = truncate(responseBody, MAX_LOG_BODY),
        Error_Code__c = errorCode,
        Error_Subcode__c = errorSubcode,
        FBTrace_Id__c = truncate(fbTraceId, 255),
        User__c = UserInfo.getUserId(),
        Created_At__c = Datetime.now()
      );
      Database.insert(log, false);
    } catch (Exception e) {
      // Logging must never break the integration.
    }
  }
}
