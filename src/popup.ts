import { CommitMessageFormatter } from "./services/git/parser/CommitMessageFormatter";
import { GIT_SERVICE_INFO } from "./services/git/types";
import {
  MessageDispatcher,
  MessagePayload,
} from "./services/MessageDispatcher";
import {
  loadPopupState,
  savePopupState,
  PopupState,
  loadPreviewHistory,
  addPreviewHistoryItem,
  removePreviewHistoryItem,
  PreviewHistoryItem,
} from "./services/popupStorageService";

interface StatusElements {
  button: HTMLButtonElement;
  copyButton: HTMLButtonElement;
  status: HTMLDivElement;
  messageList: HTMLDivElement;
  toast: HTMLDivElement;
  summaryCheckbox: HTMLInputElement;
  previewContent: HTMLDivElement;
  ticketRegexInput: HTMLInputElement;
  resetRegexButton: HTMLButtonElement;
  toggleRegexButton: HTMLButtonElement;
  regexInputContainer: HTMLDivElement;
  cleanRegexInput: HTMLInputElement;
  resetCleanRegexButton: HTMLButtonElement;
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
  const ticketRegexInput = document.getElementById(
    "ticketRegexInput"
  ) as HTMLInputElement;
  const resetRegexButton = document.getElementById(
    "resetRegexButton"
  ) as HTMLButtonElement;
  const toggleRegexButton = document.getElementById(
    "toggleRegexButton"
  ) as HTMLButtonElement;
  const regexInputContainer = document.getElementById(
    "regexInputContainer"
  ) as HTMLDivElement;
  const cleanRegexInput = document.getElementById(
    "cleanRegexInput"
  ) as HTMLInputElement;
  const resetCleanRegexButton = document.getElementById(
    "resetCleanRegexButton"
  ) as HTMLButtonElement;

  if (
    !startButton ||
    !statusDiv ||
    !copyButton ||
    !messageList ||
    !toast ||
    !summaryCheckbox ||
    !previewContent ||
    !ticketRegexInput ||
    !resetRegexButton ||
    !toggleRegexButton ||
    !regexInputContainer ||
    !cleanRegexInput ||
    !resetCleanRegexButton
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
    ticketRegexInput,
    resetRegexButton,
    toggleRegexButton,
    regexInputContainer,
    cleanRegexInput,
    resetCleanRegexButton,
  };
};

const getCurrentStateFromDOM = (elements: StatusElements): PopupState => {
  const {
    messageList,
    status,
    summaryCheckbox,
    ticketRegexInput,
    cleanRegexInput,
  } = elements;
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

  return {
    messages,
    summary: status.textContent || "",
    summaryChecked: summaryCheckbox.checked,
    ticketRegex: ticketRegexInput.value,
    cleanRegex: cleanRegexInput.value,
  };
};

