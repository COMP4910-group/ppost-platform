import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import { ProposalGenerationError } from "./errors.ts";

export interface StructuredRequest<T> {
  system: string;
  prompt: string;
  /** Output schema; the real client uses it to constrain the model's response. */
  schema: z.ZodType<T>;
}

/**
 * The injection point for model access. Implementations return the model's
 * parsed JSON as `unknown`; callers must validate it themselves.
 */
export interface AIClient {
  generateStructured<T>(request: StructuredRequest<T>): Promise<unknown>;
}

export const DEFAULT_MODEL = "claude-opus-5-5";

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export interface AnthropicClientOptions {
  /** Falls back to the SDK's credential resolution (e.g. ANTHROPIC_API_KEY). */
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  /** Reasoning depth. Defaults to "medium". */
  effort?: Effort;
  /** Pre-built SDK instance, mainly for advanced configuration. */
  sdk?: Anthropic;
}

export function createAnthropicClient(
  options: AnthropicClientOptions = {},
): AIClient {
  const sdk =
    options.sdk ??
    new Anthropic(options.apiKey ? { apiKey: options.apiKey } : {});
  const model = options.model ?? DEFAULT_MODEL;
  const maxTokens = options.maxTokens ?? 16000;
  const effort = options.effort ?? "medium";

  return {
    async generateStructured<T>(request: StructuredRequest<T>) {
      const response = await sdk.messages.parse({
        model,
        max_tokens: maxTokens,
        system: request.system,
        messages: [{ role: "user", content: request.prompt }],
        output_config: {
          effort,
          format: zodOutputFormat(request.schema),
        },
      });

      if (response.stop_reason === "refusal") {
        throw new ProposalGenerationError(
          "MODEL_REFUSED",
          "The model declined to generate proposals.",
          { details: response.stop_details },
        );
      }
      if (response.stop_reason === "max_tokens") {
        throw new ProposalGenerationError(
          "MODEL_TRUNCATED",
          "The model response was cut off before completion.",
        );
      }

      return response.parsed_output;
    },
  };
}
