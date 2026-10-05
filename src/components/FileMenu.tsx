import { createApi, BuerliCadFacade } from '@buerli.io/classcad'
import { api as buerliApi, DrawingID, getDrawing } from '@buerli.io/core'
import { useDrawing } from '@buerli.io/react'
import { Icon, IconName, Menu, MenuItems, Readfile, sessionClient } from '@buerli.io/react-cad'
import { Tooltip, Dropdown, MenuProps } from 'antd'
import 'antd/dist/antd.css'
import React from 'react'
import { runsInPage } from '../engine'

type States = {
  current: number
  stack: string[]
  captionMap: Record<string, { stateName: string; caption: string; undoable?: boolean }>
}

type Command = {
  label: string
  icon?: IconName
  command: () => void
  sub?: Command[]
  stateId?: string
}

// a format a model is saved in, as a menu's row: what it is, and its file's ending
const format = (name: string, ending: string) => (
  <span className="rcad-menu-tool">
    <span>{name}</span>
    <code>.{ending}</code>
  </span>
)

type MenuItem = Required<MenuProps>['items'][number]

function useMenuItems(drawingId: DrawingID): MenuItems {
  const rfRef = React.useRef<HTMLInputElement>()
  // What the host of a shared session offers its guests; a session that says nothing offers all.
  const { saveFormats } = sessionClient.useSessionConfig()

  const createNewDrawing = React.useCallback(
    (type: 'Part' | 'Assembly') => {
      const run = async () => {
        try {
          // A guest is in somebody else's session, and a session has one model: New starts it
          // over there, for everyone in it. (A new drawing would be a new connection to the same
          // session, and the part would land next to what is in it.)
          if (sessionClient.getInviteFromUrl()) {
            const api = createApi(drawingId)
            await api.v1.common.clear()
            if (type === 'Assembly') await api.v1.assembly.create({ name: 'Assembly' })
            else await api.v1.part.create({ name: 'Part' })
            return
          }
          const oldDrawingId = drawingId
          const newDrawingId = await BuerliCadFacade.utils.connect(type)
          if (newDrawingId) {
            switch (type) {
              case 'Assembly':
                await createApi(newDrawingId).v1.assembly.create({ name: 'Assembly' })
                break
              case 'Part':
              default:
                await createApi(newDrawingId).v1.part.create({ name: 'Part' })
                break
            }
            buerliApi.getState().api.setActiveDrawing(newDrawingId)
          }
          if (oldDrawingId) {
            buerliApi.getState().api.removeDrawing(oldDrawingId)
          }
        } catch (error) {
          console.error(error)
        }
      }
      run()
    },
    [drawingId],
  )

  const save = React.useCallback(
    (type: 'ofb' | 'stp' | 'stl') => {
      const run = async () => {
        try {
          const drawing = getDrawing(drawingId)
          let name = drawing.name || 'drawing'
          const ptIndex = name.lastIndexOf('.')
          name = name.substring(0, ptIndex >= 0 ? ptIndex : name.length)

          const res = await createApi(drawingId).v1.common.save({
            format: type.toUpperCase() as 'OFB' | 'STP' | 'STL',
            encoding: 'base64',
          })

          const content = res?.result?.content
          if (content) {
            const data = atob(content)
            const link = document.createElement('a')
            link.href = window.URL.createObjectURL(new Blob([data], { type: 'application/octet-stream' }))
            link.download = `${name}.${type}`
            link.click()
          }
        } catch (error) {
          console.error(error)
        }
      }
      run()
    },
    [drawingId],
  )

  return React.useMemo(() => {
    const formats = {
      ofb: {
        caption: format('ClassCAD', 'ofb') as any,
        callback: () => save('ofb'),
      },
      stp: {
        caption: format('STEP', 'stp') as any,
        callback: () => save('stp'),
      },
      stl: {
        caption: format('STL', 'stl') as any,
        callback: () => save('stl'),
      },
    }
    const offered = Object.fromEntries(
      Object.entries(formats).filter(([type]) => !saveFormats || saveFormats.includes(type.toUpperCase())),
    )
    return {
      new: {
        caption: 'New',
        icon: <Icon name="plus" size={16} />,
        children: {
          part: {
            caption: 'Part',
            icon: <Icon name="part" size={16} />,
            callback: () => createNewDrawing('Part'),
          },
          assembly: {
            caption: 'Assembly',
            icon: <Icon name="assembly" size={16} />,
            callback: () => createNewDrawing('Assembly'),
          },
        },
      },
      open: {
        caption: (
          <>
            Open …
            <Readfile ref={rfRef} singleDrawingApp />
          </>
        ),
        icon: <Icon name="open" size={16} />,
        callback: () => rfRef.current && rfRef.current.click(),
      },
      save: {
        caption: 'Save as',
        icon: <Icon name="download" size={16} />,
        children: offered,
      },
    }
  }, [createNewDrawing, save, saveFormats])
}

