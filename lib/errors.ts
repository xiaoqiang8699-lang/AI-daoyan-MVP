export class WorkflowError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 400, options?: ErrorOptions) {
    super(message, options);
    this.name = "WorkflowError";
  }
}

export function publicError(error: unknown) {
  if (error instanceof WorkflowError) return { code: error.code, error: error.message, status: error.status };
  return { code: "SYSTEM_ERROR", error: "系统暂时无法完成处理，请稍后重试。", status: 500 };
}
