# Contributing

Thank you for contributing to Lookout.

## Before you start

Read `README.md` and `SECURITY.md`. Do not include captured screen frames, Access cookies, Realtime tokens, or private deployment details in issues, commits, or pull requests.

## Development

```sh
bun install
bun run proof
bun run deploy:dry
```

Keep the repository small. Prefer a narrow change with a deterministic test. Do not add machine-control authority to Lookout. Lookout is a view-only capability.

## Pull requests

Explain:

- The user-visible behavior.
- The security boundary.
- The proof command you ran.
- Any Cloudflare resources or permissions required.
- Any known limitation.

A passing test is not proof of a live media path. Changes to publishing, viewing, Access, or Realtime behavior need a real authenticated browser check.
