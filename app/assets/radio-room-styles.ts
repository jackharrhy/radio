import { css } from 'remix/ui'

const ink = '#1f2a31'
const line = '#7b878c'
const paper = '#f8fbfb'
const wash = '#dce4e7'
const stripe = '#c7d0d4'
const accent = '#2aa7b8'
const accentSoft = '#c9f4f8'

const buttonBase = {
  height: '28px',
  border: `1px solid ${ink}`,
  borderRadius: '3px',
  background: `linear-gradient(#fff, #d9e1e4)`,
  color: ink,
  boxShadow: '0 1px #fff inset',
  font: 'inherit',
  cursor: 'pointer',
}

const rangeStyle = {
  appearance: 'none',
  height: '18px',
  background: 'transparent',
  '&::-webkit-slider-runnable-track': {
    height: '14px',
    border: `1px solid ${line}`,
    background: `repeating-linear-gradient(90deg, #fff, #fff 8px, ${wash} 8px, ${wash} 10px)`,
  },
  '&::-webkit-slider-thumb': {
    appearance: 'none',
    width: '14px',
    height: '18px',
    marginTop: '-4px',
    border: `1px solid ${ink}`,
    background: accent,
  },
  '&::-moz-range-track': {
    height: '14px',
    border: `1px solid ${line}`,
    background: `repeating-linear-gradient(90deg, #fff, #fff 8px, ${wash} 8px, ${wash} 10px)`,
  },
  '&::-moz-range-thumb': {
    width: '14px',
    height: '18px',
    border: `1px solid ${ink}`,
    borderRadius: 0,
    background: accent,
  },
}

export const windowStyle = css({
  color: ink,
  background: `repeating-linear-gradient(${wash}, ${wash} 2px, ${stripe} 2px, ${stripe} 4px)`,
  border: `1px solid ${ink}`,
  borderRadius: '6px',
  boxShadow: `0 0 0 1px #fff inset, 0 18px 50px rgba(15, 24, 28, 0.18)`,
  overflow: 'hidden',
  fontSize: '14px',
  lineHeight: '20px',
})

export const shellStyle = css({
  width: 'min(960px, 100%)',
  margin: '0 auto',
  display: 'grid',
  minHeight: 'min(760px, calc(100vh - 32px))',
  gridTemplateRows: '28px auto minmax(0, 1fr) auto',
  '@media (max-width: 720px)': { minHeight: 'calc(100vh - 16px)' },
})

export const titleBarStyle = css({
  minHeight: '28px',
  display: 'flex',
  alignItems: 'center',
  padding: '0 8px',
  color: '#fff',
  background: `linear-gradient(#6d777c, #4d575d)`,
  borderBottom: `1px solid ${ink}`,
  textShadow: '0 1px #000',
})

