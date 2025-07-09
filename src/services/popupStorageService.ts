import { CommitMessageFormatter } from "./git/parser/CommitMessageFormatter";

export interface PopupState {
  messages: {
    key: string;
    text: string;
    checked: boolean;
  }[];
  summary: string;
  summaryChecked: boolean;
  ticketRegex: string;
  cleanRegex: string;
}

const STORAGE_KEY = "popupState";

export async function loadPopupState(): Promise<PopupState> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const storedState = result[STORAGE_KEY] as Partial<PopupState> | undefined;

  const defaultState: PopupState = {
    messages: [],
    summary: "",
    summaryChecked: true,
    ticketRegex: `/${CommitMessageFormatter.getDefaultTicketPattern()}/`,
    cleanRegex: CommitMessageFormatter.getDefaultCleanPattern(),
  };

  const state = { ...defaultState, ...storedState };

  if (!storedState?.ticketRegex) {
    state.ticketRegex = defaultState.ticketRegex;
    CommitMessageFormatter.setTicketRegex(state.ticketRegex);
  }
  if (!storedState?.cleanRegex) {
    state.cleanRegex = defaultState.cleanRegex;
    CommitMessageFormatter.setCleanRegex(state.cleanRegex);
  }
  return state;
}

export async function savePopupState(state: PopupState): Promise<void> {
  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: state });
  } catch (error) {
    console.error("Failed to save popup state:", error);
  }
}

// 복사 미리보기 기록 타입
export interface PreviewHistoryItem {
  id: string; // 고유값 (timestamp 등)
  content: string;
  createdAt: number;
}
export type PreviewHistory = PreviewHistoryItem[];

const PREVIEW_HISTORY_KEY = "previewHistory";

export async function loadPreviewHistory(): Promise<PreviewHistory> {
  const result = await chrome.storage.local.get(PREVIEW_HISTORY_KEY);
  return (result[PREVIEW_HISTORY_KEY] as PreviewHistory) || [];
}

export async function savePreviewHistory(
  history: PreviewHistory
): Promise<void> {
  await chrome.storage.local.set({ [PREVIEW_HISTORY_KEY]: history });
}

export async function addPreviewHistoryItem(
  item: PreviewHistoryItem
): Promise<void> {
  const history = await loadPreviewHistory();
  history.unshift(item); // 최신순 정렬
  await savePreviewHistory(history);
}

export async function removePreviewHistoryItem(id: string): Promise<void> {
  const history = await loadPreviewHistory();
  const newHistory = history.filter((item) => item.id !== id);
  await savePreviewHistory(newHistory);
}
