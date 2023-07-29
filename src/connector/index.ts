import type { Chain } from '@wagmi/chains'
import {
  type Address,
  ProviderRpcError,
  ResourceUnavailableRpcError,
  SwitchChainError,
  UserRejectedRequestError,
  createWalletClient,
  custom,
  getAddress,
  numberToHex,
} from 'viem'

import { Connector } from 'wagmi'
import {
  ChainNotConfiguredForConnectorError,
  ConnectorNotFoundError,
} from './errors'
import type { WalletClient, WindowProvider } from './types'
import { normalizeChainId } from './utils'

export type InjectedConnectorOptions = {
  /**Connectors rdns */
  id: string
  /** Name of connector */
  name: string
  /**
   * [EIP-1193](https://eips.ethereum.org/EIPS/eip-1193) Ethereum Provider to target
   *
   * @default
   * () => typeof window !== 'undefined' ? window.ethereum : undefined
   */
  getProvider: () => WindowProvider
  /**
   * MetaMask and other injected providers do not support programmatic disconnect.
   * This flag simulates the disconnect behavior by keeping track of connection status in storage. See [GitHub issue](https://github.com/MetaMask/metamask-extension/issues/10353) for more info.
   * @default true
   */
  shimDisconnect?: boolean
}

export class MIPDConnector extends Connector<
  WindowProvider | undefined,
  InjectedConnectorOptions
