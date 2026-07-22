import { createController } from 'remix/router'

import { assetServer } from '../assets.ts'
import { radioSpace } from '../data/radio-space.ts'
import { saveUploadedTrack } from '../data/audio-store.ts'
import { routes } from '../routes.ts'
import { RadioPage } from '../ui/radio-page.tsx'

export default createController(routes, {
  actions: {
    async assets(context) {
      return (
        (await assetServer.fetch(context.request)) ?? new Response('Not Found', { status: 404 })
      )
    },
    async home(context) {
      await radioSpace.load()
      return context.render(<RadioPage snapshot={radioSpace.snapshot()} />)
    },
    async tracks(context) {
      try {
        let formData = await context.request.formData()
        let file = formData.get('track')
        if (!(file instanceof File)) {
          return json({ error: 'Missing track file' }, 400)
        }

        let track = await saveUploadedTrack(file)
        return json({ track })
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : 'Upload failed' }, 400)
      }
    },
  },
})

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}
