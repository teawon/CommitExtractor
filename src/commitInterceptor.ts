import { CommitInterceptorService } from "./services/CommitInterceptorService.js";
import { TaskExecutionController } from "./services/TaskExecutionController.js";
import { DebuggerService } from "./services/DebuggerService.js";
import {
  MessageDispatcher,
  MessagePayload,
} from "./services/MessageDispatcher.js";
import { GitlabCommitParser } from "./services/git/parser/GitlabCommitParser.js";
import { getGitInfo } from "./services/git/utils.js";

const debuggerService = new DebuggerService();
const commitInterceptorService = new CommitInterceptorService(
  new TaskExecutionController(),
  debuggerService
);

// 디버거 설정 및 페이지 리로드
chrome.runtime.onMessage.addListener(
  (message: MessagePayload, sender, sendResponse) => {
    if (message.action === "START_INTERCEPTOR_COMMIT") {
      console.log("START_INTERCEPTOR_COMMIT");
      commitInterceptorService.initializeCommitInterceptor(sendResponse);
      return true;
    }
  }
);

// 네트워크 응답 처리
chrome.debugger.onEvent.addListener((source, method, params) => {
  if (method === "Network.responseReceived") {
    console.log("method", method);
    handleNetworkResponse(source, params);
  }
});

async function handleNetworkResponse(source, params) {
  if (!commitInterceptorService.isTaskExecutionActive()) return;

  // FIXME 의존성 분리 필요(이유는 모르겠으나 에러도 안찍힘)
  // const siteInfo = getGitInfo();
  // const { parser } = siteInfo;

  // TODO : 디버깅용 true 플래그값 제거
  if (true || params.response.url.includes("commits.json")) {
    try {
      const response = await debuggerService.getResponseBody(
        source.tabId,
        params.requestId
      );

      if (response?.body) {
        try {
          const jsonResponse = JSON.parse(response.body);
          const commits = GitlabCommitParser.parseCommits(jsonResponse);

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

          commitInterceptorService.detachDebugger(source.tabId);
          MessageDispatcher.sendSuccess("COPY_TO_CLIPBOARD", finalText);
        } catch (error) {
          console.error("Parsing error:", error);
          MessageDispatcher.sendError(
            "INTERCEPTOR_COMMIT_FAILED",
            "커밋 데이터 파싱 실패"
          );
        }
      }
    } catch (error) {
      console.error("Response body error:", error);
      MessageDispatcher.sendError(
        "INTERCEPTOR_COMMIT_FAILED",
        "응답 데이터 가져오기 실패"
      );
    }
  }
}
