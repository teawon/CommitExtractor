interface MonitoringConfig {
  timeoutDuration: number;
}

export class MonitoringController {
  private isActive: boolean;
  private timeoutId: ReturnType<typeof setTimeout> | null;
  private readonly config: MonitoringConfig;

  constructor(config: Partial<MonitoringConfig> = {}) {
    this.isActive = false;
    this.timeoutId = null;
    this.config = {
      timeoutDuration: config.timeoutDuration || 5000,
    };
  }

  get isMonitoring(): boolean {
    return this.isActive;
  }

  startMonitoring(): void {
    this.isActive = true;
  }

  stopMonitoring(): void {
    this.isActive = false;
    this.clearTimeout();
  }

  setTimeout(
    callback: () => void,
    delay: number = this.config.timeoutDuration
  ): void {
    this.clearTimeout(); // 기존 타이머가 있다면 제거

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
