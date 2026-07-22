import type { Handle, SerializableValue } from 'remix/ui'
import { css } from 'remix/ui'

import { RadioRoom } from '../assets/radio-room.tsx'
import type { RoomSnapshot } from '../data/protocol.ts'
import { Document } from './document.tsx'

export function RadioPage(handle: Handle<{ snapshot: RoomSnapshot }>) {
  return () => (
    <Document title="Radio" head={<RadioHead />}>
      <main
        className="ds-css"
        mix={css({
          minHeight: '100vh',
          background:
            'radial-gradient(circle at 50% 18%, color-mix(in oklab, var(--color-ds-turquoise), transparent 70%), transparent 34rem), #d6d6d6',
          color: '#000',
          padding: '16px',
          boxSizing: 'border-box',
          display: 'grid',
          placeItems: 'center',
          '@media (max-width: 720px)': {
            alignItems: 'start',
            padding: '8px',
          },
        })}
      >
        <RadioRoom initialSnapshot={handle.props.snapshot as unknown as SerializableValue} />
      </main>
    </Document>
  )
}

function RadioHead() {
  return () => (
    <>
      <meta name="color-scheme" content="light" />
      <meta name="description" content="A cozy shared room radio." />
      <link rel="stylesheet" href="https://unpkg.com/@spiritov/ds.css" />
    </>
  )
}
