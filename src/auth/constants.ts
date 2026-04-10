// Note: ConfigModule handles environment variable loading
// This file is kept for backward compatibility
// Prefer using ConfigService in services instead
export const jwtConstants = {
  secret: process.env.JWT_SECRET || '',
  refreshSecret: process.env.JWT_REFRESH_SECRET || '',
};
