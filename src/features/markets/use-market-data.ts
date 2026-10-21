import * as Crypto from 'expo-crypto'
import { useEffect } from 'react'

import { useBackend, useBackendQuery } from '../../backend/provider'
import { useSession } from '../../data/store'

export function useMarketData(accountIdOverride?: string) {
  const selectedAccountId = useSession((state) => state.accountId)
  const accountId = accountIdOverride ?? selectedAccountId
  const replaceFavorites = useSession((state) => state.replaceFavorites)
  const setFavorite = useSetFavorite()
  const catalogue = useBackendQuery(`markets:${accountId ?? 'none'}`, (client) =>
    client.markets.catalogue(),
  )
  const favorites = useBackendQuery(`favorites:${accountId ?? 'none'}`, (client) =>
    client.markets.favorites(),
  )

  useEffect(() => {
    if (favorites.status === 'ready') replaceFavorites(favorites.data)
  }, [favorites, replaceFavorites])

  return { catalogue, setFavorite }
}

/** Favourite mutation without starting the much larger catalogue read. */
export function useSetFavorite() {
  const backend = useBackend()
  return async (instrumentId: string, favorite: boolean) => {
    await backend.markets.setFavorite({
      instrumentId,
      favorite,
      idempotencyKey: Crypto.randomUUID(),
    })
  }
}
