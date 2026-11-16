# Contributing

Node.js 22+ is required. Install with `npm ci`, run `npm test` and `npm run release:check` before proposing changes. Browser selectors should be based on observed Doubao UI, not guessed labels.

Tests must not submit image generation or require account cookies. Document live browser checks separately, including the selected UI model and actual output dimensions. Avoid adding automatic retries for a request that may already have been submitted.

Keep changes focused. Include a reproducible failure, expected behavior, and test evidence in pull requests. Never include account sessions, reference images, signed image URLs, conversation IDs, or unredacted diagnostic screenshots.

Source contributions are provided under the repository's MIT license. No generated examples or third-party artwork are bundled by default.
