# Security and privacy

This MCP has local file-read access for reference uploads and local file-write access for generated images. Run it only in a trusted local MCP client. It connects only to loopback Chrome CDP endpoints. Chrome debugging ports control the browser session: do not expose them to the network.

Use a dedicated browser profile. Prompts and references are sent to Doubao when generation is requested. Account login, membership and CAPTCHA are handled by the user in the browser. This project does not distribute account sessions or bypass these checks.

Generation results and error diagnostics remain local under `outputs/` by default. They can contain private prompts, local file paths, conversation links and screenshots. They are excluded from release staging and npm packaging. Before sharing an issue, redact these fields and image URL query strings.

For sensitive reports, use the repository host's private security reporting feature if the maintainer has enabled it. Otherwise, open a minimal issue asking for a private contact without including credentials or exploit details. No reporting address is invented by this template.
