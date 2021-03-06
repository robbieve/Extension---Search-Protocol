import 'babel-polyfill';
import ipc from '../../../common/ipc/ipc_cs'
import log from '../../../common/log'
import API from 'cs_api'
import {
  getPPI, getElementByXPath
} from '../../../common/dom_utils'
import { captureClientAPI } from '../../../common/capture_screenshot'
import { LOCAL_BRIDGE_STATUS } from '../../../common/models/local_model'
import {
  annotate, buildBridge, selectImageArea, genShowContentElements,
  initContextMenus, bindSelectionEvent, bindSocialLoginEvent, showMessage,
  getGlobalValue,
  getPageZindex, addSidebarEventListener, eventBind
} from './common'
import { showOneLink } from './show_bridges'
import { until, pick } from '../../../common/utils'
import i18n from '../../../i18n'

let state = {
  zIndex: 5,
  nearDistanceInInch:   1,
  nearVisibleDuration:  2,
  pixelsPerInch: 40,
  currentPage: {
    elements: [],
    bridges: [],
    annotations: []
  }
}

const setState = (obj) => {
  state = {
    ...state,
    ...obj
  }
}

const getLocalBridge = (() => {
  // let localBridgeStatus = LOCAL_BRIDGE_STATUS.EMPTY
  // let localBridgeData   = null
  // let element = null;

  // const pullStatus = () => {
  //   API.getLocalBridgeStatus()
  //   .then(({ status, data }) => {
  //     // console.log("getLocalBridgeStatus STATUS :: ", status);
  //     // console.log("getLocalBridgeStatus DATA :: ", data);
  //     localBridgeStatus = status
  //     localBridgeData   = data
  //   })

  //   API.getElementIdStatus()
  //   .then(({ data }) => {
  //     element = data
  //   })
  // }

  // setInterval(pullStatus, 2000)

  // return () => ({
  //   data:   localBridgeData,
  //   status: localBridgeStatus,
  //   element: element
  // })
})()

const setStateWithSettings = (settings) => {
  setState({
    nearDistanceInInch:   settings.nearDistanceInInch,
    nearVisibleDuration:  settings.nearVisibleDuration,
    pixelsPerInch:        getPPI(),
    showOnLoad: settings.showOnLoad
  })
}

const getCurrentPage = () => {
  return state.currentPage
}

const bindEvents = () => {
  ipc.onAsk(onBgRequest)
}

let CLEAR_ELEMENT = {};
const bindReloadEvent = (getCsAPI) => {
  CLEAR_ELEMENT["getCsAPI"] = getCsAPI
}

let linksAPI
let destroyMenu
let showContentElements

bindSocialLoginEvent(ipc)
const init = ({ isLoggedIn = false }) => {
  const getCsAPI = () => ({
    annotate,
    buildBridge,
    selectImageArea,
    showContentElements
  })
  showContentElements = genShowContentElements({
    zIndex: state.zIndex,
    currentUser,
    getCsAPI,
    getLocalBridge,
    getMouseRevealConfig: () => pick(['nearDistanceInInch', 'nearVisibleDuration', 'pixelsPerInch'], state),
    onUpdateCurrentPage:  (currentPage) => setState({ currentPage }),
    onUpdateAPI:          (api) => { linksAPI = api }
  })

  bindEvents()
  bindReloadEvent(getCsAPI);
  // !eventBind && addSidebarEventListener(showContentElements);
  isLoggedIn // && bindSelectionEvent({ getCurrentPage })
  API.getUserSettings()
  .then(settings => {
    i18n.changeLanguage(settings.language)
    setStateWithSettings(settings)
    if (showContentElements && typeof showContentElements === 'function') {
        showContentElements({ hide : true })
      }
      if (settings.showOnLoad) {
        destroyMenu = initContextMenus({ getCurrentPage, getLocalBridge, showContentElements, isLoggedIn })
        showContentElements({ isLoggedIn })
      }
    })
}

