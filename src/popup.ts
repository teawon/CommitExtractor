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

interface StoredData {
  messages: {
    key: string;
    text: string;
    checked: boolean;
  }[];
  summary: string;
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
      const keyInput = label.querySelector(".key-input") as HTMLInputElement;
      const messageText = label.querySelector(
        ".message-text"
      ) as HTMLSpanElement;

      return {
        key: keyInput.value.trim(),
        text: messageText.textContent || "",
      };
    })
  );

  status.textContent = summary;
  saveToStorage(elements);
};

const saveToStorage = async (elements: StatusElements): Promise<void> => {
  const { messageList, status } = elements;

  const messages = Array.from(
    messageList.querySelectorAll(".message-item")
  ).map((item) => {
    const checkbox = item.querySelector(
      'input[type="checkbox"]'
    ) as HTMLInputElement;
    const keyInput = item.querySelector(".key-input") as HTMLInputElement;
    const messageText = item.querySelector(".message-text") as HTMLSpanElement;

    return {
      key: keyInput.value.trim(),
      text: messageText.textContent || "",
      checked: checkbox.checked,
    };
  });

  await chrome.storage.local.set({
    storedData: {
      messages,
      summary: status.textContent,
    },
  });
};

const loadFromStorage = async (elements: StatusElements): Promise<void> => {
  const { messageList, status, copyButton } = elements;

  const { storedData } = (await chrome.storage.local.get("storedData")) as {
    storedData: StoredData;
  };

  if (storedData?.messages?.length) {
    messageList.innerHTML = "";
    storedData.messages.forEach((msg, index) => {
      const div = document.createElement("div");
      div.className = "message-item";

      const messageHtml = `
        <input type="checkbox" id="msg-${index}" ${
        msg.checked ? "checked" : ""
      }>
        <label for="msg-${index}">
          <input type="text" class="key-input" value="${
            msg.key || ""
          }" placeholder="키 입력">
          <span class="message-text">${msg.text}</span>
        </label>
      `;

      div.innerHTML = messageHtml;
      messageList.appendChild(div);

      const keyInput = div.querySelector(".key-input") as HTMLInputElement;
      keyInput.addEventListener("input", () => {
        updateSummary(elements);
        saveToStorage(elements);
      });
    });

    status.textContent = storedData.summary || "대기중...";
    copyButton.disabled = false;
  }
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

        const messageHtml = `
          <input type="checkbox" id="msg-${index}" checked>
          <label for="msg-${index}">
            <input type="text" class="key-input" value="${
              msg.key || ""
            }" placeholder="키 입력">
            <span class="message-text">${msg.text}</span>
          </label>
        `;

        div.innerHTML = messageHtml;
        messageList.appendChild(div);

        const keyInput = div.querySelector(".key-input") as HTMLInputElement;
        keyInput.addEventListener("input", () => {
          updateSummary(elements);
          saveToStorage(elements);
        });
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
  document.addEventListener("DOMContentLoaded", async function () {
    const elements = getStatusElements();
    if (!elements) return;

    setupEventListeners(elements);
    await loadFromStorage(elements);
  });
})();