const getCaption = (state: string, states?: States): string => {
  if (states?.captionMap) {
    const key = Object.keys(states.captionMap).find(c => states.captionMap[c].stateName === state)
    return key ? states.captionMap[key].caption : 'undefined caption'
  }
  return 'undefined caption'
}

const isUndoable = (stateName: string, states?: States): boolean => {
  if (states?.captionMap) {
    const key = Object.keys(states.captionMap).find(c => states.captionMap[c].stateName === stateName)
    const state = key ? states.captionMap[key] : undefined
    return state ? (state.undoable ? state.undoable : false) : false
  }
  return false
}

export const getFilteredUndoStack = (states: States): string[] => {
  // filter for undoable and states older than current
  return states.stack.filter(file => Number.parseInt(file) <= states.current && isUndoable(file, states))
}

export const undoNext = (drawingId: DrawingID, states: States, stack: string[]) => {
  const index = stack.indexOf(states.current.toString())
  if (index > -1) {
    const stateToLoad = stack.at(index - 1)
    stateToLoad && BuerliCadFacade.utils.undo(drawingId, stateToLoad)
  } else {
    BuerliCadFacade.utils.undo(drawingId)
  }
}

const undoCommand = (drawingId?: DrawingID, states?: States): Command => {
  let undoCommands: Command[] = []
  let filteredStack: string[]
  if (drawingId && states) {
    filteredStack = getFilteredUndoStack(states) // list of states which can be loaded
    const dropdownList = filteredStack.slice(1) // list of states visible in the dropdown menu, these ones can be undone, which means the sate before will be loaded
    undoCommands =
      dropdownList.length > 0
        ? dropdownList.map(state => ({
            label: getCaption(state, states),
            stateId: state,
            command: () => {
              // Get the state from filteredStack, which is previous to the selected one
              const index = filteredStack.indexOf(state)
              const stateToLoad = filteredStack.at(index === 0 ? 0 : index - 1)
              stateToLoad && BuerliCadFacade.utils.undo(drawingId, stateToLoad)
            },
          }))
        : []
  }
  return {
    label: 'Undo',
    sub: [...undoCommands],
    icon: 'undo',
    command: () => drawingId && states && undoNext(drawingId, states, filteredStack),
  }
}

export const getFilteredRedoStack = (states: States): string[] => {
  // filter for redoable and states newer than current
  return states.stack.filter(file => Number.parseInt(file) > states.current && isUndoable(file, states))
}

export const redoNext = (drawingId: DrawingID, stack: string[]) => {
  if (stack.length > 0) {
    drawingId && BuerliCadFacade.utils.redo(drawingId, stack[0])
  }
}