export const topBarStyle = css({ justifyContent: 'space-between' })
export const brandStyle = css({ display: 'flex', gap: '8px', alignItems: 'center', textTransform: 'lowercase', '& strong': { color: accentSoft } })
export const statusPillStyle = css({ display: 'flex', gap: '8px', fontSize: '13px', '& span': { borderLeft: '1px solid rgba(255,255,255,0.45)', paddingLeft: '8px' }, '@media (max-width: 560px)': { display: 'none' } })
export const panelStyle = css({ background: paper, border: `1px solid ${line}`, boxShadow: '0 0 0 1px #fff inset' })
export const nowPlayingStyle = css({ margin: '6px', display: 'grid', minHeight: '118px' })
export const messageCardStyle = css({ background: paper, border: `1px solid ${line}`, boxShadow: '0 0 0 1px #fff inset', padding: '10px' })
export const messageHeaderStyle = css({ display: 'inline-grid', alignItems: 'center', minWidth: '72px', minHeight: '23px', margin: '-1px 0 6px -1px', padding: '0 8px', background: accentSoft, border: `1px solid ${line}`, color: '#16333a' })
export const trackMetaStyle = css({ minWidth: 0, padding: '8px 10px' })
export const trackTitleStyle = css({ margin: '4px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'clip', fontWeight: 400 })
export const statusStyle = css({ margin: 0, color: '#465156', fontSize: '14px' })
export const primaryButtonStyle = css({ ...buttonBase, background: `linear-gradient(${accentSoft}, #9fdde6)`, '&:disabled': { opacity: 0.42, cursor: 'not-allowed' } })
export const iconButtonStyle = css({ ...buttonBase, width: '34px', overflow: 'hidden', textIndent: '48px', whiteSpace: 'nowrap', position: 'relative', '&::after': { position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textIndent: 0 }, '&[aria-label="Wake audio"]::after': { content: '"!"' }, '&[aria-label="Sync playback"]::after': { content: '"S"' }, '&:disabled': { opacity: 0.42, cursor: 'not-allowed' } })
export const playToggleStyle = css({ ...buttonBase, width: '34px', background: `linear-gradient(${accentSoft}, #9fdde6)`, overflow: 'hidden', textIndent: '48px', whiteSpace: 'nowrap', position: 'relative', '&::after': { content: '">"', position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textIndent: 0 }, '&[aria-label="Pause"]::after': { content: '"||"' }, '&:disabled': { opacity: 0.42, cursor: 'not-allowed' } })
export const dangerButtonStyle = css({ ...buttonBase, width: '28px', height: '24px', overflow: 'hidden', textIndent: '48px', whiteSpace: 'nowrap', position: 'relative', '&::after': { content: '"x"', position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textIndent: 0 } })
export const volumeStyle = css({ display: 'grid', gridTemplateColumns: '30px 92px 34px', gap: '6px', alignItems: 'center', justifySelf: 'end', fontSize: '14px', background: paper, borderLeft: `1px solid ${line}`, paddingLeft: '8px', '& input': { ...rangeStyle, width: '92px', minWidth: 0 }, '@media (max-width: 560px)': { justifySelf: 'stretch', gridTemplateColumns: '30px minmax(0, 1fr) 34px', '& input': { width: '100%' } } })
export const seekStyle = css({ display: 'grid', gridTemplateColumns: '48px minmax(0, 1fr) 48px', gap: '8px', alignItems: 'center', width: '100%', marginInline: 0, '& input': { ...rangeStyle, minWidth: 0 }, '& input:disabled': { opacity: 0.35 } })
export const contentStyle = css({ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 240px', gap: '6px', minHeight: 0, alignItems: 'stretch', padding: '0 6px 6px', '@media (max-width: 820px)': { gridTemplateColumns: '1fr', gridTemplateRows: 'minmax(0, 1fr) auto' } })
export const queuePanelStyle = css({ minHeight: 0, overflow: 'hidden', display: 'grid', gridTemplateRows: '38px auto minmax(0, 1fr)' })
export const sectionHeaderStyle = css({ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '38px', padding: '0 10px', borderBottom: `1px solid ${line}`, background: `linear-gradient(#f8fbfb, ${wash})`, '& h2': { margin: 0, fontSize: '14px', fontWeight: 400 }, '& span': { fontSize: '12px' } })
export const uploadStyle = css({ display: 'flex', justifyContent: 'flex-end', padding: '6px', background: '#edf3f4', borderBottom: `1px solid ${line}`, '& button': { width: '150px' }, '@media (max-width: 560px)': { '& button': { width: '100%' } } })
export const queueScrollStyle = css({ overflow: 'auto', minHeight: 0 })
export const listenersStyle = css({ display: 'grid', gridTemplateRows: '46px minmax(0, 1fr)', alignSelf: 'stretch', minHeight: 0, '@media (max-width: 820px)': { minHeight: '96px' } })
export const utilityTitleStyle = css({ margin: 0, display: 'grid', alignItems: 'center', padding: '0 10px', fontSize: '14px', fontWeight: 400, borderBottom: `1px solid ${line}`, background: `linear-gradient(#f8fbfb, ${wash})` })
export const listStyle = css({ listStyle: 'none', padding: 0, margin: 0, display: 'grid' })
export const queueListStyle = css({ listStyle: 'none', padding: 0, margin: 0, display: 'grid' })
export const queueItemStyle = css({ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 32px', gap: '4px', alignItems: 'center', minHeight: '34px', padding: '4px 6px', borderBottom: `1px solid ${wash}` })
export const activeQueueItemStyle = css({ background: accentSoft, boxShadow: `3px 0 0 ${accent} inset` })
export const trackButtonStyle = css({ border: 0, background: 'transparent', width: '100%', height: 'auto', color: 'inherit', font: 'inherit', cursor: 'pointer', display: 'grid', gridTemplateColumns: '36px minmax(0, 1fr)', gap: '6px', alignItems: 'center', minWidth: 0, textAlign: 'left', padding: '0' })
export const queueIndexStyle = css({ color: '#607077', fontVariantNumeric: 'tabular-nums' })
export const queueTrackStyle = css({ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' })
export const emptyStyle = css({ margin: '10px', padding: '12px', border: `1px solid ${line}`, background: paper })
export const personStyle = css({ display: 'flex', justifyContent: 'space-between', gap: '10px', padding: '5px 8px', borderBottom: `1px solid ${wash}`, background: '#fff', '& small': { color: '#465156' } })
export const fileInputStyle = css({ position: 'absolute', width: '1px', height: '1px', opacity: 0, pointerEvents: 'none' })
export const inputStyle = css({ width: '100%', minWidth: 0, height: '28px', border: `1px solid ${ink}`, borderRadius: '3px', background: paper, color: ink, padding: '0 8px', font: 'inherit' })
export const gateStyle = css({ width: 'min(520px, 100%)', margin: '0 auto', display: 'grid', gap: '6px', padding: '4px' })
export const gateTitleStyle = css({ margin: '6px 0 4px', fontSize: 'clamp(36px, 12vw, 58px)', lineHeight: 0.92 })
export const gateFormStyle = css({ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 160px', gap: '4px', '@media (max-width: 520px)': { gridTemplateColumns: '1fr', '& button': { width: '100%' } } })
export const controlBarStyle = css({ display: 'grid', gap: '6px', padding: '6px', background: '#edf3f4', borderTop: `1px solid ${line}`, gridTemplateColumns: 'minmax(0, 1fr) 188px', alignItems: 'center', '& > div': { gridColumn: '1 / -1' }, '@media (max-width: 560px)': { gridTemplateColumns: '1fr' } })
export const transportStyle = css({ display: 'grid', gridTemplateColumns: '34px 34px 34px minmax(0, 1fr)', gap: '5px', alignItems: 'center', '@media (max-width: 560px)': { gridTemplateColumns: '34px 34px 34px', '& div': { gridColumn: '1 / -1' } } })
export const transportReadoutStyle = css({ display: 'grid', gridTemplateColumns: '64px minmax(0, 1fr)', gap: '8px', minWidth: 0, '& strong': { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 400 } })
