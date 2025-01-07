export {};

interface StatusElements {
  button: HTMLButtonElement;
  status: HTMLDivElement;
}

interface MonitoringResponse {
  status: "success" | "error";
  error?: string;
}

(async function initializePopup() {
  document.addEventListener("DOMContentLoaded", function () {
    const elements = getStatusElements();
    if (!elements) return;

    setupEventListeners(elements);
  });
})();

function getStatusElements(): StatusElements | null {
  const startButton = document.getElementById(
    "startButton"
  ) as HTMLButtonElement;
  const statusDiv = document.getElementById("status") as HTMLDivElement;

  if (!startButton || !statusDiv) {
    console.error("필수 DOM 엘리먼트를 찾을 수 없습니다.");
    return null;
  }

  return { button: startButton, status: statusDiv };
}

function setupEventListeners(elements: StatusElements): void {
  const { button, status } = elements;

  button.addEventListener("click", () => handleStartButtonClick(elements));

  // 메시지 리스너
  chrome.runtime.onMessage.addListener(
    (message: { action: string; data?: string; error?: string }) => {
      handleRuntimeMessage(message, elements);
    }
  );
}

async function handleStartButtonClick(elements: StatusElements): Promise<void> {
  const { button, status } = elements;

  console.log("캡처 시작");
  status.textContent = "API 응답 대기중...";
  button.disabled = true;

  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab?.url?.includes("merge_requests")) {
      status.textContent = "올바른 페이지가 아닙니다!";
      button.disabled = false;
      return;
    }

    const response = await chrome.runtime.sendMessage({
      action: "startMonitoring",
    });

    if (response?.status === "success") {
      status.textContent = "API 응답 감시 중...";
    } else {
      status.textContent = "시작 실패!";
      button.disabled = false;
    }
  } catch (error) {
    console.error("Error:", error);
    status.textContent = "오류가 발생했습니다!";
    button.disabled = false;
  }
}

function handleRuntimeMessage(
  message: { action: string; data?: string; error?: string },
  elements: StatusElements
): void {
  const { button, status } = elements;

  switch (message.action) {
    case "copyToClipboard":
      if (message.data) {
        const prettyData = JSON.stringify(JSON.parse(message.data), null, 2);
        navigator.clipboard
          .writeText(prettyData)
          .then(() => {
            console.log("API 응답이 클립보드에 복사되었습니다.");
            status.textContent = "데이터가 복사되었습니다!";
            button.disabled = false;
          })
          .catch((err) => {
            console.error("클립보드 복사 실패:", err);
            status.textContent = "복사 실패!";
            button.disabled = false;
          });
      }
      break;

    case "monitoringFailed":
      console.error("모니터링 실패:", message.error);
      status.textContent = `실패: ${message.error}`;
      button.disabled = false;
      break;
  }
}
