/**
 * Centralized configuration for Keyster
 */

export const CONFIG = {
  // API Rate Limiting
  RATE_LIMIT: {
    BASE_DELAY_MS: 3000,
    RATE_LIMIT_DELAY_MS: 10000,
    LOW_REMAINING_DELAY_MS: 6000,
    MAX_RETRY_ATTEMPTS: 3,
    BATCH_SIZE: 5,
    BATCH_DELAY_MS: 300,
  },

  // Scanning
  SCAN: {
    MAX_PAGES_PER_QUERY: 3,
    DEEP_SCAN_MAX_PAGES: 10,
    RESULTS_PER_PAGE: 30,
    SOURCEGRAPH_COUNT: 50,
    SOURCEGRAPH_DEEP_COUNT: 200,
  },

  // Storage
  STORAGE: {
    SCAN_RESULTS_KEY: 'keyster_scan_results',
    API_KEY_PREFIX: 'keyster_api_key_',
    GITHUB_TOKEN_KEY: 'keyster_github_token',
    GITLAB_TOKEN_KEY: 'keyster_gitlab_token',
    SCAN_SOURCES_KEY: 'keyster_scan_sources',
  },

  // Key Validation
  VALIDATION: {
    MIN_ENTROPY: 3.5,
    MIN_KEY_LENGTH: 20,
  },

  // Development
  DEV: {
    ENABLE_LOGGING: import.meta.env.DEV,
    ENABLE_VERBOSE_ERRORS: import.meta.env.DEV,
  },
} as const

export type Config = typeof CONFIG
