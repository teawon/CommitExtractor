const CONTEXT_MENU_ID = "openCommitExtractorPopup";

function createContextMenu() {
  chrome.contextMenus.create({
    id: CONTEXT_MENU_ID,
    title: "CommitExtractor 열기",
    contexts: ["page"],
  });
}

function handleContextMenuClick(
  info: chrome.contextMenus.OnClickData,
  tab?: chrome.tabs.Tab
) {
  if (info.menuItemId === CONTEXT_MENU_ID) {
    const originalTabId = tab?.id;
    const originalUrl = tab?.url;

    if (!originalTabId || !originalUrl) {
      console.error(
        "Could not get the original tab ID or URL for context menu action."
      );
      return;
    }

    const encodedUrl = encodeURIComponent(originalUrl);
    const popupUrl = chrome.runtime.getURL(
      `base.html?originalTabId=${originalTabId}&originalUrl=${encodedUrl}`
    );

    const windowWidth = 800;
    const windowHeight = 600;

    chrome.windows.create({
      url: popupUrl,
      type: "popup",
      width: windowWidth,
      height: windowHeight,
    });
  }
}

export function initializeContextMenu(): void {
  chrome.contextMenus.removeAll(() => {
    createContextMenu();
  });

  chrome.runtime.onInstalled.addListener(createContextMenu);

  chrome.contextMenus.onClicked.addListener(handleContextMenuClick);
}
