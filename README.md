# Lookout

A private, view-only live window into your computers.

Lookout publishes one authorized screen to a Cloudflare-hosted viewer. The viewer runs behind your Cloudflare Access policy. The stream is view-only and uses Cloudflare Realtime WebRTC.

Lookout is designed to run standalone or embed into applications such as My AX.

## Boundary

Lookout shows what a machine is doing. It does not control the machine.

It does not provide keyboard, mouse, shell, file, clipboard, recording, or agent authority. Use `machinectl` for control. Use My AX to compose observation with other capabilities.

## Architecture

```text
local producer
  -> WebRTC publish
  -> Cloudflare Realtime
  -> Access-gated Worker session broker
  -> PWA or embedded client
```

The current reference producer is the authenticated browser itself. It uses `getDisplayMedia()` after an explicit click, publishes one track to Cloudflare Realtime, and registers the active track in a Durable Object. A second authenticated browser can discover and view that track without capturing its own screen.

A native macOS producer is a planned follow-on. Cloudflare cannot capture a computer without a local producer and explicit operating-system permission.

The Worker proxies the Realtime control API without exposing the Realtime token. The Durable Object stores the active publisher metadata. The media service carries the real-time stream.

## Install

Deploy the cloud service to your Cloudflare account:

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/acoyfellow/lookout)

Then open the deployed Access-protected viewer in one browser, authenticate, and click **Share this screen**. Grant the browser screen-capture permission. Open the same viewer in a second authenticated browser or on your phone. The second viewer should display the first browser's stream.

The current producer is browser-based. The deployment does not silently capture a desktop or install a native agent.

## Security contract

- Access protects the viewer and session API.
- Access protects the viewer and session API.
- The Realtime API token stays in a Worker secret.
- The browser receives no Realtime API token.
- The active publisher record is stored server-side.
- The browser producer requires an explicit capture action.
- Realtime credentials and secrets stay server-side.
- Track identifiers are not treated as authorization.
- Revoked sessions cannot reconnect.
- No public playback URL is created.
- The viewer reports `live`, `stale`, `offline`, `permission-required`, and `revoked` states.
- Screen frames are not persisted by default.

Transport encryption is not an end-to-end media privacy claim from Cloudflare. End-to-end media encryption is a separate future capability.

## Embedding

The reusable boundary is a framework-neutral client. The standalone PWA is a reference client.

```ts
const lookout = await createLookoutClient({
  sessionEndpoint: '/api/lookout/session',
  deviceId: 'jordans-mac',
})

lookout.on('state', (state) => {
  console.log(state)
})

await lookout.attach(videoElement)
```

The embedding application owns layout, navigation, device selection, and presentation. Lookout owns session negotiation, WebRTC subscription, lifecycle state, reconnect behavior, and revocation handling.

## My AX

My AX can consume Lookout as an observation capability:

```text
Lookout    observe the machine
machinectl  control the machine
Cloudbox    provision a remote computer
My AX       compose the operating environment
```

Lookout does not depend on My AX.

## Development

```sh
bun install
bun run typecheck
bun test
bun run proof
bun run deploy:dry
```

## Project shape

```text
README.md            setup, limits, and security contract
src/index.ts         Worker, Durable Object, viewer, and Realtime control proxy
test/                deterministic Worker checks
wrangler.toml        personal deployment configuration
proof/               live deployment checks, when added
```

The current repository is a small reference implementation. A framework-neutral client package and native macOS producer should be extracted only after their contracts have earned independent receipts.

## License

MIT
