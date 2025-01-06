type MessageAction = "copyToClipboard" | "monitoringFailed";

interface MessagePayload {
  action: MessageAction;
  data?: string;
  error?: string;
}

export class MessageDispatcher {
  static sendCopyToClipboard(data: string): void {
    this.dispatch({
      action: "copyToClipboard",
      data,
    });
  }

  static sendMonitoringFailed(error: string): void {
    this.dispatch({
      action: "monitoringFailed",
      error,
    });
  }

  private static dispatch(payload: MessagePayload): void {
    chrome.runtime.sendMessage(payload);
  }
}
