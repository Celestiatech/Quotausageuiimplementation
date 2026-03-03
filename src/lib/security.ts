import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { getRequiredEnv } from "./env";

const ALGO = "aes-256-gcm";

function getKey() {
  const secret = getRequiredEnv("ENCRYPTION_KEY", { minLength: 32 });
  // Keep fixed-length derivation for backward compatibility with existing encrypted records.
  return Buffer.from(secret.padEnd(32, "0").slice(0, 32), "utf8");
}

export function encryptText(plainText: string) {
  const iv = randomBytes(12);
  const key = getKey();
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptText(payload: string) {
  const [ivHex, tagHex, dataHex] = payload.split(":");
  if (!ivHex || !tagHex || !dataHex) throw new Error("Encrypted payload is malformed");
  const key = getKey();
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
