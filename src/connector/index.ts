import { InjectedConnector, InjectedConnectorOptions } from '@wagmi/core'

export class MIPDConnector extends InjectedConnector{
  readonly id: string
  readonly rdns: string

  constructor({
    options,
    uuid,
    rdns
  }: {
    options: InjectedConnectorOptions
    uuid: string
    rdns: string
  }) {
    super({ options })

    this.id = uuid
    this.rdns = rdns
  }
}