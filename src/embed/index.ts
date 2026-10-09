/**
 * Embedding surface of Buerligons for host applications (e.g. the ClassCAD PDM).
 *
 * The host calls `initBuerli(clientFactory)` once per page, renders `<Buerligons menu={null} />`
 * inside a sized container and drives documents through an `EditorController`:
 *
 *   const controller = new EditorController()
 *   await controller.open({ name: 'Bolt.ofb', format: 'OFB', data: arrayBuffer })
 *   const bytes = await controller.save('OFB')
 *   await controller.close()
 *
 * Buerligons does not decide which document is edited or where it is stored; it renders the
 * drawing and offers modelling commands. Styling of antd is imported here because the drawing UI
 * of `@buerli.io/react-cad` depends on it.
 */
import 'antd/dist/antd.css'

export { initBuerli } from '../initBuerli'
export { Buerligons } from '../components/Buerligons'
export type { BuerligonsProps } from '../components/Buerligons'
export { EditorController, loadFormatOf } from './EditorController'
export type {
  EditedPart,
  EditorDefinition,
  EditorLoadFormat,
  EditorSaveFormat,
  EditorSource,
  EditorState,
  EditorStatus,
  ExportDefinitionOptions,
  ExportedDefinition,
  ExportedFile,
  InsertSource,
  ProductUser,
} from './EditorController'
export { useAutosave, useCurrentPart, useEditedParts, useEditorDirty, useEditorStatus } from './hooks'
export { setLooks, setPbr, useLooks } from '../looks'
export type { Look } from '../looks'
