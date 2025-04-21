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
