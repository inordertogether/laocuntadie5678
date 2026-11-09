# Security

Report security issues privately to the repository owner. Do not open a public issue for a credential, access-control, or screen-content vulnerability.

Lookout is view-only. It must not receive keyboard, mouse, shell, file, or clipboard authority.

Never commit:

- Realtime API tokens.
- Access credentials.
- Device credentials.
- `.env` or `.dev.vars` files.
- Captured screen frames.
- Production logs containing screen or identity data.

Rotate a Realtime token immediately if it appears in a terminal, browser output, log, or repository artifact.
