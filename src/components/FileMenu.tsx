import React from 'react'
import 'antd/dist/antd.css'
import { Space } from 'antd'
import { MenuOutlined, FolderOpenOutlined, AppstoreOutlined, FileOutlined } from '@ant-design/icons'

import { ccAPI } from '@buerli.io/classcad'
import { DrawingID } from '@buerli.io/core'
import { Readfile, Menu, MenuItems } from '@buerli.io/react-cad'

const WideDiv: any = ({ children, ...props }: any) => {
  return (
    <div {...props} style={{ display: 'inline-block', width: '90%' }}>
      {children}
    </div>
  )
}

function useMenuItems(drawingId: DrawingID): MenuItems {
  return React.useMemo(() => {
    return {
      new: {
        caption: 'new',
        icon: <FileOutlined />,
        children: {
          part: {
            caption: 'part',
            icon: <FileOutlined />,
            callback: async () => {
              // TODO: ask name
              await ccAPI.common.clear(drawingId)
              await ccAPI.feature.newPart(drawingId, 'Part')
            },
          },
          assembly: {
            caption: 'assembly',
            icon: <AppstoreOutlined />,
            callback: async () => {
              // TODO: ask name
              await ccAPI.common.clear(drawingId)
              await ccAPI.assemblyBuilder.createRootAssembly(drawingId, 'Assembly').catch(console.info)
            },
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
  }, [drawingId])
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
