import { MonitoringController } from "./services/MonitoringController.js";
import { DebuggerService } from "./services/DebuggerService.js";
import { MessageDispatcher } from "./services/MessageDispatcher.js";

const monitoringController = new MonitoringController();
const debuggerService = new DebuggerService();

// 모니터링 시작 처리
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "startMonitoring") {
    handleStartMonitoring(sendResponse);
    return true;
  }
});

// 네트워크 응답 처리
chrome.debugger.onEvent.addListener((source, method, params) => {
  if (method === "Network.responseReceived") {
    handleNetworkResponse(source, params);
  }
});

async function handleStartMonitoring(sendResponse) {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      lastFocusedWindow: true,
    });

    if (!tab?.id) {
      throw new Error("활성 탭을 찾을 수 없습니다.");
    }

    monitoringController.startMonitoring();
    await debuggerService.attach(tab.id);

    // 5초 타임아웃 설정
    monitoringController.setTimeout(() => {
      monitoringController.stopMonitoring();
      if (tab.id) {
        debuggerService.detach(tab.id);
      }
      MessageDispatcher.sendMonitoringFailed("API 응답 시간 초과");
    }, 5000);

    // 페이지 새로고침
    await chrome.tabs.reload(tab.id);

    sendResponse({ status: "success" });
  } catch (error) {
    console.error("Monitoring start failed:", error);
    MessageDispatcher.sendMonitoringFailed("모니터링 시작 실패");
  }
}

async function handleNetworkResponse(source, params) {
  if (!monitoringController.isMonitoring) return;

  if (params.response.url.includes("commits.json")) {
    try {
      const response = await debuggerService.getResponseBody(
        source.tabId,
        params.requestId
      );

      if (response?.body) {
        try {
          const jsonResponse = JSON.parse(response.body);
          const commits: CommitInfo[] = [];

          // HTML 문자열에서 커밋 정보 추출
          const commitPattern =
            /<li class="commit flex-row[^>]*>[\s\S]*?<\/li>/g;
          const messagePattern =
            /<a class="commit-row-message item-title[^>]*>([^<]+)<\/a>/;
          const descPattern =
            /<pre class="commit-row-description[^>]*>([^<]+)<\/pre>/;
          const datePattern = /<time[^>]*datetime="([^"]+)"/;
          const authorPattern =
            /<a class="commit-author-link[^>]*>([^<]+)<\/a>/;
          const shaPattern =
            /<div class="label label-monospace[^>]*>([^<]+)<\/div>/;

          let match;
          while ((match = commitPattern.exec(jsonResponse.html)) !== null) {
            const commitHtml = match[0];

            const message = messagePattern.exec(commitHtml)?.[1]?.trim();
            const description = descPattern.exec(commitHtml)?.[1];
            const date = datePattern.exec(commitHtml)?.[1];
            const author = authorPattern.exec(commitHtml)?.[1]?.trim();
            const sha = shaPattern.exec(commitHtml)?.[1]?.trim();

            if (message && date && author && sha) {
              commits.push({
                message,
                description: description
                  ? decodeHtmlEntities(description.trim())
                  : undefined,
                date,
                author,
                sha,
              });
            }
          }

          console.log("Original commits:", commits); // 디버깅용

          // 커밋 메시지에서 'feat:', 'fix:' 등을 제거하는 함수
          const cleanMessage = (message: string) => {
            return message
              .replace(
                /^(feat|fix|refactor|chore|docs|style|test|perf):\s*/i,
                ""
              )
              .trim();
          };

          // 임시 배열로 변환하여 정렬
          const sortedCommits = commits
            .map((commit) => {
              let key = "-";
              if (commit.description) {
                const ticketMatch = commit.description.match(/[A-Z]+[-_]\d+/);
                if (ticketMatch) {
                  key = ticketMatch[0];
                }
              }
              return {
                key,
                message: cleanMessage(commit.message),
              };
            })
            .sort((a, b) => {
              if (a.key === "-") return 1;
              if (b.key === "-") return -1;
              return a.key.localeCompare(b.key);
            });

          // 정렬된 결과를 문자열로 변환
          const formattedText = sortedCommits
            .map(({ key, message }) => {
              return key === "-" ? `- ${message}` : `- ${key} : ${message}`;
            })
            .join("\n");

          // 티켓 번호 요약 생성
          const ticketSummary = sortedCommits.reduce((acc, { key }) => {
            if (key !== "-") {
              // 티켓 타입별로 분류 (DEV, QA 등)
              const ticketType = key.split(/[-_]/)[0];
              const ticketNumber = key.split(/[-_]/)[1];

              if (!acc[ticketType]) {
                acc[ticketType] = [];
              }
              acc[ticketType].push(ticketNumber);
            }
            return acc;
          }, {} as Record<string, string[]>);

          // 티켓 요약 텍스트 생성
          const summaryText = Object.entries(ticketSummary)
            .map(([type, numbers]) => {
              const sortedNumbers = numbers
                .map(Number)
                .sort((a, b) => a - b)
                .join(",");
              return `${type}_${sortedNumbers}`;
            })
            .join(" / ");

          // 최종 텍스트 생성 (커밋 목록 + 요약)
          const finalText = formattedText + "\n\n" + summaryText;

          monitoringController.stopMonitoring();
          debuggerService.detach(source.tabId);
          MessageDispatcher.sendCopyToClipboard(finalText);
        } catch (error) {
          console.error("Parsing error:", error);
          MessageDispatcher.sendMonitoringFailed("커밋 데이터 파싱 실패");
        }
      }
    } catch (error) {
      console.error("Response body error:", error);
      MessageDispatcher.sendMonitoringFailed("응답 데이터 가져오기 실패");
    }
  }
}

interface CommitInfo {
  message: string;
  description?: string;
  date: string;
  author: string;
  sha: string;
}

function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    "&#x000A;": "\n",
    "&quot;": '"',
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&#39;": "'",
    "&nbsp;": " ",
  };

  return text.replace(/&[#\w]+;/g, (entity) => entities[entity] || entity);
}
