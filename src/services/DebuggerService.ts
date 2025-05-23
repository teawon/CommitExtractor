interface DebuggerResponse {
  body?: string;
  base64Encoded?: boolean;
}

export class DebuggerService {
  private attachedTabs: Set<number> = new Set();

  async attach(tabId: number): Promise<void> {
    await chrome.debugger.attach({ tabId }, "1.0");
    await this.enableNetworking(tabId);
    this.attachedTabs.add(tabId);
  }

  private async enableNetworking(tabId: number): Promise<void> {
    await chrome.debugger.sendCommand({ tabId }, "Network.enable", {});
  }

  public detach(tabId: number): void {
    chrome.debugger.detach({ tabId });
    this.attachedTabs.delete(tabId);
  }

  async getResponseBody(
    tabId: number,
    requestId: string
  ): Promise<DebuggerResponse> {
    return new Promise((resolve, reject) => {
      chrome.debugger.sendCommand(
        { tabId },
        "Network.getResponseBody",
        { requestId },
        (response?: any) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(response as DebuggerResponse);
          }
        }
      );
    });
  }
}
