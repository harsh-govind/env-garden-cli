export type CliFetch = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>;

export type CliUser = {
  id: string;
  email: string;
  name?: string | null;
};

export type VerifyTokenInput = {
  apiUrl: string;
  token: string;
  fetchImplementation?: CliFetch;
};

export type RevokeTokenInput = VerifyTokenInput;
