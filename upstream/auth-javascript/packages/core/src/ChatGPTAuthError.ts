import type { ChatGPTAuthErrorInfo } from './types.js';

/** SDK error whose JSON representation omits stacks and underlying exception causes. */
export class ChatGPTAuthError extends Error implements ChatGPTAuthErrorInfo {
  override readonly name = 'ChatGPTAuthError';
  readonly code: string;
  readonly retryable: boolean;
  readonly status?: number | undefined;
  readonly requestId?: string | undefined;
  readonly param?: string | undefined;

  constructor(info: ChatGPTAuthErrorInfo, options?: ErrorOptions) {
    super(info.message, options);
    this.code = info.code;
    this.retryable = info.retryable;
    this.status = info.status;
    this.requestId = info.requestId;
    this.param = info.param;
  }

  toJSON(): ChatGPTAuthErrorInfo {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      ...(this.status === undefined ? {} : { status: this.status }),
      ...(this.requestId === undefined ? {} : { requestId: this.requestId }),
      ...(this.param === undefined ? {} : { param: this.param }),
    };
  }
}
