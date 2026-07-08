import { defineConfig } from 'vitest/config';
import dotenv from 'dotenv';

// Load the test-specific environment before any tests run
dotenv.config({ path: '.env.test' });

export default defineConfig({
  test: {
    // Run test files sequentially to avoid database race conditions
    sequence: {
      concurrent: false,
    },
    // Give each test file its own global setup/teardown lifecycle
    globals: true,
    // Increase timeout for integration tests that hit the database
    testTimeout: 15000,
    hookTimeout: 30000,
    // Show verbose output so each test name is visible
    reporter: 'verbose',
  },
});
