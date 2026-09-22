import type { ParsedIntent } from "@careconnect/shared-types";

export interface InboundEmailInput {
  from: string;
  subject: string;
  body: string;
}

export type { ParsedIntent };
