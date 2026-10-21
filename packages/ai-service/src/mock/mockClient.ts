import type { AIClient, StructuredRequest } from "../client.ts";

export type MockResponder =
  | unknown
  | ((request: StructuredRequest<unknown>) => unknown | Promise<unknown>);

export interface MockAIClient extends AIClient {
  /** Every request received, in order. */
  readonly calls: StructuredRequest<unknown>[];
}

/**
 * A fake AIClient for tests and local development without an API key.
 * Pass a fixed value to return, or a function to compute (or throw) per call.
 */
export function createMockClient(responder: MockResponder): MockAIClient {
  const calls: StructuredRequest<unknown>[] = [];

  return {
    calls,
    async generateStructured<T>(request: StructuredRequest<T>) {
      const recorded = request as StructuredRequest<unknown>;
      calls.push(recorded);
      return typeof responder === "function" ? responder(recorded) : responder;
    },
  };
}
