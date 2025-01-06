let isMonitoring = false;
let timeoutId = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "startMonitoring") {
    isMonitoring = true;
    console.log("Monitoring started");

    // 현재 활성 탭 가져오기
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      const tab = tabs[0];
      console.log("Current tab:", tab.url);

      // 디버거 연결
      chrome.debugger.attach({ tabId: tab.id }, "1.0", function () {
        if (chrome.runtime.lastError) {
          console.error("Debugger attach error:", chrome.runtime.lastError);
          chrome.runtime.sendMessage({
            action: "monitoringFailed",
            error: "디버거 연결 실패",
          });
          return;
        }
        console.log("Debugger attached successfully");

        // 네트워크 로깅 활성화
        chrome.debugger.sendCommand(
          { tabId: tab.id },
          "Network.enable",
          {},
          function () {
            if (chrome.runtime.lastError) {
              console.error("Network enable error:", chrome.runtime.lastError);
              chrome.runtime.sendMessage({
                action: "monitoringFailed",
                error: "네트워크 모니터링 활성화 실패",
              });
              return;
            }
            console.log("Network monitoring enabled");

            // 5초 후에도 응답이 없으면 실패로 처리
            timeoutId = setTimeout(() => {
              if (isMonitoring) {
                isMonitoring = false;
                chrome.debugger.detach({ tabId: tab.id });
                chrome.runtime.sendMessage({
                  action: "monitoringFailed",
                  error: "API 응답 시간 초과",
                });
              }
            }, 5000);

            // 페이지 새로고침
            chrome.tabs.reload(tab.id);
          }
        );
      });
    });

    sendResponse({ status: "success" });
  }
  return true;
});

// 디버거 이벤트 리스너
chrome.debugger.onEvent.addListener((source, method, params) => {
  if (!isMonitoring) return;

  if (method === "Network.responseReceived") {
    console.log("Network response:", params.response.url);

    if (params.response.url.includes("/api/common/cart")) {
      console.log("Target API detected!");

      chrome.debugger.sendCommand(
        { tabId: source.tabId },
        "Network.getResponseBody",
        { requestId: params.requestId },
        function (response) {
          if (chrome.runtime.lastError) {
            console.error("Get response body error:", chrome.runtime.lastError);
            chrome.runtime.sendMessage({
              action: "monitoringFailed",
              error: "응답 데이터 가져오기 실패",
            });
            return;
          }

          if (response && response.body) {
            console.log("Response body received");
            // 타임아웃 취소
            if (timeoutId) {
              clearTimeout(timeoutId);
              timeoutId = null;
            }
            // 모니터링 종료
            isMonitoring = false;
            chrome.debugger.detach({ tabId: source.tabId });
            // 데이터 전송
            chrome.runtime.sendMessage({
              action: "copyToClipboard",
              data: response.body,
            });
          }
        }
      );
    }
  }
});
