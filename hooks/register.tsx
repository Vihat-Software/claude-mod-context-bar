import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Cat, Snapshot } from '../types'

const snapshot = atom({ plugin: 'context-bar', key: 'snapshot' } as const, null)
const isHidden = atom({ plugin: 'context-bar', key: 'isHidden' } as const, false)

// Below this many columns the footer has no spare room: draw nothing.
const MIN_COLUMNS = 70
const WIDE_COLUMNS = 110

// Split `width` cells across the categories by tokens (largest remainder),
// giving every non-empty category at least one cell.
export function allocate(cats: readonly Cat[], width: number): number[] {
  const total = cats.reduce((sum, c) => sum + c.tokens, 0)
  if (total <= 0) return cats.map(() => 0)

  const exact = cats.map(c => (c.tokens / total) * width)
  const cells = exact.map((x, i) => (cats[i]!.tokens > 0 ? Math.max(1, Math.floor(x)) : 0))
  let diff = width - cells.reduce((sum, n) => sum + n, 0)

  const byRemainder = exact
    .map((x, i) => ({ i, r: x - Math.floor(x) }))
    .sort((a, b) => b.r - a.r)
  for (let k = 0; diff > 0 && byRemainder.length > 0; k = (k + 1) % byRemainder.length, diff--) {
    cells[byRemainder[k]!.i]! += 1
  }
  while (diff < 0) {
    let big = 0
    cells.forEach((n, i) => {
      if (n > cells[big]!) big = i
    })
    if (cells[big]! <= 1) break
    cells[big]! -= 1
    diff++
  }
  return cells
}

async function refresh($: EngineInterface) {
  const usage = await $.session.usage({ breakdown: 'summary' })
  const b = usage.context.breakdown
  if (!b) return
  const snap: Snapshot = {
    cats: b.categories
      .filter(c => c.kind !== 'deferred')
      .map(c => ({ name: c.name, tokens: c.tokens, color: c.color, kind: c.kind })),
    window: b.rawMaxTokens,
    percent: Math.min(999, b.percentage),
  }
  await update($, snapshot, () => snap)
  $.ui.invalidate('ui.render')
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'context-bar',
      description: 'Show or hide the context bar in the prompt footer',
    })
    void refresh($).catch(() => {})

    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    void refresh($).catch(() => {})

    return next(e)
  })

  on('command.run', { command: 'context-bar' }, async $ => {
    const hidden = !(await read($, isHidden))
    await update($, isHidden, () => hidden)
    $.ui.invalidate('ui.render')

    return { text: hidden ? 'Context bar hidden.' : 'Context bar shown.' }
  })

  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    const snap = await read($, snapshot)
    const columns = e.viewport?.columns ?? 0
    if (snap === null || columns < MIN_COLUMNS || (await read($, isHidden))) {
      return next(e)
    }

    const { Box, Text } = $.ui.resolve(e)
    const width = columns >= WIDE_COLUMNS ? 24 : 12
    const cells = allocate(snap.cats, width)
    const modes = e.props.modes.join(' & ')

    return (
      <Box flexShrink={0}>
        {modes !== '' && <Text dimColor>{modes} </Text>}
        {snap.cats.map((c, i) =>
          cells[i]! > 0 ? (
            <Text key={c.name} color={c.kind === 'free' ? 'inactive' : c.color} dimColor={c.kind === 'free' || c.kind === 'buffer'}>
              {(c.kind === 'free' ? '░' : '█').repeat(cells[i]!)}
            </Text>
          ) : null,
        )}
        <Text dimColor> {Math.round(snap.percent)}%</Text>
      </Box>
    )
  })
}
