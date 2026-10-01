import { createApi, BuerliCadFacade } from '@buerli.io/classcad'
import { api as buerliApi, DrawingID, getDrawing } from '@buerli.io/core'
import { useDrawing } from '@buerli.io/react'
import { Icon, IconName, Menu, MenuItems, Readfile } from '@buerli.io/react-cad'
import { Tooltip, Dropdown, MenuProps } from 'antd'
import 'antd/dist/antd.css'
import React from 'react'

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

  const createNewDrawing = React.useCallback(
    (type: 'Part' | 'Assembly') => {
      const run = async () => {
        try {
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
        children: {
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
        },
      },
    }
  }, [createNewDrawing, save])
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

// Undo, or redo: the step itself, and behind the caret the steps it can go back (or forward) to.
const History: React.FC<{ command: Command }> = ({ command }) => {
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

  const disabled = command.sub && command.sub.length > 0 ? false : true

  return (
    <span className="rcad-split">
      <Tooltip title={command.label} placement="bottom" mouseEnterDelay={0.35}>
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
  const states = useDrawing(drawingId, d => d.cad.states)
  const undoCmd = React.useMemo(() => undoCommand(drawingId, states), [drawingId, states])
  const redoCmd = React.useMemo(() => redoCommand(drawingId, states), [drawingId, states])

  return (
    <>
      <Menu items={items} trigger={['click']} placement="bottomLeft">
        <button type="button" className="rcad-tool rcad-tool-text" aria-label="File">
          <Icon name="menu" size={18} />
          <span>File</span>
        </button>
      </Menu>
      <span className="rcad-tools-sep" />
      <History command={undoCmd} />
      <History command={redoCmd} />
    </>
  )
}
