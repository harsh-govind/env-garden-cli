export type CliCredentials = {
  apiUrl: string;
  token: string;
  email: string;
  deviceName: string;
  loggedInAt: string;
};

export type StoredCliCredentials = Pick<CliCredentials, "apiUrl" | "token"> &
  Partial<Pick<CliCredentials, "email" | "deviceName" | "loggedInAt">>;

export type ReadCredentialsResult = {
  credentials: StoredCliCredentials;
  credentialsPath: string;
  modifiedAt: string;
};
