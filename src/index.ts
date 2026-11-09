export interface Env {
  LOOKOUT_ROOM: DurableObjectNamespace
  LOOKOUT_REALTIME_APP_ID: string
  LOOKOUT_REALTIME_TOKEN: string
  LOOKOUT_LOCAL_DEV?: string
}

function hasAccessSession(request: Request, localDev = false): boolean {
  if (localDev || ['localhost', '127.0.0.1'].includes(new URL(request.url).hostname)) return true
  return request.headers.has('CF-Authorization') || request.headers.get('cookie')?.includes('CF_Authorization=') === true
}

async function realtimeRequest(
  env: Env,
  path: string,
  request: Request,
  method = request.method,
): Promise<Response> {
  const response = await fetch(
    `https://rtc.live.cloudflare.com/v1/apps/${env.LOOKOUT_REALTIME_APP_ID}${path}`,
    {
      method,
      headers: {
        Authorization: `Bearer ${env.LOOKOUT_REALTIME_TOKEN}`,
        'content-type': 'application/json',
      },
      body: method === 'GET' ? undefined : await request.text(),
    },
  )
  return new Response(response.body, {
    status: response.status,
    headers: { 'content-type': 'application/json' },
  })
}

export class LookoutRoom {
  constructor(private readonly state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    if (request.method === 'GET') {
      return Response.json((await this.state.storage.get('publisher')) ?? { status: 'not-connected' })
    }
    if (request.method === 'PUT') {
      const publisher = await request.json()
      await this.state.storage.put('publisher', publisher)
      return Response.json({ status: 'ok' })
    }
    if (request.method === 'DELETE') {
      await this.state.storage.delete('publisher')
      return Response.json({ status: 'ok' })
    }
    return new Response('Method not allowed', { status: 405 })
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/health') {
      return Response.json({ service: 'lookout', status: 'ok' })
    }

    if (url.pathname === '/api/publisher' && (request.method === 'GET' || request.method === 'PUT' || request.method === 'DELETE')) {
      if (!hasAccessSession(request, env.LOOKOUT_LOCAL_DEV === 'true')) return new Response('Unauthorized', { status: 401 })
      const id = env.LOOKOUT_ROOM.idFromName('primary')
      return env.LOOKOUT_ROOM.get(id).fetch(new Request('https://lookout.internal', {
        method: request.method,
        body: request.method === 'PUT' ? await request.text() : undefined,
        headers: { 'content-type': 'application/json' },
      }))
    }

    if (url.pathname === '/api/realtime/session' && request.method === 'POST') {
      if (!hasAccessSession(request, env.LOOKOUT_LOCAL_DEV === 'true')) return new Response('Unauthorized', { status: 401 })
      return realtimeRequest(env, '/sessions/new', request)
    }

    const trackMatch = url.pathname.match(/^\/api\/realtime\/sessions\/([^/]+)\/tracks$/)
    if (trackMatch && request.method === 'POST') {
      if (!hasAccessSession(request, env.LOOKOUT_LOCAL_DEV === 'true')) return new Response('Unauthorized', { status: 401 })
      return realtimeRequest(env, `/sessions/${trackMatch[1]}/tracks/new`, request)
    }

    const renegotiateMatch = url.pathname.match(/^\/api\/realtime\/sessions\/([^/]+)\/renegotiate$/)
    if (renegotiateMatch && request.method === 'PUT') {
      if (!hasAccessSession(request, env.LOOKOUT_LOCAL_DEV === 'true')) return new Response('Unauthorized', { status: 401 })
      return realtimeRequest(env, `/sessions/${renegotiateMatch[1]}/renegotiate`, request, 'PUT')
    }

