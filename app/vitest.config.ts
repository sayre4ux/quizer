import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Allow tests to import the standalone skill validator that lives at the repo
  // root (../quizbank-author) for the parity test.
  server: { fs: { allow: ['..'] } },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
