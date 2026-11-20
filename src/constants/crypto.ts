export const CRYPTO_KEY_BYTE_LENGTH = 32;
export const ACCOUNT_SEED_BYTE_LENGTH = 32;
export const ENVIRONMENT_SECRET_BYTE_LENGTH = 32;
export const KEY_DIGEST_BYTE_LENGTH = 32;
export const FINGERPRINT_BYTE_LENGTH = 20;
export const VERIFICATION_CODE_BYTE_LENGTH = 5;
export const ENVIRONMENT_KEY_ID_BYTE_LENGTH = 16;

export const ACCOUNT_KDF_CONTEXT = "egacct01";
export const ACCOUNT_SIGN_SUBKEY_ID = 1;
export const ACCOUNT_BOX_SUBKEY_ID = 2;

export const ENVIRONMENT_KDF_CONTEXT = "egenv001";
export const ENVIRONMENT_DATA_SUBKEY_ID = 1;
export const ENVIRONMENT_DIGEST_SUBKEY_ID = 2;

export const CRYPTO_DOMAIN = {
  fingerprint: "env-garden/fingerprint/v1",
  share: "env-garden/share/v1",
  variable: "env-garden/variable/v1",
  cliShare: "env-garden/cli-share/v1",
  verificationCode: "env-garden/verification-code/v1",
} as const;

export const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;
export const VERIFICATION_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const KEY_PINS_FILENAME = "key-pins.json";
export const DEFAULT_PROJECT_ENVIRONMENTS = ["DEVELOPMENT", "STAGING", "PRODUCTION"] as const;
