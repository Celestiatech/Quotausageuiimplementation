type RequiredEnvOptions = {
  minLength?: number;
};

export function getRequiredEnv(name: string, options?: RequiredEnvOptions) {
  const value = String(process.env[name] || "").trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  if (options?.minLength && value.length < options.minLength) {
    throw new Error(
      `Environment variable ${name} must be at least ${options.minLength} characters`,
    );
  }
  return value;
}

