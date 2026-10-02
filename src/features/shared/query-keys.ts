/**
 * Query-key prefixes to re-read once a mutation is acknowledged, for
 * `useInvalidateQueries`. Kept beside each other so a new read keyed on
 * account data has one place to join.
 */

/** A trade changes the order lists and the account's margin and equity. */
export const AFTER_TRADE = ['positions:', 'history:', 'trade-history:', 'accounts:'] as const

/** Funding changes balances, available funds and the transaction list. */
export const AFTER_FUNDING = ['accounts:', 'funding:', 'funds-history:'] as const
