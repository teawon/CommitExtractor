// 모니터링 상태 관리
export class MonitoringState {
  constructor() {
    this.isMonitoring = false;
    this.timeoutId = null;
  }

  startMonitoring() {
    this.isMonitoring = true;
  }

  stopMonitoring() {
    this.isMonitoring = false;
    this.clearTimeout();
  }

  setTimeout(callback, delay) {
    this.timeoutId = setTimeout(() => {
      if (this.isMonitoring) {
        callback();
      }
    }, delay);
  }

  clearTimeout() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}