const onBgRequest = (cmd, args) => {
  log('onBgRequest', cmd, args)

  switch (cmd) {
    case 'CHANGE_LANGUAGE': {
      i18n.changeLanguage(args)
      return true
    }

    case 'START_CAPTURE_SCREENSHOT': {
      return captureClientAPI.startCapture()
    }

    case 'END_CAPTURE_SCREENSHOT': {
      return captureClientAPI.endCapture(args.pageInfo)
    }

    case 'SCROLL_PAGE': {
      return captureClientAPI.scrollPage(args.offset)
    }

    case 'UPDATE_SETTINGS': {      
      log('Got UPDATE_SETTINGS', args)
      if (!args.settings.showOnLoad) {
        destroyMenu && typeof destroyMenu === 'function' && destroyMenu()
        showContentElements({ hide : true })
      } else {
        // destroyMenu && typeof destroyMenu === 'function' && destroyMenu()
        if (destroyMenu && typeof destroyMenu === 'function') {
          console.log('destroying menu')
          destroyMenu()
        }
        showContentElements({ hide : true })
        checkUserBeforeInit({fromListening: 0})
        // init()
      }
      setStateWithSettings(args.settings)

      if (linksAPI) {
        linksAPI.setDistance(state.nearDistanceInInch * state.pixelsPerInch)
        linksAPI.setDuration(state.nearVisibleDuration)
      }

      return true
    }

    case 'googleLogin': {
      checkUserBeforeInit({fromListening: 0});
      return true;
    }

    case 'HIGHLIGHT_ELEMENT': {
      const { element, bridge } = args

      if (!bridge.is_like) {
        until('element', () => {
          let $el = getElementByXPath(element.locator || element.start.locator)

          if ($el && $el.nodeType === 3) {
            $el = $el.parentNode
          }

          return {
            pass: $el,
            result: $el
          }
        }, 500, 10000)
        .then($el => {
          $el.scrollIntoView()
        
          setTimeout(() => {
            const linkAPI = showOneLink({
              zIndex: state.zIndex,
              link:       element,
              color:      '#EF5D8F',
              opacity: 1,
              needBadge:  false,
              upvoteBridge: true,
              onLikeElement: (via) => {
                
                if (via === "close") {
                  linkAPI.destroy();
                  return;
                }

                const request_obj = {
                  emoji_type: 'like',
                  is_like: false,
                  type: 0,
                  type_id: bridge.id
                }
                API.likeAction(request_obj)
                .then(response => {
                  linkAPI.destroy();
                  showContentElements();
                })
                
              }
            })
            setTimeout(() => {
              linkAPI.destroy()
            }, 60000 * 2)
          }, 1000)
        })
        }
      return true
    }
  }
}

// const selectScreenshotArea = () => {
//   return createSelectionBox({
//     onFinish: ({ rectAPI, boxRect }) => {
//       rectAPI.hide()

//       API.captureScreenInSelection({
//         rect: boxRect,
//         devicePixelRatio: window.devicePixelRatio
//       })
//       .then(image => {
//         rectAPI.destroy()
//         annotate({
//           linkData: {
//             type:   ELEMENT_TYPE.SCREENSHOT,
//             url:    window.location.href,
//             image:  image,
//             rect:   boxRect
//           }
//         })
//       })
//       .catch(e => {
//         log.error(e)
//       })
//     }
//   })
// }

/*
fromListening = 0 (Normal flag, when something happen from extension only )
fromListening = 1 (Normal flag, when something happen from web login )
*/
let E_MAIL = '';
let currentUser;
const checkUserBeforeInit = ({fromListening}) => {
  API.checkUser().then(user => {
    currentUser = user;
    E_MAIL = user.email;
    init({isLoggedIn:true})
    getLocalStoreFromExtension()
    .then(token => {
      setLocalStore("bridgit-token", token);
      // POSTMessage should pass in only case when event triggered (login from extension) from extension only
      removeLocalStore("bridgit_logout");
      if (fromListening === 0) {
        window.postMessage({type: "BRIDGIT-EXTENSION", token: token},'*');
      }
    })

  })
  .catch(e => {
    init({isLoggedIn:false})
    removeLocalStore("bridgit-token");
    setLocalStore("bridgit_logout", "1");
    if (fromListening === 0) {
      API.logoutToUpdateFlag(E_MAIL);
      window.postMessage({type: "BRIDGIT-EXTENSION", token: ""},'*');
    }
  })
}

const setLocalStore = (key, value) => {
  localStorage.setItem(key, value);
}

const removeLocalStore = (key) => {
  localStorage.removeItem(key);
}

const getLocalStoreFromExtension = () => {
  return new Promise((resolve, rejecct) => {
    API.getUserToken()
    .then(token => {
      resolve(token);
    })  
})

}

/**
 * Universal login (chrome extension and web).
 */
const listen_token_message = () => {

  window.addEventListener("message", event => {

    let data = event.data;
    if (data.type && data.type == "BRIDGIT-WEB" ) {

      if (data.token) {
        
          removeLocalStore("bridgit_logout");
          API.loginWithToken({token: data.token})
          .then(status => {
            checkUserBeforeInit({fromListening: 1});
          })
          .catch(err => { 
            checkUserBeforeInit({fromListening: 1})
          })
      }
      else {
        setLocalStore("bridgit_logout", "1");
        API.removeAccessToken();
        API.removeUserInfo();
        setTimeout(() => {
          checkUserBeforeInit({fromListening: 1});
        }, 2000);
      }
  }
    
});

}

chrome.extension.onRequest.addListener(function(request, sender, sendResponse) {
  if (request.method == 'youtube_video') {
    var elements = document.getElementsByClassName("bridgit_bridge_count");
    while (elements[0]) {
        elements[0].parentNode.removeChild(elements[0]);
    }

    CLEAR_ELEMENT["getCsAPI"]().showContentElements();
    
  }  
});


/**
 * setZindex if page contain inappropriate.
 */
function setPageZIndex() {
  const zIndex = getPageZindex();
  setState({zIndex:zIndex })
}

// document.body.setAttribute('bridgit-installed', true)
localStorage.setItem('bridgit-installed', true)
document.addEventListener('DOMContentLoaded', () => {
  console.log("DOMContentLoaded :: ");

  setTimeout(() => {
    setPageZIndex();
    listen_token_message();
    checkUserBeforeInit({fromListening: 1}); // fromListening: 1  is for solving reloading issue in login uniform fnctionality 
    }, 1000);

  // Run your code here...
});

// init()
