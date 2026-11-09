import { describe, expect, it } from 'bun:test'
import worker from '../src/index'

describe('lookout health', () => {
  it('reports the service as healthy', async () => {
    const response = await worker.fetch(new Request('https://lookout.coey.dev/health'), {
      LOOKOUT_ROOM: {} as DurableObjectNamespace,
      LOOKOUT_REALTIME_APP_ID: 'test',
      LOOKOUT_REALTIME_TOKEN: 'test',
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ service: 'lookout', status: 'ok' })
  })
})
