import type { CliFetch } from "./api.js";

export type LogoutOptions = {
  localOnly?: boolean;
  fetchImplementation?: CliFetch;
};
