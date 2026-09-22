import type { ParsedIntent } from "@carrstack/shared-types";

export interface InboundEmailInput {
  from: string;
  subject: string;
  body: string;
}

export type { ParsedIntent };
