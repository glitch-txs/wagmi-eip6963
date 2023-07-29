import {
  Account,
  Chain,
  EIP1193Provider,
  Transport,
  WalletClient as WalletClient_,
} from 'viem'

import { ConnectorData } from 'wagmi'

export interface WindowProvider extends EIP1193Provider {
  providers?: WindowProvider[]
}

export type WalletClient<
  TTransport extends Transport = Transport,
  TChain extends Chain = Chain,
  TAccount extends Account = Account,
> = WalletClient_<TTransport, TChain, TAccount>

export type Storage = {
  getItem<T>(key: string, defaultState?: T | null): T | null
  setItem<T>(key: string, value: T | null): void
  removeItem(key: string): void
}

export type StorageStoreData = {
  state: { data?: ConnectorData }
}