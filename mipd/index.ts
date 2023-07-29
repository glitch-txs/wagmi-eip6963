import { getConfig, Connector } from '@wagmi/core'
import { createStore } from 'mipd'
import { MIPDConnector } from '../connector'

export function initializeEIP6963(){
  if(typeof window === 'undefined') return
  const store = createStore()
  const config = getConfig()

  store.subscribe((PDs)=>{
    //@ts-ignore
    if(config.store.getState().connectors.some((c: Connector) => c.id === PDs[PDs.length - 1].info.rdns)) return

    const newConnector = new MIPDConnector({
      options: {
        id: PDs[PDs.length - 1].info.rdns,
        name: PDs[PDs.length - 1].info.name,
        getProvider: () => PDs[PDs.length - 1].provider,
      },
    })

    //@ts-ignore
    config.store?.setState((state)=>({connectors: [ newConnector, ...state.connectors]}))
    },
    {
      emitImmediately: true
    }
  )
  
}