import { AppstoreOutlined, FileOutlined, FolderOpenOutlined, MenuOutlined } from '@ant-design/icons'
import { ccAPI } from '@buerli.io/classcad'
import { api as buerliApi, DrawingID } from '@buerli.io/core'
import { Menu, MenuItems, Readfile } from '@buerli.io/react-cad'
import { Space } from 'antd'
import 'antd/dist/antd.css'
import React from 'react'

const WideDiv: any = ({ children, ...props }: any) => {
  return (
    <div {...props} style={{ display: 'inline-block', width: '90%' }}>
      {children}
    </div>
  )
}

function useMenuItems(drawingId: DrawingID): MenuItems {
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
          <Readfile el={WideDiv} singleDrawingApp>
            open
          </Readfile>
        ),
        icon: <FolderOpenOutlined />,
        callback: () => null,
      },
    }
  }, [createNewDrawing])
}

export const FileMenu: React.FC<{ drawingId: DrawingID }> = ({ drawingId }) => {
  const items = useMenuItems(drawingId)

  return (
    <Space>
      <Menu items={items} trigger={['click']}>
        <MenuOutlined
          style={{
            width: '30px',
          }}
        />
      </Menu>
    </Space>
  )
}