    if (url.pathname === '/' && url.searchParams.has('manifest')) {
      return Response.json({
        name: 'Lookout',
        short_name: 'Lookout',
        description: 'Private, view-only machine monitoring.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#0b1118',
        theme_color: '#0b1118',
        icons: [
          { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      }, { headers: { 'cache-control': 'public, max-age=3600' } })
    }

    if (url.pathname === '/icon.svg') {
      return new Response(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#0b1118"/><path d="M128 160h256v192H128z" fill="#111a24" stroke="#f6821f" stroke-width="24"/><circle cx="256" cy="256" r="56" fill="#f6821f"/><circle cx="256" cy="256" r="24" fill="#0b1118"/></svg>`, { headers: { 'content-type': 'image/svg+xml', 'cache-control': 'public, max-age=86400' } })
    }

    if (url.pathname === '/sw.js') {
      return new Response(`const CACHE = 'lookout-shell-v1'
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.add('/'))))
self.addEventListener('fetch', event => event.respondWith(fetch(event.request).catch(() => caches.match(event.request).then(response => response || new Response('', { status: 503 })))))`, { headers: { 'content-type': 'application/javascript', 'cache-control': 'no-store' } })
    }

    if (url.pathname === '/manifest.webmanifest') {
      return Response.json({
        name: 'Lookout',
        short_name: 'Lookout',
        description: 'Private, view-only machine monitoring.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#0b1118',
        theme_color: '#0b1118',
        icons: [
          { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      }, { headers: { 'cache-control': 'public, max-age=3600' } })
    }

    if (url.pathname === '/') {
      return new Response(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#0b1118" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <link rel="manifest" href="/?manifest=1" crossorigin="use-credentials" />
    <link rel="icon" href="/icon.svg" />
    <title>Lookout</title>
    <style>
      :root { color-scheme: dark; font-family: Inter, system-ui, sans-serif; background: #070b12; color: #f7f9fb; }
      * { box-sizing: border-box; }
      :root { color-scheme: dark; font-family: Inter, system-ui, sans-serif; background: #0b1118; color: #f7f9fb; }
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 1.5rem; background: #0b1118; }
      main { width: min(960px, 100%); }
      .bootline { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin: 0 0 .75rem; color: #9baaba; font: .8rem/1 IBM Plex Mono, monospace; }
      .surface { overflow: hidden; padding: .5rem; background: #111a24; border: 1px solid rgba(174,196,216,.14); border-radius: .7rem; }
      video { display: block; width: 100%; aspect-ratio: 16 / 9; background: #0b1118; border-radius: .45rem; object-fit: contain; }
      .controls { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: .75rem .25rem .25rem; }
      button { padding: .7rem 1rem; border: 0; border-radius: .45rem; background: #f6821f; color: #0b1118; font-weight: 700; cursor: pointer; }
      button:disabled { cursor: wait; opacity: .6; }
      p { margin: 0; color: #9baaba; }
      #state { color: #f7f9fb; font: .8rem/1 IBM Plex Mono, monospace; }
      #detail { min-height: 1.2em; margin-top: .75rem; color: #ffb4a8; font: .75rem/1.4 IBM Plex Mono, monospace; overflow-wrap: anywhere; }
    </style>
  </head>
  <body>
    <main>
      <p class="bootline"><span>Remote display</span><span id="state" role="status" aria-live="polite">not-connected</span></p>
      <section class="surface" aria-label="Live screen viewer">
        <video controls autoplay playsinline></video>
        <div class="controls">
          <p>Remote display · no controls</p>
          <button id="start" type="button">Share this screen</button>
        </div>
        <p id="detail" role="alert"></p>
      </section>
      <script>
        const localDev = ${JSON.stringify(env.LOOKOUT_LOCAL_DEV === 'true')}
        if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js')
        const video = document.querySelector('video')
        const state = document.querySelector('#state')
        const start = document.querySelector('#start')
        const detail = document.querySelector('#detail')
        let hasStream = false
        let isPublisher = false
        let staleTimer
        const setState = (value) => { state.textContent = value; state.dataset.state = value; clearTimeout(staleTimer) }
        const showError = (error) => {
          const message = error instanceof Error ? error.message : String(error)
          detail.textContent = message
          state.title = message
        }
        const stage = (value) => { detail.textContent = value }
        const api = async (path, body, method = 'POST') => {
          const controller = new AbortController()
          const timeout = setTimeout(() => controller.abort(), 15000)
          try {
            const response = await fetch(path, {
              method,
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(body),
              signal: controller.signal,
            })
            if (!response.ok) throw new Error(path + ': ' + await response.text())
            return response.json()
          } catch (error) {
            if (error instanceof DOMException && error.name === 'AbortError') throw new Error(path + ': timed out after 15s')
            throw error
          } finally {
            clearTimeout(timeout)
          }
        }
        const attachRemote = (peer, tracks) => {
          peer.onconnectionstatechange = () => stage('peer: ' + peer.connectionState)
          peer.oniceconnectionstatechange = () => stage('ICE: ' + peer.iceConnectionState)
          const remote = new MediaStream()
          peer.ontrack = (event) => {
            remote.addTrack(event.track)
            video.srcObject = remote
            hasStream = true
            stage('remote track received; waiting for video frames')
            setState('connecting')
          }
          return tracks
        }
        video.addEventListener('playing', () => { hasStream = true; stage('video playing'); setState('live') })
        video.addEventListener('loadedmetadata', () => stage('video metadata: ' + video.videoWidth + 'x' + video.videoHeight))
        video.addEventListener('waiting', () => {
          if (!hasStream) return
          setState('stale')
          staleTimer = setTimeout(() => setState('offline'), 10000)
        })
        video.addEventListener('stalled', () => { if (hasStream) setState('stale') })
        video.addEventListener('error', () => setState(hasStream ? 'offline' : 'not-connected'))
        start.addEventListener('click', async () => {
          setState('connecting')
          try {
            stage('capture: waiting for screen or window selection')
            const local = localDev ? (() => {
              const canvas = document.createElement('canvas')
              canvas.width = 640
              canvas.height = 360
              const context = canvas.getContext('2d')
              let frame = 0
              setInterval(() => {
                frame += 1
                context.fillStyle = '#0b1118'
                context.fillRect(0, 0, canvas.width, canvas.height)
                context.fillStyle = '#f6821f'
                context.font = '28px monospace'
                context.fillText('Lookout local dev ' + frame, 24, 180)
              }, 250)
              return canvas.captureStream(10)
            })() : await Promise.race([
              navigator.mediaDevices.getDisplayMedia({ video: true, audio: false }),
              new Promise((_, reject) => setTimeout(() => reject(new Error('screen picker did not return after 30s; confirm the source and final Share button')), 30000)),
            ])
            stage('capture granted: ' + local.getVideoTracks()[0].label)
            const peer = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }] })
            const transceivers = local.getTracks().map((track) => peer.addTransceiver(track, { direction: 'sendonly' }))
            attachRemote(peer, [])
            await peer.setLocalDescription(await peer.createOffer())
            stage('signaling: creating publisher session')
            const session = await api('/api/realtime/session', { sessionDescription: { type: 'offer', sdp: peer.localDescription.sdp } })
            await peer.setRemoteDescription(session.sessionDescription)
            const published = transceivers.map((transceiver) => ({ location: 'local', mid: transceiver.mid, trackName: transceiver.sender.track.id }))
            await peer.setLocalDescription(await peer.createOffer())
            stage('signaling: registering publisher track')
            const localTracks = await api('/api/realtime/sessions/' + session.sessionId + '/tracks', { sessionDescription: { type: 'offer', sdp: peer.localDescription.sdp }, tracks: published })
            await peer.setRemoteDescription(localTracks.sessionDescription)
            stage('publisher: registering session')
            await api('/api/publisher', { sessionId: session.sessionId, tracks: published }, 'PUT')
            isPublisher = true
            video.srcObject = local
            hasStream = true
            setState('live')
          } catch (error) {
            setState('error')
            showError(error)
          }
        })
        const subscribe = async (publisher) => {
          const peer = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }] })
          attachRemote(peer, publisher.tracks)
          stage('signaling: creating viewer session')
          publisher.tracks.forEach(() => peer.addTransceiver('video', { direction: 'recvonly' }))
          await peer.setLocalDescription(await peer.createOffer())
          const session = await api('/api/realtime/session', { sessionDescription: { type: 'offer', sdp: peer.localDescription.sdp } })
          await peer.setRemoteDescription(session.sessionDescription)
          stage('signaling: requesting remote track')
          const tracks = publisher.tracks.map((track) => ({ location: 'remote', sessionId: publisher.sessionId, trackName: track.trackName }))
          const pulled = await api('/api/realtime/sessions/' + session.sessionId + '/tracks', { tracks })
          if (pulled.requiresImmediateRenegotiation) {
            await peer.setRemoteDescription(pulled.sessionDescription)
            await peer.setLocalDescription(await peer.createAnswer())
            await api('/api/realtime/sessions/' + session.sessionId + '/renegotiate', { sessionDescription: { type: 'answer', sdp: peer.localDescription.sdp } }, 'PUT')
          }
        }
        let subscribedSession
        const checkPublisher = async () => {
          if (isPublisher) return
          try {
            const publisher = await api('/api/publisher', undefined, 'GET')
            if (publisher.sessionId && publisher.tracks?.length && publisher.sessionId !== subscribedSession) {
              subscribedSession = publisher.sessionId
              setState('connecting')
              await subscribe(publisher)
            }
          } catch (error) {
            if (!hasStream) {
              setState('error')
              showError(error)
            }
          }
        }
        checkPublisher()
        setInterval(checkPublisher, 3000)
      </script>
    </main>
  </body>
</html>`, {
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'no-store',
        },
      })
    }

    return new Response('Not found', { status: 404 })
  },
}
