import { test, expect } from 'claude-code/testing'

import { allocate } from './register'

const cat = (tokens: number) => ({ name: `c${tokens}`, tokens, color: 'x', kind: 'used' })

test('allocate fills exactly the width and keeps tiny categories visible', () => {
  const cells = allocate([cat(1), cat(5000), cat(3000), cat(0)], 20)
  expect(cells.reduce((a, b) => a + b, 0)).toBe(20)
  expect(cells[0]).toBeGreaterThanOrEqual(1)
  expect(cells[3]).toBe(0)
})

test('allocate draws nothing when empty', () => {
  expect(allocate([], 10)).toEqual([])
})
