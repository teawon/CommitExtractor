interface TaskExecutionConfig {
  timeoutDuration: number;
}

/**
 * 작업 실행을 제어하고 타임아웃을 관리하는 컨트롤러
 * 작업의 상태를 추적하고 지정된 시간 내에 작업이 완료되지 않으면 타임아웃을 처리
 */
export class TaskExecutionController {
  private isActive: boolean;
  private timeoutId: ReturnType<typeof setTimeout> | null;
  private readonly config: TaskExecutionConfig;

  constructor(config: Partial<TaskExecutionConfig> = {}) {
    this.isActive = false;
    this.timeoutId = null;
    this.config = {
      timeoutDuration: config.timeoutDuration || 5000,
    };
  }

  get isTaskExecution(): boolean {
    return this.isActive;
  }

  startTaskExecution(): void {
    this.isActive = true;
  }

  stopTaskExecution(): void {
    this.isActive = false;
    this.clearTimeout();
  }

  setTimeout(
    callback: () => void,
    delay: number = this.config.timeoutDuration
  ): void {
    this.clearTimeout();

    this.timeoutId = setTimeout(() => {
      if (this.isActive) {
        callback();
      }
    }, delay);
  }

  private clearTimeout(): void {
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}
