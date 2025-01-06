import { MonitoringController } from "./services/MonitoringController.js";
import { DebuggerService } from "./services/DebuggerService.js";
import { MessageDispatcher } from "./services/MessageDispatcher.js";

const monitoringController = new MonitoringController();
const debuggerService = new DebuggerService();

// 모니터링 시작 처리
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "startMonitoring") {
    handleStartMonitoring(sendResponse);
    return true;
  }
});

// 네트워크 응답 처리
chrome.debugger.onEvent.addListener((source, method, params) => {
  if (method === "Network.responseReceived") {
    handleNetworkResponse(source, params);
  }
});

async function handleStartMonitoring(sendResponse) {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab?.id) {
      throw new Error("활성 탭을 찾을 수 없습니다.");
    }

    monitoringController.startMonitoring();
    await debuggerService.attach(tab.id);

    // 5초 타임아웃 설정
    monitoringController.setTimeout(() => {
      monitoringController.stopMonitoring();
      if (tab.id) {
        debuggerService.detach(tab.id);
      }
      MessageDispatcher.sendMonitoringFailed("API 응답 시간 초과");
    }, 5000);

    // 페이지 새로고침
    await chrome.tabs.reload(tab.id);

    sendResponse({ status: "success" });
  } catch (error) {
    console.error("Monitoring start failed:", error);
    MessageDispatcher.sendMonitoringFailed("모니터링 시작 실패");
  }
}

async function handleNetworkResponse(source, params) {
  if (!monitoringController.isMonitoring) return;

  if (params.response.url.includes("/api/common/cart")) {
    try {
      const response = await debuggerService.getResponseBody(
        source.tabId,
        params.requestId
      );

      if (response?.body) {
        monitoringController.stopMonitoring();
        debuggerService.detach(source.tabId);
        MessageDispatcher.sendCopyToClipboard(response.body);
      }
    } catch (error) {
      console.error("Response body error:", error);
      MessageDispatcher.sendMonitoringFailed("응답 데이터 가져오기 실패");
    }
  }
}
