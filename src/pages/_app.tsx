import '@/styles/globals.css'
import type { AppProps } from 'next/app'
import { createConfig, configureChains } from 'wagmi'
import { mainnet } from 'viem/chains'
import { publicProvider } from 'wagmi/providers/public'
import { InjectedConnector } from 'wagmi/connectors/injected'
import { WalletConnectConnector } from 'wagmi/connectors/walletConnect'
import { WagmiConfig } from 'wagmi'
import { initializeEIP6963 } from '../mipd'

const { chains, publicClient } = configureChains([mainnet], [publicProvider()])
 
const config = createConfig({
  autoConnect:true,
  connectors: [
    new InjectedConnector({ chains, options:{ name:'Browser Wallet' }}),
    new WalletConnectConnector({
      chains,
      options: {
        projectId: process.env.NEXT_PUBLIC_PROJECT_ID as string,
        metadata: {
          name: 'wagmi',
          description: 'my wagmi app',
          url: 'https://wagmi.sh',
          icons: ['https://wagmi.sh/icon.png'],
        },
      },
    })
    
  ],
  publicClient,
})

initializeEIP6963()

export default function App({ Component, pageProps }: AppProps) {
  return (
    <WagmiConfig config={config} >
      <Component {...pageProps} />
    </WagmiConfig>
    )
}