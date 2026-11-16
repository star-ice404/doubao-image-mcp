# Changelog

## 1.1.0

- Corrected the Pro model identifier to `seedream5.0Pro`, matching the webpage's Seedream 5.0 Pro label. Pro requests continue to require `allow_pro: true`.
- Prepared the first public-source release with MIT license and third-party notices.
- Replaced machine-specific paths and private example references with editable templates.
- Added source release allowlisting, privacy-pattern checks, file checksums and CI configuration.
- Added cross-platform state-path resolution tests. Live validation remains Windows-only to date.
- Kept npm publication disabled by default (`private: true`); source sharing does not require npm publication.

## 1.0.0

- Local browser automation MCP prototype: text-to-image, image references, model selection, aspect-ratio text instructions, result downloads and diagnostics.
