import { getConfig, Connector } from '@wagmi/core'
import { createStore } from 'mipd'
import { MIPDConnector } from '../connector'

export function initializeEIP6963(){
  if(typeof window === 'undefined') return
  const store = createStore()
  const config = getConfig()

  store.subscribe((PDs)=>{
    if(PDs.length === 0) return
    const index = PDs.length - 1
    //@ts-ignore
    if(config.store.getState().connectors.some((c: Connector) => c.id === PDs[index].info.rdns)) return

    const newConnector = new MIPDConnector({
      options: {
        id: PDs[index].info.rdns,
        name: PDs[index].info.name,
        getProvider: () => PDs[index].provider,
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