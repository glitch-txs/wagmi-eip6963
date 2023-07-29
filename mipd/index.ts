import { getConfig, Connector } from '@wagmi/core'
import { createStore } from 'mipd'
import { MIPDConnector } from '../connector'

export function initializeEIP6963(){
  if(typeof window === 'undefined') return
  const store = createStore()
  const config = getConfig()

  store.subscribe((providerDetails)=>{
    const newConnectors = providerDetails.map((pd)=>{
      return new MIPDConnector({
        options: {
          id: pd.info.rdns,
          name: pd.info.name,
          getProvider: () => pd.provider,
        },
      })
    })
    //@ts-ignore
    config.store?.setState((state)=>({ 
      connectors: [
        ...newConnectors.filter(newC => !state.connectors.some((c: Connector) => c.id === newC.id)),
        ...state.connectors
      ]
      }))
    }, {
      emitImmediately: true
  })
}