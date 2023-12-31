import { ReactNode } from "react";
import dynamic from 'next/dynamic'

const Client = ({children}:{children: ReactNode})=>children

export const Hydrate = dynamic(()=>Promise.resolve(Client), {
  ssr: false
})