import { CommitMessageFormatter } from "./services/git/parser/CommitMessageFormatter.js";
import { GIT_SERVICE_INFO } from "./services/git/types.js";
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
  previewContent: HTMLDivElement;
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
  const previewContent = document.getElementById(
    "previewContent"
  ) as HTMLDivElement;

  if (
    !startButton ||
    !statusDiv ||
    !copyButton ||
    !messageList ||
    !toast ||
    !summaryCheckbox ||
    !previewContent
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
    previewContent,
  };
};

const setupEventListeners = (elements: StatusElements): void => {
  const { button, previewContent } = elements;

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentUrl = tabs[0]?.url || "";
    const isValidPath = currentUrl.includes(GIT_SERVICE_INFO.gitlab.domain);

    updateUIForValidPath(elements, isValidPath);
  });

  const {
    copyButton,
    messageList: messageListFromElements,
    status,
    summaryCheckbox,
  } = elements;

  button.addEventListener("click", () => {
    handleStartInterceptorCommit(elements);
  });

  copyButton.addEventListener("click", () => {
    const textToCopy = previewContent.textContent;

    if (textToCopy && textToCopy !== "선택된 항목이 여기에 표시됩니다") {
      navigator.clipboard
        .writeText(textToCopy)
        .then(() => {
          showToast(elements, "복사되었습니다.", "success");
        })
        .catch((err) => {
          console.error("클립보드 복사 실패:", err);
          showToast(elements, "복사 실패!", "error");
        });
    }
  });

  messageListFromElements.addEventListener("change", (e) => {
    if (e.target instanceof HTMLInputElement && e.target.type === "checkbox") {
      updateSummary(elements);
      updatePreview(elements);
      saveToStorage(elements);
    }
  });

  summaryCheckbox.addEventListener("change", () => {
    updatePreview(elements);
    saveToStorage(elements);
  });

  chrome.runtime.onMessage.addListener((message: MessagePayload) => {
    handleClipboardCopy(message, elements);
  });

  // 드래그 앤 드롭 이벤트 리스너 추가
  messageListFromElements.addEventListener("dragstart", (e) => {
    if (e.target instanceof HTMLElement && e.target.closest(".message-item")) {
      const item = e.target.closest(".message-item");
      item?.classList.add("dragging");
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = "move";
      }

      // 드래그 시작 시 다른 아이템들의 시각적 피드백을 위한 클래스 추가
      const items = messageListFromElements.querySelectorAll(
        ".message-item:not(.dragging)"
      );
      items.forEach((item) => item.classList.add("can-drop"));
    }
  });

  messageListFromElements.addEventListener("dragend", (e) => {
    if (e.target instanceof HTMLElement && e.target.closest(".message-item")) {
      const item = e.target.closest(".message-item");
      item?.classList.remove("dragging");

      // 드래그 종료 시 모든 시각적 피드백 클래스 제거
      const items = messageListFromElements.querySelectorAll(".message-item");
      items.forEach((item) => {
        item.classList.remove("can-drop", "drag-over");
      });

      updateSummary(elements);
      updatePreview(elements);
      saveToStorage(elements);
    }
  });

  messageListFromElements.addEventListener("dragover", (e) => {
    e.preventDefault();
    const draggingItem = messageListFromElements.querySelector(".dragging");
    if (!draggingItem) return;

    // 이전 drag-over 클래스 제거
    const prevDragOver = messageListFromElements.querySelector(".drag-over");
    prevDragOver?.classList.remove("drag-over");

    const siblings = Array.from(
      messageListFromElements.querySelectorAll(".message-item:not(.dragging)")
    );
    const nextSibling = siblings.find((sibling) => {
      const rect = sibling.getBoundingClientRect();
      return e.clientY < rect.top + rect.height / 2;
    });

    if (nextSibling) {
      nextSibling.classList.add("drag-over");
      messageListFromElements.insertBefore(draggingItem, nextSibling);
    } else {
      const lastSibling = siblings[siblings.length - 1];
      if (lastSibling) {
        lastSibling.classList.add("drag-over");
      }
      messageListFromElements.appendChild(draggingItem);
    }
  });
};

const updateUIForValidPath = (
  elements: StatusElements,
  isValid: boolean
): void => {
  const { button, previewContent } = elements;

  if (!isValid) {
    button.disabled = true;
    button.innerHTML = `Commit 메세지 불러오기<br><span class="error-text" style="font-size: 12px;">유효한 페이지에서 사용 가능합니다.<br>${GIT_SERVICE_INFO.gitlab.domain}</span>`;
    previewContent.textContent = "Merge Request 페이지에서 실행해주세요";
  } else {
    button.disabled = false;
    button.textContent = "Commit 메세지 불러오기";
    if (
      previewContent.textContent === "Merge Request 페이지에서 실행해주세요"
    ) {
      previewContent.textContent = "선택된 항목이 여기에 표시됩니다";
    }
  }
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

    if (!tab?.url?.includes("merge_requests")) {
      status.textContent = "올바른 페이지가 아닙니다!";
      button.disabled = false;
      return;
    }

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

const updatePreview = (elements: StatusElements): void => {
  const { messageList, status, summaryCheckbox, previewContent } = elements;
  let previewText = "";

  // 요약이 체크되어 있으면 먼저 추가
  if (summaryCheckbox.checked && status.textContent) {
    previewText += `${status.textContent}\n\n`;
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

  previewText += selectedMessages;

  if (!previewText.trim()) {
    previewText = "선택된 항목이 여기에 표시됩니다";
  }

  previewContent.textContent = previewText;
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

const createMessageItem = (
  msg: { key: string; text: string; checked: boolean },
  index: number
): HTMLElement => {
  const div = document.createElement("div");
  div.className = "message-item";
  div.draggable = true; // 드래그 가능하도록 설정

  const messageHtml = `
    <input type="checkbox" id="msg-${index}" ${msg.checked ? "checked" : ""}>
    <label for="msg-${index}">
      <input type="text" class="key-input" value="${
        msg.key || ""
      }" placeholder="키 입력">
      <span class="message-text">${msg.text}</span>
    </label>
  `;

  div.innerHTML = messageHtml;
  return div;
};

const loadFromStorage = async (elements: StatusElements): Promise<void> => {
  const { messageList, status, copyButton, summaryCheckbox } = elements;

  const { storedData } = (await chrome.storage.local.get("storedData")) as {
    storedData: StoredData;
  };

  if (storedData?.messages?.length) {
    messageList.innerHTML = "";
    storedData.messages.forEach((msg, index) => {
      const div = createMessageItem(msg, index);
      messageList.appendChild(div);

      const keyInput = div.querySelector(".key-input") as HTMLInputElement;
      keyInput.addEventListener("input", () => {
        updateSummary(elements);
        updatePreview(elements);
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

  updatePreview(elements);
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
        const div = createMessageItem({ ...msg, checked: true }, index);
        messageList.appendChild(div);

        const keyInput = div.querySelector(".key-input") as HTMLInputElement;
        keyInput.addEventListener("input", () => {
          updateSummary(elements);
          updatePreview(elements);
          saveToStorage(elements);
        });
      });

      updateSummary(elements);
      updatePreview(elements);
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
