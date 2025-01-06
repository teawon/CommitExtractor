// 메시지 통신 관리
export class MessageService {
  static sendCopyToClipboard(data) {
    chrome.runtime.sendMessage({
      action: "copyToClipboard",
      data: data,
    });
  }

  static sendMonitoringFailed(error) {
    chrome.runtime.sendMessage({
      action: "monitoringFailed",
      error: error,
    });
  }
}
