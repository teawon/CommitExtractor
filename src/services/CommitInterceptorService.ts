import { TaskExecutionController } from "./TaskExecutionController.js";
import { DebuggerService } from "./DebuggerService.js";
import { MessageDispatcher } from "./MessageDispatcher.js";

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

  private async getActiveTab() {
    const [tab] = await chrome.tabs.query({
      active: true,
      lastFocusedWindow: true,
    });

    if (!tab?.id) {
      throw new Error("활성 탭을 찾을 수 없습니다.");
    }

    return tab;
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
