import { getConfig, WindowProvider, connect } from '@wagmi/core'
import { createStore } from 'mipd'
import { MIPDConnector } from '../connector'

let uuids: string[] = []
const WALLET_KEY = 'wagmi.wallet'
const CONNECTED_KEY = 'wagmi.connected'

export function initializeEIP6963(){
  if(typeof window === 'undefined') return
  const store = createStore()
  const config = getConfig()

  store.subscribe((providerDetails)=>{

    if(!providerDetails.length) return
  
    const newPDs = providerDetails.filter(pd => !uuids.some(u=> u === pd.info.uuid))

    newPDs.forEach( PD =>{
      const newConnector = new MIPDConnector({
        options: {
          name: PD.info.name,
          getProvider: () => PD.provider as WindowProvider,
          shimDisconnect: true
        },
        uuid: PD.info.rdns,
        rdns: PD.info.rdns
      })
      
      uuids.push(PD.info.rdns)
      //@ts-ignore
      config.store?.setState((state)=>({connectors: [ newConnector, ...state.connectors]}))

      // if(localStorage.getItem(CONNECTED_KEY) === 'true'){
      //   if(localStorage.getItem(WALLET_KEY)?.replace(/"/g, '') === PD.info.rdns){
      //     //@ts-ignore
      //     const [connector] = config.store.getState().connectors.filter(c => c.id === PD.info.rdns)

      //     connect({connector})
      //   }
      // }
    })
    },
    {
      emitImmediately: true
    }
  )
}