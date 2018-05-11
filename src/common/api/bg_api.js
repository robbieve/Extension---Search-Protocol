import { bgInit as popupBgInit } from '../ipc/ipc_bg_popup'
import { bgInit as csBgInit } from '../ipc/ipc_bg_cs'
import Ext from '../web_extension'
import storage from '../storage'
import { getTabIpcstore } from '../tab_ipc_store'
import { captureScreenInSelection } from '../capture_screenshot'
import { getLinkPair } from '../models/local_annotation_model'
import { hackOnce } from '../hack_header'
import * as httpAPI from './http_api'
import * as mockHttpAPI from './mock_http_api'
import { objMap } from '../utils'
import log from '../log'

const tabIpcStore = getTabIpcstore()

const init = () => {
  popupBgInit(ipc => ipc.onAsk(onApiRequest))
  csBgInit((tabId, ipc) => ipc.onAsk(onApiRequest))
}

const onApiRequest = (cmd, args) => {
  if (cmd !== 'API_CALL') return
  const { method, params = [] } = args

  if (method !== 'getLinkPairStatus') {
    log('API_CALL', method, params)
  }

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

const getCurrentPageInfo = () => {
  return getCurrentTab()
  .then(tab => ({
    url:    tab.url,
    title:  tab.title
  }))
}

const getCurrentTabIpc = () => {
  return getCurrentTab()
  .then(tab => tabIpcStore.get(tab.id))
}

const wrapLogError = (fn) => {
  return (...args) => {
    return new Promise((resolve, reject) => {
      Promise.resolve(fn(...args)).then(resolve, reject)
    })
    .catch(e => {
      log.error(e.stack)
      throw e
    })
  }
}

const API = {
  ...httpAPI,
  ...mockHttpAPI,
  loadLinksForCurrentPage: () => {
    return getCurrentPageInfo()
    .then(info => {
      const isUrlValid = /^(https?|file)/.test(info.url)

      if (!isUrlValid) throw new Error('current page not supported')
      return API.annotationsAndBridgesByUrl(info.url)
    })
  },
  getCurrentPageInfo,
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
  },
  getLinkPairStatus: () => {
    const lp = getLinkPair()
    return Promise.resolve({
      status: lp.getStatus(),
      data:   lp.get()
    })
  },
  setLinkPair: (data) => {
    getLinkPair().set(data)
    return Promise.resolve(true)
  },
  addLink: (link) => {
    getLinkPair().addLink(link)
    return Promise.resolve(true)
  },
  createLink: (link) => {
    return API.addLink(link)
  },
  buildLink: (link) => {
    const linkPairData = getLinkPair().get()
    const ps = []

    // Note: Here is the logic of build bridge with last annotation
    // we need to add element of last annotation to local annotation model.
    if (linkPairData.links.length === 0 && linkPairData.lastAnnotation) {
      ps.push(
        API.addLink(linkPairData.lastAnnotation.target)
      )
    }

    ps.push(
      API.addLink(link)
    )

    return Promise.all(ps).then(() => true)
  },
  clearLinks: () => {
    getLinkPair().clear()
    return Promise.resolve(true)
  },
  recordLastAnnotation: (data) => {
    getLinkPair().setLastAnnotation(data)
    return Promise.resolve(true)
  },
  hackHeader: ({ url, headers }) => {
    hackOnce({ url, add: headers })
    return true
  },
  resetUserSettings: () => {
    const initial = {
      showOnLoad:           true,
      nearDistanceInInch:   1,
      nearVisibleDuration:  2
    }

    return storage.set('user_settings', initial)
    .then(() => initial)
  },
  getUserSettings: () => {
    return storage.get('user_settings')
  },
  updateUserSettings: (obj) => {
    return API.getUserSettings()
    .then(settings => {
      return storage.set('user_settings', {...settings, ...obj})
    })
  },
  showElementInNewTab: (element) => {
    return Ext.tabs.create({ url: element.url })
    .then(tab => {
      log('showElementInNewTab got tab', tab)
      return tabIpcStore.get(tab.id)
    })
    .then(ipc => {
      log('showElementInNewTab got ipc', ipc)
      return ipc.ask('HIGHLIGHT_ELEMENT', { element })
    })
  }
}

export default objMap(fn => wrapLogError(fn), API)
