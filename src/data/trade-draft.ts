import { create } from 'zustand'

export type OrderType = 'Market' | 'Limit' | 'Stop'

type TradeDraftState = {
  instrumentId: string | null
  orderType: OrderType
  lots: number

  setInstrumentId: (instrumentId: string) => void
  setOrderType: (orderType: OrderType) => void
  setLots: (updater: (previous: number) => number) => void
}

/**
 * The Trade tab's in-progress ticket.
 *
 * It lives outside the screen because the instrument picker is presented as a
 * sheet on the root stack — passing a callback through route params would
 * make the navigation state non-serialisable.
 */
export const useTradeDraft = create<TradeDraftState>((set) => ({
  instrumentId: null,
  orderType: 'Market',
  // Start at the safest broadly tradeable size. The instrument picker
  // replaces this with that market's LP minimum (for example 1 share for
  // stocks) once a symbol is chosen.
  lots: 0.01,

  setInstrumentId: (instrumentId) => set({ instrumentId }),
  setOrderType: (orderType) => set({ orderType }),
  setLots: (updater) => set((state) => ({ lots: Math.max(0.01, round(updater(state.lots))) })),
}))

/** Keeps lot sizes free of binary floating-point drift in the display. */
function round(value: number) {
  return Math.round(value * 100) / 100
}
