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
  toast: HTMLDivElement;
  summaryCheckbox: HTMLInputElement;
}

interface StoredData {
  messages: {
    key: string;
    text: string;
    checked: boolean;
  }[];
  summary: string;
  summaryChecked: boolean;
}

const getStatusElements = (): StatusElements | null => {
  const startButton = document.getElementById(
    "startButton"
  ) as HTMLButtonElement;
  const copyButton = document.getElementById("copyButton") as HTMLButtonElement;
  const statusDiv = document.getElementById("status") as HTMLDivElement;
  const messageList = document.getElementById("messageList") as HTMLDivElement;
  const toast = document.getElementById("toast") as HTMLDivElement;
  const summaryCheckbox = document.getElementById(
    "summaryCheckbox"
  ) as HTMLInputElement;

  if (
    !startButton ||
    !statusDiv ||
    !copyButton ||
    !messageList ||
    !toast ||
    !summaryCheckbox
  ) {
    console.error("필수 DOM 엘리먼트를 찾을 수 없습니다.");
    return null;
  }

  return {
    button: startButton,
    copyButton: copyButton,
    status: statusDiv,
    messageList: messageList,
    toast: toast,
    summaryCheckbox: summaryCheckbox,
  };
};

const setupEventListeners = (elements: StatusElements): void => {
  const { button, copyButton, messageList, status, summaryCheckbox } = elements;

  button.addEventListener("click", () => {
    handleStartInterceptorCommit(elements);
  });

  copyButton.addEventListener("click", () => {
    const { messageList, status, summaryCheckbox } = elements;

    let copyText = "";

    // 요약이 체크되어 있으면 먼저 추가
    if (summaryCheckbox.checked && status.textContent) {
      copyText += `${status.textContent}\n\n`;
    }

    // 선택된 메시지들 추가
    const selectedMessages = Array.from(
      messageList.querySelectorAll('input[type="checkbox"]:checked')
    )
      .map((checkbox) => {
        const label = checkbox.nextElementSibling as HTMLLabelElement;
        const keyInput = label.querySelector(".key-input") as HTMLInputElement;
        const messageText = label.querySelector(
          ".message-text"
        ) as HTMLSpanElement;

        const key = keyInput.value.trim();
        const text = messageText.textContent || "";

        return key ? `- ${key} : ${text}` : `- ${text}`;
      })
      .join("\n");

    copyText += selectedMessages;

    if (copyText) {
      navigator.clipboard
        .writeText(copyText)
        .then(() => {
          showToast(elements, "선택된 메시지가 복사되었습니다!", "success");
        })
        .catch((err) => {
          console.error("클립보드 복사 실패:", err);
          showToast(elements, "복사 실패!", "error");
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

const showToast = (
  elements: StatusElements,
  message: string,
  type: "success" | "error" = "success"
) => {
  const { toast } = elements;

  toast.textContent = message;
  toast.className = `toast ${type} show`;

  setTimeout(() => {
    toast.className = "toast";
  }, 3000);
};

const handleStartInterceptorCommit = async (
  elements: StatusElements
): Promise<void> => {
  const { button, status } = elements;
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
      return;
    }
    showToast(elements, "시작 실패!", "error");
    button.disabled = false;
  } catch (error) {
    console.error("Error:", error);
    showToast(elements, "오류가 발생했습니다!", "error");
    button.disabled = false;
  }
};

const toggleSummaryCheckbox = (elements: StatusElements) => {
  const { status, summaryCheckbox } = elements;
  const parentElement = summaryCheckbox.closest(".status-checkbox");
  if (parentElement instanceof HTMLElement) {
    if (status.textContent && status.textContent !== "-") {
      parentElement.style.display = "block";
    } else {
      parentElement.style.display = "none";
    }
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

  status.textContent = summary || "-";
  toggleSummaryCheckbox(elements);
  saveToStorage(elements);
};

const saveToStorage = async (elements: StatusElements): Promise<void> => {
  const { messageList, status, summaryCheckbox } = elements;

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
      summaryChecked: summaryCheckbox.checked,
    },
  });
};

const loadFromStorage = async (elements: StatusElements): Promise<void> => {
  const { messageList, status, copyButton, summaryCheckbox } = elements;

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

    status.textContent = storedData.summary || "-";
    copyButton.disabled = false;
  }

  toggleSummaryCheckbox(elements);

  if (storedData?.summaryChecked !== undefined) {
    summaryCheckbox.checked = storedData.summaryChecked;
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
