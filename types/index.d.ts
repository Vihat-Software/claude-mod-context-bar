export type Cat = { name: string; tokens: number; color: string; kind: string }
export type Snapshot = { model: string; cats: Cat[]; window: number; percent: number }

declare module 'claude-code' {
  interface PluginState {
    'context-bar': { snapshot: Snapshot | null; isHidden: boolean }
  }
}
