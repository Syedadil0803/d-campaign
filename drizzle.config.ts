import type { Config } from 'drizzle-kit';

try { process.loadEnvFile('.env.local'); } catch { /* no .env.local: use the real environment */ }

export default {
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.DATABASE_URL!,
  },
  schemaFilter: ['campaign'],
} satisfies Config;