const redoCommand = (drawingId?: DrawingID, states?: States): Command => {
  let redoCommands: Command[] = []
  let filteredStack: string[]
  if (drawingId && states) {
    filteredStack = getFilteredRedoStack(states)
    redoCommands =
      filteredStack.length > 0
        ? filteredStack.map(state => ({
            label: getCaption(state, states),
            stateId: state,
            command: () => {
              // Get the state from filteredStack, which is the selected one
              const index = filteredStack.indexOf(state)
              const stateToLoad = filteredStack.at(index)
              stateToLoad && BuerliCadFacade.utils.redo(drawingId, stateToLoad)
            },
          }))
        : []
  }
  return {
    label: 'Redo',
    sub: [...redoCommands],
    icon: 'redo',
    command: () => drawingId && redoNext(drawingId, filteredStack),
  }
}

// Where the engine runs in the page (WebAssembly) there is no undo and no redo yet. The buttons
// stay in their place, switched off, and say so.
const notInPage = (what: string) => `${what} is not available in WebAssembly for the moment. Coming soon.`
// A guest who can only view does not undo or redo either.
const viewOnly = (what: string) => `${what} is not available in a view-only session.`

// Undo, or redo: the step itself, and behind the caret the steps it can go back (or forward) to.
// `off` says why it cannot be used at all, if it cannot.
const History: React.FC<{ command: Command; off?: string }> = ({ command, off }) => {
  const onClick = React.useCallback(
    (e: { key: string }) => {
      if (command.sub) {
        const cmdIdx = command.sub.findIndex(subCmd => subCmd.stateId === e.key)
        const cmd = command.sub[cmdIdx]
        cmd.command()
      }
    },
    [command],
  )

  const menuItems =
    command.sub?.map(
      subCmd =>
        ({
          label: subCmd.label,
          key: subCmd.stateId,
        }) as MenuItem,
    ) || []

  const menuProps = { items: menuItems, onClick }

  const disabled = Boolean(off) || !(command.sub && command.sub.length > 0)

  return (
    <span className="rcad-split">
      <Tooltip title={off ?? command.label} placement="bottom" mouseEnterDelay={0.35}>
        {/* (a span: a tooltip does not show over a button that is disabled) */}
        <span style={{ display: 'inline-flex' }}>
          <button
            type="button"
            className="rcad-tool"
            aria-label={command.label}
            disabled={disabled}
            onClick={command.command}>
            {command.icon && <Icon name={command.icon} size={18} />}
          </button>
        </span>
      </Tooltip>
      <Dropdown disabled={disabled} menu={menuProps} trigger={['click']} placement="bottomLeft">
        <button type="button" className="rcad-caret" aria-label={`${command.label}: steps`} disabled={disabled}>
          <Icon name="caret" size={12} />
        </button>
      </Dropdown>
    </span>
  )
}

/**
 * What leads the app's bar: the file menu (new, open, save), then undo and redo.
 */
export const FileMenu: React.FC<{ drawingId: DrawingID }> = ({ drawingId }) => {
  const items = useMenuItems(drawingId)
  const readOnly = sessionClient.useSessionRole() === 'view'
  const states = useDrawing(drawingId, d => d.cad.states)
  const undoCmd = React.useMemo(() => undoCommand(drawingId, states), [drawingId, states])
  const redoCmd = React.useMemo(() => redoCommand(drawingId, states), [drawingId, states])
  const inPage = runsInPage(drawingId)

  // View-only guests keep export (save) but not create/open; undo/redo are off.
  const menuItems = readOnly ? { save: items.save } : items
  // why undo and redo cannot be used at all, if they cannot
  const off = (what: string) => (readOnly ? viewOnly(what) : inPage ? notInPage(what) : undefined)

  return (
    <>
      <Menu items={menuItems} trigger={['click']} placement="bottomLeft">
        <button type="button" className="rcad-tool rcad-tool-text" aria-label="File">
          <Icon name="menu" size={18} />
          <span>File</span>
        </button>
      </Menu>
      <span className="rcad-tools-sep" />
      <History command={undoCmd} off={off('Undo')} />
      <History command={redoCmd} off={off('Redo')} />
    </>
  )
}
