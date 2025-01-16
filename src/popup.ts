import {
  MessageDispatcher,
  MessagePayload,
} from "./services/MessageDispatcher.js";

interface StatusElements {
  button: HTMLButtonElement;
  status: HTMLDivElement;
}

const getStatusElements = (): StatusElements | null => {
  const startButton = document.getElementById(
    "startButton"
  ) as HTMLButtonElement;
  const statusDiv = document.getElementById("status") as HTMLDivElement;

  if (!startButton || !statusDiv) {
    console.error("필수 DOM 엘리먼트를 찾을 수 없습니다.");
    return null;
  }

  return { button: startButton, status: statusDiv };
};

const setupEventListeners = (elements: StatusElements): void => {
  const { button } = elements;

  button.addEventListener("click", () => {
    handleStartInterceptorCommit(elements);
  });

  chrome.runtime.onMessage.addListener((message: MessagePayload) => {
    handleClipboardCopy(message, elements);
  });
};

const handleStartInterceptorCommit = async (
  elements: StatusElements
): Promise<void> => {
  const { button, status } = elements;

  status.textContent = "API 응답 대기중...";
  button.disabled = true;

  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    // TODO : 페이지 검증 필요성 확인 필요
    // if (!tab?.url?.includes("merge_requests")) {
    //   status.textContent = "올바른 페이지가 아닙니다!";
    //   button.disabled = false;
    //   return;
    // }

    const response = await MessageDispatcher.sendSuccess(
      "START_INTERCEPTOR_COMMIT"
    );

    if (response.status === "success") {
      status.textContent = "API 응답 감시 중...";
      return;
    }
    status.textContent = "시작 실패!";
    button.disabled = false;
  } catch (error) {
    console.error("Error:", error);
    status.textContent = "오류가 발생했습니다!";
    button.disabled = false;
  }
};

const handleClipboardCopy = (
  message: MessagePayload,
  elements: StatusElements
): void => {
  const { button, status } = elements;

  switch (message.action) {
    case "COPY_TO_CLIPBOARD":
      if (message.data) {
        navigator.clipboard
          .writeText(message.data)
          .then(() => {
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

    case "INTERCEPTOR_COMMIT_FAILED":
      console.error("모니터링 실패:", message.error);
      status.textContent = `실패: ${message.error}`;
      button.disabled = false;
      break;
  }
};

(async function initializePopup() {
  document.addEventListener("DOMContentLoaded", function () {
    const elements = getStatusElements();
    if (!elements) return;

    setupEventListeners(elements);
  });
})();
