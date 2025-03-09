import { CommitInterceptorService } from "./services/CommitInterceptorService";
import { TaskExecutionController } from "./services/TaskExecutionController";
import { DebuggerService } from "./services/DebuggerService";
import {
  MessageDispatcher,
  MessagePayload,
} from "./services/MessageDispatcher";
import { GitlabCommitParser } from "./services/git/parser/GitlabCommitParser";
import { CommitMessageFormatter } from "./services/git/parser/CommitMessageFormatter";
import { GIT_SERVICE_INFO } from "./services/git/types";

const debuggerService = new DebuggerService();
const commitInterceptorService = new CommitInterceptorService(
  new TaskExecutionController(),
  debuggerService
);

chrome.runtime.onMessage.addListener(
  (message: MessagePayload<{ targetTabId: number }>, sender, sendResponse) => {
    if (message.action === "START_INTERCEPTOR_COMMIT") {
      const targetTabId = message.data?.targetTabId;
      if (!targetTabId) {
        sendResponse({ status: "error", message: "탭 ID가 없습니다." });
        return true;
      }
      commitInterceptorService.initializeCommitInterceptor(
        sendResponse,
        targetTabId
      );
      return true;
    }
  }
);

// 네트워크 응답 처리
chrome.debugger.onEvent.addListener((source, method, params) => {
  if (method === "Network.responseReceived") {
    handleNetworkResponse(source, params);
  }
});

async function handleNetworkResponse(source, params) {
  if (!commitInterceptorService.isTaskExecutionActive()) return;

  // FIXME 의존성 분리 필요(이유는 모르겠으나 에러도 안찍힘)
  // const siteInfo = getGitInfo();
  // const { parser } = siteInfo;

  if (params.response.url.includes(GIT_SERVICE_INFO.gitlab.apiEndpoint)) {
    try {
      const response = await debuggerService.getResponseBody(
        source.tabId,
        params.requestId
      );

      if (response?.body) {
        try {
          const jsonResponse = JSON.parse(response.body);
          const commits = GitlabCommitParser.parseCommits(jsonResponse);
          const { messages } = await CommitMessageFormatter.format(commits);

          commitInterceptorService.detachDebugger(source.tabId);
          MessageDispatcher.sendSuccess("COPY_TO_CLIPBOARD", {
            messages,
          });
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
