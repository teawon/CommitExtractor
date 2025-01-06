// 디버거 관련 기능
export class DebuggerService {
  async attach(tabId) {
    await chrome.debugger.attach({ tabId }, "1.0");
    await this.enableNetworking(tabId);
  }

  async enableNetworking(tabId) {
    await chrome.debugger.sendCommand({ tabId }, "Network.enable", {});
  }

  detach(tabId) {
    chrome.debugger.detach({ tabId });
  }

  async getResponseBody(tabId, requestId) {
    return new Promise((resolve, reject) => {
      chrome.debugger.sendCommand(
        { tabId },
        "Network.getResponseBody",
        { requestId },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(response);
          }
        }
      );
    });
  }
}
