export type ProposalGenerationErrorCode =
  | "INVALID_CONTEXT"
  | "INVALID_MODEL_OUTPUT"
  | "UNKNOWN_SOURCE_IDS"
  | "MODEL_REFUSED"
  | "MODEL_TRUNCATED";

export class ProposalGenerationError extends Error {
  readonly code: ProposalGenerationErrorCode;
  readonly details?: unknown;

  constructor(
    code: ProposalGenerationErrorCode,
    message: string,
    options: { details?: unknown; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "ProposalGenerationError";
    this.code = code;
    this.details = options.details;
  }
}