const setupEventListeners = (elements: StatusElements): void => {
  const { button, previewContent } = elements;

  const urlParams = new URLSearchParams(window.location.search);
  const originalUrlParam = urlParams.get("originalUrl");

  if (originalUrlParam) {
    try {
      const decodedUrl = decodeURIComponent(originalUrlParam);
      const isValidPath = new RegExp(GIT_SERVICE_INFO.gitlab.domain).test(
        decodedUrl
      );
      updateUIForValidPath(elements, isValidPath, decodedUrl);
    } catch (e) {
      console.error("Failed to decode URL parameter:", e);
      updateUIForValidPath(elements, false, "Invalid URL parameter");
    }
  } else {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const currentUrl = tabs[0]?.url || "";
      const isValidPath = new RegExp(GIT_SERVICE_INFO.gitlab.domain).test(
        currentUrl
      );
      updateUIForValidPath(elements, isValidPath, currentUrl);
    });
  }

  const {
    copyButton,
    messageList: messageListFromElements,
    summaryCheckbox,
    ticketRegexInput,
    resetRegexButton,
    toggleRegexButton,
    regexInputContainer,
    cleanRegexInput,
    resetCleanRegexButton,
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
      savePopupState(getCurrentStateFromDOM(elements));
    }
  });

  messageListFromElements.addEventListener("input", (e) => {
    if (
      e.target instanceof HTMLInputElement &&
      e.target.classList.contains("key-input")
    ) {
      updateSummary(elements);
      updatePreview(elements);
      savePopupState(getCurrentStateFromDOM(elements));
    }
  });

  summaryCheckbox.addEventListener("change", () => {
    updatePreview(elements);
    savePopupState(getCurrentStateFromDOM(elements));
  });

  chrome.runtime.onMessage.addListener((message: MessagePayload) => {
    handleClipboardCopy(message, elements);
    savePopupState(getCurrentStateFromDOM(elements));
  });

  messageListFromElements.addEventListener("dragstart", (e) => {
    if (e.target instanceof HTMLElement && e.target.closest(".message-item")) {
      const item = e.target.closest(".message-item");
      item?.classList.add("dragging");
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = "move";
      }

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

      const items = messageListFromElements.querySelectorAll(".message-item");
      items.forEach((item) => {
        item.classList.remove("can-drop", "drag-over");
      });

      updateSummary(elements);
      updatePreview(elements);
      savePopupState(getCurrentStateFromDOM(elements));
    }
  });

  messageListFromElements.addEventListener("dragover", (e) => {
    e.preventDefault();
    const draggingItem = messageListFromElements.querySelector(".dragging");
    if (!draggingItem) return;

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

  ticketRegexInput.addEventListener("change", () => {
    const pattern = ticketRegexInput.value.replace(/^\/|\/$/g, "");
    try {
      new RegExp(pattern);
      CommitMessageFormatter.setTicketRegex(ticketRegexInput.value);
      savePopupState(getCurrentStateFromDOM(elements));
      showToast(elements, "정규식이 업데이트되었습니다.", "success");
      updateSummary(elements);
      updatePreview(elements);
    } catch (error) {
      showToast(elements, "유효하지 않은 정규식입니다.", "error");
      ticketRegexInput.value = `/${CommitMessageFormatter.getDefaultTicketPattern()}/`;
      CommitMessageFormatter.setTicketRegex(ticketRegexInput.value);
      savePopupState(getCurrentStateFromDOM(elements));
    }
  });

  resetRegexButton.addEventListener("click", () => {
    ticketRegexInput.value = `/${CommitMessageFormatter.getDefaultTicketPattern()}/`;
    CommitMessageFormatter.setTicketRegex(ticketRegexInput.value);
    updateSummary(elements);
    updatePreview(elements);
    savePopupState(getCurrentStateFromDOM(elements));
    showToast(elements, "기본 정규식으로 초기화되었습니다.", "success");
  });

  toggleRegexButton.addEventListener("click", () => {
    const toggleIcon = toggleRegexButton.querySelector(".toggle-icon");
    regexInputContainer.classList.toggle("hidden");
    toggleIcon?.classList.toggle("open");
  });

  cleanRegexInput.addEventListener("change", () => {
    const pattern = cleanRegexInput.value.replace(/^\/|\/$/g, "");
    try {
      new RegExp(pattern);
      CommitMessageFormatter.setCleanRegex(cleanRegexInput.value);
      savePopupState(getCurrentStateFromDOM(elements));
      showToast(
        elements,
        "접두사 제거 정규식이 업데이트되었습니다.",
        "success"
      );
      updateSummary(elements);
      updatePreview(elements);
    } catch (error) {
      showToast(elements, "유효하지 않은 정규식입니다.", "error");
      cleanRegexInput.value = CommitMessageFormatter.getDefaultCleanPattern();
      CommitMessageFormatter.setCleanRegex(cleanRegexInput.value);
      savePopupState(getCurrentStateFromDOM(elements));
    }
  });

  resetCleanRegexButton.addEventListener("click", () => {
    cleanRegexInput.value = CommitMessageFormatter.getDefaultCleanPattern();
    CommitMessageFormatter.setCleanRegex(cleanRegexInput.value);
    updateSummary(elements);
    updatePreview(elements);
    savePopupState(getCurrentStateFromDOM(elements));
    showToast(
      elements,
      "기본 접두사 제거 정규식으로 초기화되었습니다.",
      "success"
    );
  });
};

const updateUIForValidPath = (
  elements: StatusElements,
  isValid: boolean,
  url: string
): void => {
  const { button, previewContent } = elements;

  if (!isValid) {
    button.disabled = true;
    button.innerHTML = `Commit 메세지 불러오기<br><span class="error-text" style="font-size: 12px;">유효한 페이지(${GIT_SERVICE_INFO.gitlab.urlGuidanceMessage})에서 사용 가능합니다.</span>`;
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
  const { button } = elements;
  button.disabled = true;

  try {
    let targetTabId: number | undefined;

    // 현재 URL에서 originalTabId 파라미터를 확인
    const urlParams = new URLSearchParams(window.location.search);
    const originalTabIdParam = urlParams.get("originalTabId");

    const openByContextMenu = originalTabIdParam !== null;

    if (openByContextMenu) {
      targetTabId = parseInt(originalTabIdParam, 10);
      if (isNaN(targetTabId)) {
        throw new Error("Invalid originalTabId parameter.");
      }
    } else {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      targetTabId = tab?.id;
    }

    if (!targetTabId) {
      throw new Error("유효한 대상 탭 ID를 찾을 수 없습니다.");
    }

    const response = await MessageDispatcher.sendSuccess(
      "START_INTERCEPTOR_COMMIT",
      { targetTabId: targetTabId }
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

  status.textContent = summary;
  toggleSummaryCheckbox(elements);
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

// 상태 변수: 현재 선택된 기록 ID (기록탭에서만 사용)
let selectedHistoryId: string | null = null;
let lastMainPreview: string = "";

function setPreviewContent(content: string | null) {
  const previewContent = document.getElementById(
    "previewContent"
  ) as HTMLDivElement;
  if (content === null) {
    previewContent.textContent = "";
  } else {
    previewContent.textContent = content;
  }
}

function getMainPreviewContent(): string {
  // 메인탭 기준 복사 미리보기 내용 추출
  const previewContent = document.getElementById(
    "previewContent"
  ) as HTMLDivElement;
  return previewContent.textContent || "";
}

// 탭 전환 및 기록 기능 수정
function setupTabsAndHistory() {
  const tabMain = document.getElementById("tabMain") as HTMLButtonElement;
  const tabHistory = document.getElementById("tabHistory") as HTMLButtonElement;
  const mainSection = document.getElementById("mainSection") as HTMLElement;
  const historySection = document.getElementById(
    "historySection"
  ) as HTMLElement;
  const historyList = document.getElementById(
    "historyList"
  ) as HTMLUListElement;

  function showMain() {
    mainSection.style.display = "block";
    historySection.style.display = "none";
    tabMain.classList.add("active");
    tabHistory.classList.remove("active");
    selectedHistoryId = null;
    setPreviewContent(lastMainPreview); // 메인 기준 데이터 표시
  }
  function showHistory() {
    mainSection.style.display = "none";
    historySection.style.display = "block";
    tabMain.classList.remove("active");
    tabHistory.classList.add("active");
    selectedHistoryId = null;
    setPreviewContent(""); // 아무것도 선택 안 했을 때 preview 비움
    renderHistoryList();
  }
  tabMain.addEventListener("click", showMain);
  tabHistory.addEventListener("click", showHistory);

  async function renderHistoryList() {
    const history = await loadPreviewHistory();
    historyList.innerHTML = "";
    if (history.length === 0) {
      historyList.innerHTML =
        '<li style="color:#888; padding:12px;">기록이 없습니다.</li>';
      return;
    }
    history.forEach((item) => {
      const li = document.createElement("li");
      li.style.display = "flex";
      li.style.alignItems = "center";
      li.style.justifyContent = "space-between";
      li.style.padding = "8px 0";
      li.style.borderBottom = "1px solid #eee";
      li.style.cursor = "pointer";
      li.innerHTML = `<span style='flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'>${item.content.slice(
        0,
        40
      )}${
        item.content.length > 40 ? "..." : ""
      }</span><button class='history-delete' data-id='${
        item.id
      }' style='margin-left:8px;color:#dc3545;background:none;border:none;font-size:16px;cursor:pointer;'>×</button>`;
      li.addEventListener("click", (e) => {
        if ((e.target as HTMLElement).classList.contains("history-delete"))
          return;
        selectedHistoryId = item.id;
        setPreviewContent(item.content);
      });
      li.querySelector(".history-delete")?.addEventListener(
        "click",
        async (e) => {
          e.stopPropagation();
          await removePreviewHistoryItem(item.id);
          // 삭제 후, 선택된 기록이 삭제된 경우 preview 비움
          if (selectedHistoryId === item.id) {
            selectedHistoryId = null;
            setPreviewContent("");
          }
          renderHistoryList();
        }
      );
      historyList.appendChild(li);
    });
  }

  // 기본은 메인 탭
  showMain();
}

// Commit 메세지 불러오기 버튼 클릭 시 복사 미리보기 결과를 기록에 저장
async function savePreviewToHistory(previewContent: string) {
  if (!previewContent || previewContent === "선택된 항목이 여기에 표시됩니다")
    return;
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const dateStr = `${yy}-${mm}-${dd}`;
  const contentWithDate = `${dateStr}\n${previewContent}`;
  const item: PreviewHistoryItem = {
    id: Date.now().toString(),
    content: contentWithDate,
    createdAt: Date.now(),
  };
  await addPreviewHistoryItem(item);
}

// DOMContentLoaded 시 마지막 메인 preview 저장
(async function initializePopup() {
  document.addEventListener("DOMContentLoaded", async function () {
    setupTabsAndHistory();
    const elements = getStatusElements();
    if (!elements) return;
    // 메인 preview 내용 추적
    lastMainPreview = elements.previewContent.textContent || "";
    const initialState = await loadPopupState();

    const {
      messageList,
      status,
      summaryCheckbox,
      ticketRegexInput,
      cleanRegexInput,
      copyButton,
      regexInputContainer,
    } = elements;

    messageList.innerHTML = "";
    initialState.messages.forEach((msg, index) => {
      const div = createMessageItem(msg, index);
      messageList.appendChild(div);

      const keyInput = div.querySelector(".key-input") as HTMLInputElement;
      keyInput.addEventListener("input", () => {
        updateSummary(elements);
        updatePreview(elements);
        savePopupState(getCurrentStateFromDOM(elements));
      });
    });

    status.textContent = initialState.summary || "-";
    copyButton.disabled = !initialState.messages.length;
    summaryCheckbox.checked = initialState.summaryChecked;
    ticketRegexInput.value = initialState.ticketRegex;
    cleanRegexInput.value = initialState.cleanRegex;

    CommitMessageFormatter.setTicketRegex(initialState.ticketRegex);
    CommitMessageFormatter.setCleanRegex(initialState.cleanRegex);

    toggleSummaryCheckbox(elements);
    updatePreview(elements);

    regexInputContainer.classList.add("hidden");

    setupEventListeners(elements);
  });
})();

// handleClipboardCopy에서 메인 preview 갱신 시 lastMainPreview도 갱신
const handleClipboardCopy = (
  message: MessagePayload,
  elements: StatusElements
): void => {
  const { button, copyButton, messageList, previewContent } = elements;

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
        });
      });

      updateSummary(elements);
      updatePreview(elements);
      button.disabled = false;
      copyButton.disabled = false;
      savePopupState(getCurrentStateFromDOM(elements));
      savePreviewToHistory(previewContent.textContent || "");
      // 메인 preview 최신값 저장
      lastMainPreview = previewContent.textContent || "";
      break;

    case "INTERCEPTOR_COMMIT_FAILED":
      console.error("모니터링 실패:", message.error);
      button.disabled = false;
      break;
  }
};
