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

  async initializeCommitInterceptor(
    sendResponse: (response: any) => void,
    tabId: number
  ) {
    try {
      await this.initializeDebugger(tabId);
      this.setupTimeoutHandler(tabId);
      await this.reloadTab(tabId);

      sendResponse({ status: "success" });
    } catch (error) {
      this.handleError(error);
    }
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
