import { CommitMessageFormatter } from "./services/git/parser/CommitMessageFormatter.js";
import {
  MessageDispatcher,
  MessagePayload,
} from "./services/MessageDispatcher.js";

interface StatusElements {
  button: HTMLButtonElement;
  copyButton: HTMLButtonElement;
  status: HTMLDivElement;
  messageList: HTMLDivElement;
}

const getStatusElements = (): StatusElements | null => {
  const startButton = document.getElementById(
    "startButton"
  ) as HTMLButtonElement;
  const copyButton = document.getElementById("copyButton") as HTMLButtonElement;
  const statusDiv = document.getElementById("status") as HTMLDivElement;
  const messageList = document.getElementById("messageList") as HTMLDivElement;

  if (!startButton || !statusDiv || !copyButton || !messageList) {
    console.error("필수 DOM 엘리먼트를 찾을 수 없습니다.");
    return null;
  }

  return {
    button: startButton,
    copyButton: copyButton,
    status: statusDiv,
    messageList: messageList,
  };
};

const setupEventListeners = (elements: StatusElements): void => {
  const { button, copyButton, messageList, status } = elements;

  button.addEventListener("click", () => {
    handleStartInterceptorCommit(elements);
  });

  copyButton.addEventListener("click", () => {
    const selectedMessages = Array.from(
      messageList.querySelectorAll('input[type="checkbox"]:checked')
    )
      .map(
        (checkbox) =>
          (checkbox.nextElementSibling as HTMLLabelElement).textContent
      )
      .filter((text) => text !== null)
      .join("\n");

    if (selectedMessages) {
      navigator.clipboard
        .writeText(selectedMessages)
        .then(() => {
          elements.status.textContent = "선택된 메시지가 복사되었습니다!";
        })
        .catch((err) => {
          console.error("클립보드 복사 실패:", err);
          elements.status.textContent = "복사 실패!";
        });
    }
  });

  messageList.addEventListener("change", (e) => {
    if (e.target instanceof HTMLInputElement && e.target.type === "checkbox") {
      updateSummary(elements);
    }
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

const updateSummary = (elements: StatusElements): void => {
  const { messageList, status } = elements;

  const summary = CommitMessageFormatter.generateKeySummary(
    Array.from(
      messageList.querySelectorAll('input[type="checkbox"]:checked')
    ).map((checkbox) => {
      const label = checkbox.nextElementSibling as HTMLLabelElement;
      const text = label.textContent || "";
      const strongText = label.querySelector("strong")?.textContent || "";

      return {
        key: strongText,
        text: strongText ? text.split(" : ")[1] : text,
      };
    })
  );

  status.textContent = summary;
};

const handleClipboardCopy = (
  message: MessagePayload,
  elements: StatusElements
): void => {
  const { button, copyButton, status, messageList } = elements;

  switch (message.action) {
    case "COPY_TO_CLIPBOARD":
      const data = message.data as {
        messages: { key: string; text: string }[];
      };

      const messages = data?.messages ?? [];

      messageList.innerHTML = "";
      messages.forEach((msg, index) => {
        const div = document.createElement("div");
        div.className = "message-item";
        const messageText = msg.key
          ? `<strong>${msg.key}</strong> : ${msg.text}`
          : `- ${msg.text}`;

        div.innerHTML = `
            <input type="checkbox" id="msg-${index}" checked>
            <label for="msg-${index}">${messageText}</label>
          `;
        messageList.appendChild(div);
      });

      updateSummary(elements);
      button.disabled = false;
      copyButton.disabled = false;
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
