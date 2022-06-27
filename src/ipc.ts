import create from 'zustand'
import vanillaCreate, { GetState, SetState } from 'zustand/vanilla'

const anyWnd = window as any
const ipc = anyWnd.electron?.ipcRenderer
const CHANNEL = 'ipc-buerligons'

const CHECK_CLASSFILE = 'CHECK_CLASSFILE'
const LOAD_CLASSFILE = 'LOAD_CLASSFILE'

type StoreProps = {
  isEmbeddedApp: boolean
  hasClassFile?: boolean
  loadClassFile: () => void
}

const store = (set: SetState<StoreProps>, get: GetState<StoreProps>): StoreProps => ({
  isEmbeddedApp: false,
  loadClassFile: () => ipc?.send(CHANNEL, { command: LOAD_CLASSFILE }),
})
const ipcAPI = vanillaCreate<StoreProps>(store)
const useIPC = create<StoreProps>(ipcAPI)

ipcAPI.setState(s => ({ ...s, isEmbeddedApp: Boolean(ipc) }))

ipc?.on(CHANNEL, (arg: any) => {
  const res = JSON.parse(arg)
  const { command } = res
  switch (command) {
    case CHECK_CLASSFILE:
      ipcAPI.setState(s => ({ ...s, hasClassFile: res.exists }))
      break

    case LOAD_CLASSFILE:
      ipcAPI.setState(s => ({ ...s, hasClassFile: res.exists }))
      break

    default:
      break
  }
})

ipc?.send(CHANNEL, { command: CHECK_CLASSFILE })

export { useIPC }
