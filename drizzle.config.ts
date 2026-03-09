import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
        out: './drizzle',
        schema: './lib/drizzle.ts',
        dialect: 'postgresql',
        dbCredentials: {
                url: process.env.DATABASE_URL!,
        },
});
