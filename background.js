import { MonitoringState } from "./services/monitoring-state.js";
import { DebuggerService } from "./services/debugger-service.js";
import { MessageService } from "./services/message-service.js";

const monitoringState = new MonitoringState();
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

    monitoringState.startMonitoring();
    await debuggerService.attach(tab.id);

    // 5초 타임아웃 설정
    monitoringState.setTimeout(() => {
      monitoringState.stopMonitoring();
      debuggerService.detach(tab.id);
      MessageService.sendMonitoringFailed("API 응답 시간 초과");
    }, 5000);

    // 페이지 새로고침
    await chrome.tabs.reload(tab.id);

    sendResponse({ status: "success" });
  } catch (error) {
    console.error("Monitoring start failed:", error);
    MessageService.sendMonitoringFailed("모니터링 시작 실패");
  }
}

async function handleNetworkResponse(source, params) {
  if (!monitoringState.isMonitoring) return;

  if (params.response.url.includes("/api/common/cart")) {
    try {
      const response = await debuggerService.getResponseBody(
        source.tabId,
        params.requestId
      );

      if (response?.body) {
        monitoringState.stopMonitoring();
        debuggerService.detach(source.tabId);
        MessageService.sendCopyToClipboard(response.body);
      }
    } catch (error) {
      console.error("Response body error:", error);
      MessageService.sendMonitoringFailed("응답 데이터 가져오기 실패");
    }
  }
}
