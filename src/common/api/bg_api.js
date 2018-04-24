import { bgInit as popupBgInit } from '../ipc/ipc_bg_popup'
import { bgInit as csBgInit } from '../ipc/ipc_bg_cs'
import Ext from '../web_extension'
import { getTabIpcstore } from '../tab_ipc_store'
import { captureScreenInSelection } from '../capture_screenshot'
import * as httpAPI from './http_api'
import log from '../log'

const tabIpcStore = getTabIpcstore()

const init = () => {
  popupBgInit(ipc => ipc.onAsk(onApiRequest))
  csBgInit((tabId, ipc) => ipc.onAsk(onApiRequest))
}

const onApiRequest = (cmd, args) => {
  if (cmd !== 'API_CALL') return
  const { method, params = [] } = args

  log('API_CALL', method, params)

  if (typeof API[method] !== 'function') {
    throw new Error(`API method not found for '${method}'`)
  }

  try {
    return API[method](...params)
  } catch (e) {
    console.error(e.stack)
    throw e
  }
}

init()

const getCurrentTab = () => {
  return Ext.tabs.query({ active: true, lastFocusedWindow: true })
  .then(tabs => {
    const tab = tabs[0]
    if (!tab) throw new Error('no active tab found')
    return tab
  })
}

const getCurrentTabIpc = () => {
  return getCurrentTab()
  .then(tab => tabIpcStore.get(tab.id))
}

const API = {
  ...httpAPI,
  createTab: (data) => {
    return Ext.tabs.create(data)
  },
  askCurrentTab: (cmd, args) => {
    return getCurrentTabIpc()
    .then(ipc => ipc.ask(cmd, args))
  },
  startAnnotationOnCurrentTab: () => {
    return API.askCurrentTab('START_ANNOTATION', {})
  },
  captureScreenInSelection: ({ rect, devicePixelRatio }) => {
    return getCurrentTabIpc()
    .then(ipc => {
      return captureScreenInSelection({
        rect,
        devicePixelRatio
      }, {
        startCapture: () => {
          return ipc.ask('START_CAPTURE_SCREENSHOT', {})
        },
        endCapture: (pageInfo) => {
          return ipc.ask('END_CAPTURE_SCREENSHOT', { pageInfo })
        },
        scrollPage: (offset, { index, total }) => {
          return ipc.ask('SCROLL_PAGE', { offset })
        }
      })
    })
  }
}

export default API