> {
  readonly id: string
  readonly name: string
  readonly ready: boolean

  #provider?: WindowProvider

  protected shimDisconnectKey = `${this.id}.shimDisconnect`

  // rome-ignore lint/correctness/noUnreachableSuper: <explanation>
  constructor({
    chains,
    options,
  }: {
    chains?: Chain[]
    options: InjectedConnectorOptions
  }) {

    super({ chains, options })

    const provider = options.getProvider()
    this.id = options.id
    this.name = options.name
    this.ready = !!provider
  }

  async connect({ chainId }: { chainId?: number } = {}) {
    try {
      const provider = await this.getProvider()
      if (!provider) throw new ConnectorNotFoundError()

      if (provider.on) {
        provider.on('accountsChanged', this.onAccountsChanged)
        provider.on('chainChanged', this.onChainChanged)
        provider.on('disconnect', this.onDisconnect)
      }

      this.emit('message', { type: 'connecting' })

      const accounts = await provider.request({
        method: 'eth_requestAccounts',
      })
      const account = getAddress(accounts[0] as string)
      // Switch to chain if provided
      let id = await this.getChainId()
      let unsupported = this.isChainUnsupported(id)
      if (chainId && id !== chainId) {
        const chain = await this.switchChain(chainId)
        id = chain.id
        unsupported = this.isChainUnsupported(id)
      }

      // Add shim to storage signalling wallet is connected
      if (this.options.shimDisconnect)
        this.storage?.setItem(this.shimDisconnectKey, true)

      return { account, chain: { id, unsupported } }
    } catch (error) {
      if (this.isUserRejectedRequestError(error))
        throw new UserRejectedRequestError(error as Error)
      if ((error as ProviderRpcError).code === -32002)
        throw new ResourceUnavailableRpcError(error as ProviderRpcError)
      throw error
    }
  }

  async disconnect() {
    const provider = await this.getProvider()
    if (!provider?.removeListener) return

    provider.removeListener('accountsChanged', this.onAccountsChanged)
    provider.removeListener('chainChanged', this.onChainChanged)
    provider.removeListener('disconnect', this.onDisconnect)

    // Remove shim signalling wallet is disconnected
    if (this.options.shimDisconnect)
      this.storage?.removeItem(this.shimDisconnectKey)
  }

  async getAccount() {
    const provider = await this.getProvider()
    if (!provider) throw new ConnectorNotFoundError()
    const accounts = await provider.request({
      method: 'eth_accounts',
    })
    // return checksum address
    return getAddress(accounts[0] as string)
  }

  async getChainId() {
    const provider = await this.getProvider()
    if (!provider) throw new ConnectorNotFoundError()
    return provider.request({ method: 'eth_chainId' }).then(normalizeChainId)
  }

  async getProvider() {
    const provider = this.options.getProvider()
    if (provider) this.#provider = provider
    return this.#provider
  }

  async getWalletClient({
    chainId,
  }: { chainId?: number } = {}): Promise<WalletClient> {
    const [provider, account] = await Promise.all([
      this.getProvider(),
      this.getAccount(),
    ])
    const chain = this.chains.find((x) => x.id === chainId)
    if (!provider) throw new Error('provider is required.')
    return createWalletClient({
      account,
      chain,
      transport: custom(provider),
    })
  }

  async isAuthorized() {
    try {
      if (
        this.options.shimDisconnect &&
        // If shim does not exist in storage, wallet is disconnected
        !this.storage?.getItem(this.shimDisconnectKey)
      )
        return false

      const provider = await this.getProvider()
      if (!provider) throw new ConnectorNotFoundError()
      const account = await this.getAccount()
      return !!account
    } catch {
      return false
    }
  }

  async switchChain(chainId: number) {
    const provider = await this.getProvider()
    if (!provider) throw new ConnectorNotFoundError()
    const id = numberToHex(chainId)

    try {
      await Promise.all([
        provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: id }],
        }),
        new Promise<void>((res) =>
          this.on('change', ({ chain }) => {
            if (chain?.id === chainId) res()
          }),
        ),
      ])
      return (
        this.chains.find((x) => x.id === chainId) ?? {
          id: chainId,
          name: `Chain ${id}`,
          network: `${id}`,
          nativeCurrency: { name: 'Ether', decimals: 18, symbol: 'ETH' },
          rpcUrls: { default: { http: [''] }, public: { http: [''] } },
        }
      )
    } catch (error) {
      const chain = this.chains.find((x) => x.id === chainId)
      if (!chain)
        throw new ChainNotConfiguredForConnectorError({
          chainId,
          connectorId: this.id,
        })

      // Indicates chain is not added to provider
      if (
        (error as ProviderRpcError).code === 4902 ||
        // Unwrapping for MetaMask Mobile
        // https://github.com/MetaMask/metamask-mobile/issues/2944#issuecomment-976988719
        (error as ProviderRpcError<{ originalError?: { code: number } }>)?.data
          ?.originalError?.code === 4902
      ) {
        try {
          await provider.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: id,
                chainName: chain.name,
                nativeCurrency: chain.nativeCurrency,
                rpcUrls: [chain.rpcUrls.public?.http[0] ?? ''],
                blockExplorerUrls: this.getBlockExplorerUrls(chain),
              },
            ],
          })

          const currentChainId = await this.getChainId()
          if (currentChainId !== chainId)
            throw new UserRejectedRequestError(
              new Error('User rejected switch after adding network.'),
            )

          return chain
        } catch (error) {
          throw new UserRejectedRequestError(error as Error)
        }
      }

      if (this.isUserRejectedRequestError(error))
        throw new UserRejectedRequestError(error as Error)
      throw new SwitchChainError(error as Error)
    }
  }

  async watchAsset({
    address,
    decimals = 18,
    image,
    symbol,
  }: {
    address: Address
    decimals?: number
    image?: string
    symbol: string
  }) {
    const provider = await this.getProvider()
    if (!provider) throw new ConnectorNotFoundError()
    return provider.request({
      method: 'wallet_watchAsset',
      params: {
        type: 'ERC20',
        options: {
          address,
          decimals,
          image,
          symbol,
        },
      },
    })
  }

  protected onAccountsChanged = (accounts: string[]) => {
    if (accounts.length === 0) this.emit('disconnect')
    else
      this.emit('change', {
        account: getAddress(accounts[0] as string),
      })
  }

  protected onChainChanged = (chainId: number | string) => {
    const id = normalizeChainId(chainId)
    const unsupported = this.isChainUnsupported(id)
    this.emit('change', { chain: { id, unsupported } })
  }

  protected onDisconnect = async (error: Error) => {
    // If MetaMask emits a `code: 1013` error, wait for reconnection before disconnecting
    // https://github.com/MetaMask/providers/pull/120
    if ((error as ProviderRpcError).code === 1013) {
      const provider = await this.getProvider()
      if (provider) {
        const isAuthorized = await this.getAccount()
        if (isAuthorized) return
      }
    }

    this.emit('disconnect')
    // Remove shim signalling wallet is disconnected
    if (this.options.shimDisconnect)
      this.storage?.removeItem(this.shimDisconnectKey)
  }

  protected isUserRejectedRequestError(error: unknown) {
    return (error as ProviderRpcError).code === 4001
  }
}