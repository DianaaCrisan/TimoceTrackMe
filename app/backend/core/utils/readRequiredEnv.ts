/**
 * Read lazily, at the point of use, not at import time: a missing variable
 * should fail the one feature that needs it, not stop the whole app from
 * booting.
 */
export function readRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value.trim();
}

export function isEnvSet(name: string): boolean {
  const value = process.env[name];
  return Boolean(value && value.trim() !== "");
}
