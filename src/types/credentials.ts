export type CliCredentials = {
  apiUrl: string;
  token: string;
  clientShare: string;
  wrapKey: string;
  email: string;
  deviceName: string;
  loggedInAt: string;
  expiresAt?: string | null;
};

export type StoredCliCredentials = Pick<CliCredentials, "apiUrl" | "token"> &
  Partial<Pick<CliCredentials, "clientShare" | "wrapKey" | "email" | "deviceName" | "loggedInAt" | "expiresAt">>;

export type ReadCredentialsResult = {
  credentials: StoredCliCredentials;
  credentialsPath: string;
  modifiedAt: string;
};
