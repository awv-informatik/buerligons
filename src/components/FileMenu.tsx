import {
  AppstoreOutlined,
  FileOutlined,
  FolderOpenOutlined,
  MenuOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
  DownOutlined,
  SaveOutlined,
} from '@ant-design/icons'
import { createApi, BuerliCadFacade } from '@buerli.io/classcad'
import { api as buerliApi, DrawingID, getDrawing } from '@buerli.io/core'
import { useDrawing } from '@buerli.io/react'
import { Menu, MenuItems, Readfile } from '@buerli.io/react-cad'
import { Button, Space, Tooltip, Typography, Dropdown, MenuProps } from 'antd'
import 'antd/dist/antd.css'
import React from 'react'

import './FileMenu.css'

type States = {
  current: number
  stack: string[]
  captionMap: Record<string, { stateName: string; caption: string; undoable?: boolean }>
}

type Command = {
  label: string
  icon?: any
  command: () => void
  sub?: Command[]
  stateId?: string
}

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
    (type: 'ofb' | 'stp' | 'stl' | 'usda') => {
      const run = async () => {
        try {
          const drawing = getDrawing(drawingId)
          let name = drawing.name || 'drawing'
          const ptIndex = name.lastIndexOf('.')
          name = name.substring(0, ptIndex >= 0 ? ptIndex : name.length)

          const res = await createApi(drawingId).v1.common.save({
            format: type.toUpperCase() as 'OFB' | 'STP' | 'STL' | 'USDA',
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
        caption: 'new',
        icon: <FileOutlined />,
        children: {
          part: {
            caption: 'part',
            icon: <FileOutlined />,
            callback: () => createNewDrawing('Part'),
          },
          assembly: {
            caption: 'assembly',
            icon: <AppstoreOutlined />,
            callback: () => createNewDrawing('Assembly'),
          },
        },
      },
      open: {
        caption: (
          <>
            open
            <Readfile ref={rfRef} singleDrawingApp />
          </>
        ),
        icon: <FolderOpenOutlined />,
        callback: () => rfRef.current && rfRef.current.click(),
      },
      save: {
        caption: 'save',
        icon: <SaveOutlined />,
        children: {
          ofb: {
            caption: 'ofb',
            callback: () => save('ofb'),
          },
          stp: {
            caption: 'stp',
            callback: () => save('stp'),
          },
          stl: {
            caption: 'stl',
            callback: () => save('stl'),
          },
          usda: {
            caption: 'usda',
            callback: () => save('usda'),
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
    icon: <ArrowLeftOutlined />,
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
    icon: <ArrowRightOutlined />,
    command: () => drawingId && redoNext(drawingId, filteredStack),
  }
}

const { Text } = Typography

const FButton: React.FC<{ command: Command; disabled: boolean }> = ({ command, disabled }) => {
  return (
    <Tooltip title={command.label}>
      <Button disabled={disabled} size="small" onClick={command.command} icon={command.icon} />
    </Tooltip>
  )
}

const SubGroup: React.FC<{ command: Command }> = ({ command }) => {
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
          label: <Text style={{ verticalAlign: 'middle' }}>{subCmd.label}</Text>,
          key: subCmd.stateId,
        }) as MenuItem,
    ) || []

  const menuProps = { items: menuItems, onClick }

  const disabled = command.sub && command.sub.length > 0 ? false : true

  return (
    <>
      <Button.Group style={{ top: '1px' }}>
        <FButton command={command} disabled={disabled} />
        <Dropdown overlayClassName="subgroup-dropdown" disabled={disabled} menu={menuProps}>
          <Button icon={<DownOutlined />} size="small" style={{ width: '14px' }} />
        </Dropdown>
      </Button.Group>
    </>
  )
}

export const FileMenu: React.FC<{ drawingId: DrawingID }> = ({ drawingId }) => {
  const items = useMenuItems(drawingId)
  const states = useDrawing(drawingId, d => d.cad.states)
  const undoCmd = React.useMemo(() => undoCommand(drawingId, states), [drawingId, states])
  const redoCmd = React.useMemo(() => redoCommand(drawingId, states), [drawingId, states])

  return (
    <Space>
      <Menu items={items} trigger={['click']}>
        <MenuOutlined
          style={{
            width: '30px',
          }}
        />
      </Menu>
      <SubGroup command={undoCmd} />
      <SubGroup command={redoCmd} />
    </Space>
  )
}
