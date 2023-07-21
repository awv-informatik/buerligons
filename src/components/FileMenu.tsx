import {
  AppstoreOutlined,
  FileOutlined,
  FolderOpenOutlined,
  MenuOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
  DownOutlined,
  SaveOutlined
} from '@ant-design/icons'
import { ccAPI } from '@buerli.io/classcad'
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
  captionMap: Record<string, { stateName: string; caption: string }>
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
          const newDrawingId = await ccAPI.base.createCCDrawing(type)
          if (newDrawingId) {
            switch (type) {
              case 'Assembly':
                await ccAPI.assemblyBuilder.createRootAssembly(newDrawingId, type)
                break
              case 'Part':
              default:
                await ccAPI.feature.newPart(newDrawingId, type)
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
          let data = null
          switch (type) {
            case 'ofb':
            case 'stp':
            case 'stl':
              data = await ccAPI.baseModeler.save(drawingId, type)
              break
            default:
              break
          }
          if (data) {
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
    [drawingId]
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

const undoCommand = (drawingId?: DrawingID, states?: States): Command => {
  const filteredStack: string[] = states?.stack ? states.stack.slice(1) : []
  const undoCommands =
    drawingId && states?.current && states.stack && states.captionMap
      ? filteredStack
          .filter(file => Number.parseInt(file) <= states.current)
          .map(state => ({
            label: getCaption(state, states),
            stateId: state,
            command: () => {
              // Get the state from stack, which is previous to the selected one
              const index = states.stack.indexOf(state)
              const stateToLoad = states.stack.at(index - 1)
              stateToLoad && ccAPI.base.undo(drawingId, stateToLoad)
            },
          }))
      : []

  return {
    label: 'Undo',
    sub: [...undoCommands],
    icon: <ArrowLeftOutlined />,
    command: () => drawingId && ccAPI.base.undo(drawingId),
  }
}

const redoCommand = (drawingId?: DrawingID, states?: States): Command => {
  const redoCommands =
    drawingId && states?.current && states.stack && states.captionMap
      ? states.stack
          .filter(file => Number.parseInt(file) > states.current)
          .map(state => ({
            label: getCaption(state, states),
            stateId: state,
            command: () => ccAPI.base.redo(drawingId, state),
          }))
      : []

  return {
    label: 'Redo',
    sub: [...redoCommands],
    icon: <ArrowRightOutlined />,
    command: () => drawingId && ccAPI.base.redo(drawingId),
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
        } as MenuItem),
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
