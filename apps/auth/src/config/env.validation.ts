export function validateEnvironment() {
  const required = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'DATABASE_URL'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n` +
      missing.map(key => `  - ${key}`).join('\n') +
      `\n\nSet them in your .env file.`,
    );
  }

  if (process.env.JWT_ACCESS_SECRET!.length < 32) {
    throw new Error('JWT_ACCESS_SECRET must be at least 32 characters long.');
  }

  if (process.env.JWT_REFRESH_SECRET!.length < 32) {
    throw new Error('JWT_REFRESH_SECRET must be at least 32 characters long.');
  }
}
