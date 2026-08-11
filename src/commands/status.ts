import { readCredentials } from "../lib/credentials.js";

function formatLoginTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(date);
}

export async function status(): Promise<void> {
  const storedCredentials = await readCredentials();

  if (!storedCredentials) {
    console.log("Status: Not logged in");
    console.log("Run eit login to connect your Env Garden account.");
    return;
  }

  const { credentials, credentialsPath, modifiedAt } = storedCredentials;

  console.log("Status: Logged in");
  console.log(`Email: ${credentials.email || "Unknown (log in again to refresh)"}`);
  console.log(`API URL: ${credentials.apiUrl}`);
  console.log(`Device: ${credentials.deviceName || "Unknown"}`);
  console.log(`Logged in at: ${formatLoginTime(credentials.loggedInAt || modifiedAt)}`);
  console.log(`Token: ${credentials.token.slice(0, 12)}…`);
  console.log(`Credentials: ${credentialsPath}`);
}
