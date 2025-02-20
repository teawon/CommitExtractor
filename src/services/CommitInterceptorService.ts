import { TaskExecutionController } from "./TaskExecutionController";
import { DebuggerService } from "./DebuggerService";
import { MessageDispatcher } from "./MessageDispatcher";

export class CommitInterceptorService {
  constructor(
    private taskExecutionController: TaskExecutionController,
    private debuggerService: DebuggerService
  ) {}

  public isTaskExecutionActive(): boolean {
    return this.taskExecutionController.isTaskExecution;
  }

  async initializeCommitInterceptor(sendResponse: (response: any) => void) {
    try {
      const tab = await this.getActiveTab();
      await this.initializeDebugger(tab.id);
      this.setupTimeoutHandler(tab.id);
      await this.reloadTab(tab.id);

      sendResponse({ status: "success" });
    } catch (error) {
      this.handleError(error);
    }
  }

  private async getActiveTab(): Promise<chrome.tabs.Tab> {
    return new Promise((resolve, reject) => {
      chrome.windows.getCurrent(async (window) => {
        try {
          const [tab] = await chrome.tabs.query({
            active: true,
            windowId: window.id,
          });

          if (!tab?.id) {
            throw new Error("활성 탭을 찾을 수 없습니다.");
          }

          resolve(tab);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  private async initializeDebugger(tabId: number) {
    this.taskExecutionController.startTaskExecution();
    await this.debuggerService.attach(tabId);
  }

  private setupTimeoutHandler(tabId: number) {
    this.taskExecutionController.setTimeout(() => {
      this.detachDebugger(tabId);
      MessageDispatcher.sendError("INTERCEPTOR_COMMIT_FAILED");
    }, 5000);
  }

  public async detachDebugger(tabId: number) {
    this.taskExecutionController.stopTaskExecution();
    await this.debuggerService.detach(tabId);
  }

  private async reloadTab(tabId: number) {
    await chrome.tabs.reload(tabId);
  }

  private handleError(error: unknown) {
    console.error("Commit crawling failed:", error);
    MessageDispatcher.sendError("INTERCEPTOR_COMMIT_FAILED");
  }
}
