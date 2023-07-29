import { useAccount, useConnect } from 'wagmi'
 
export default function Connect() {
  const { connector: activeConnector, isConnected } = useAccount()
  const { connect, connectors, error, isLoading, pendingConnector } =
    useConnect()
 
  return (
    <>
      {isConnected && <div>Connected to {activeConnector?.name}</div>}
 
      {connectors.map((connector) => (
        <button
          disabled={!connector.ready}
          key={connector.id}
          onClick={() => connect({ connector })}
        >
          {connector.name}
          {isLoading &&
            pendingConnector?.id === connector.id &&
            ' (connecting)'}
        </button>
      ))}
 
      {error && <div>{error.message}</div>}
    </>
  )
}