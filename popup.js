document.addEventListener("DOMContentLoaded", function () {
  const startButton = document.getElementById("startButton");
  const statusDiv = document.getElementById("status");

  startButton.addEventListener("click", function () {
    console.log("캡처 시작");
    statusDiv.textContent = "API 응답 대기중...";
    startButton.disabled = true;

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs[0].url.includes("new-m.pay.naver.com")) {
        chrome.runtime.sendMessage(
          { action: "startMonitoring" },
          function (response) {
            if (response && response.status === "success") {
              statusDiv.textContent = "API 응답 감시 중...";
            }
          }
        );
      } else {
        statusDiv.textContent = "올바른 페이지가 아닙니다!";
        startButton.disabled = false;
      }
    });
  });
});

// 메시지 리스너
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const statusDiv = document.getElementById("status");
  const startButton = document.getElementById("startButton");

  if (message.action === "copyToClipboard") {
    try {
      const prettyData = JSON.stringify(JSON.parse(message.data), null, 2);
      navigator.clipboard
        .writeText(prettyData)
        .then(() => {
          console.log("API 응답이 클립보드에 복사되었습니다.");
          statusDiv.textContent = "데이터가 복사되었습니다!";
          startButton.disabled = false;
        })
        .catch((err) => {
          console.error("클립보드 복사 실패:", err);
          statusDiv.textContent = "복사 실패!";
          startButton.disabled = false;
        });
    } catch (e) {
      console.error("데이터 처리 중 오류:", e);
      statusDiv.textContent = "데이터 처리 실패!";
      startButton.disabled = false;
    }
  } else if (message.action === "monitoringFailed") {
    console.error("모니터링 실패:", message.error);
    statusDiv.textContent = `실패: ${message.error}`;
    startButton.disabled = false;
  }
});
