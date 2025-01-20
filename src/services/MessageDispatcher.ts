export type SuccessMessageType =
  | "COPY_TO_CLIPBOARD"
  | "START_INTERCEPTOR_COMMIT";

export type ErrorMessageType =
  | "INTERCEPTOR_COMMIT_FAILED"
  | "DATA_PARSING_FAILED";

export type MessageType = SuccessMessageType | ErrorMessageType;

interface MessageResponse {
  status: "success" | "error";
  error?: string;
}

interface SuccessPayload {
  type: "success";
  action: SuccessMessageType;
  data?: unknown;
}

interface ErrorPayload {
  type: "error";
  action: ErrorMessageType;
  error?: string;
}

export type MessagePayload = SuccessPayload | ErrorPayload;

/**
 * Chrome 확장 프로그램의 메시지 통신을 처리
 */
export class MessageDispatcher {
  static sendSuccess(action: SuccessMessageType, data?: unknown) {
    return this.dispatch({
      type: "success",
      action,
      data,
    });
  }

  static sendError(action: ErrorMessageType, error?: string) {
    return this.dispatch({
      type: "error",
      action,
      error,
    });
  }

  private static dispatch(payload: MessagePayload) {
    return chrome.runtime.sendMessage<MessagePayload, MessageResponse>(payload);
  }
}
