import * as Crypto from 'expo-crypto'
import { useEffect } from 'react'

import { useBackend, useBackendQuery } from '../../backend/provider'
import { useSession } from '../../data/store'

export function useMarketData(accountIdOverride?: string) {
  const selectedAccountId = useSession((state) => state.accountId)
  const accountId = accountIdOverride ?? selectedAccountId
  const replaceFavorites = useSession((state) => state.replaceFavorites)
  const backend = useBackend()
  const catalogue = useBackendQuery(`markets:${accountId ?? 'none'}`, (client) =>
    client.markets.catalogue(),
  )
  const favorites = useBackendQuery(`favorites:${accountId ?? 'none'}`, (client) =>
    client.markets.favorites(),
  )

  useEffect(() => {
    if (favorites.status === 'ready') replaceFavorites(favorites.data)
  }, [favorites, replaceFavorites])

  const setFavorite = async (instrumentId: string, favorite: boolean) => {
    await backend.markets.setFavorite({
      instrumentId,
      favorite,
      idempotencyKey: Crypto.randomUUID(),
    })
  }

  return { catalogue, setFavorite }
}
