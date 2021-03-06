import * as C from '../../../common/constant'
import log from '../../../common/log'
import API from 'cs_api'
import Ext from 'ext'
import { parseRangeJSON } from '../../../common/selection'
import { ELEMENT_TYPE } from '../../../common/models/element_model'
import { liveBuild, isRectsIntersect, or } from '../../../common/utils'
import {
  setStyle, scrollLeft, scrollTop, clientWidth, clientHeight,
  pixel, pageX, pageY, getElementByXPath
} from '../../../common/dom_utils'
import {
  commonStyle,
  createEl,
  createIframeWithMask,
  createOverlayForRects,
  showMessage,
  getGlobalValue,
  copyTextToClipboard,
  appendActiveElements,
  openBridgitSidebar
} from './common'
import { rectsPointPosition } from './position'
import { setInterval, clearInterval } from 'timers';

/**
 * Makes API call.
 *
 * Args:
 *     call_for (string):
 *        1. Bridge
 *        2. Notes
 */
export const apiCallBridgesNotes = (call_for) => {
  
  return new Promise((resolve, reject) => {

    Promise.all( (call_for == 1) ? [API.loadRelations() ] : [API.loadNoteCategories(), API.getCategories() ]  )
    .then(values => {
      resolve(values);
    })
    .catch(err => {
      reject(err);
    })
  })

}

export const showLinks = ({ zIndex, elements, bridges, annotations, lists, url, onCreate, getCsAPI }) => {
  const links = elements.map(item => {
    return {
      ...item,
      bridges:      bridges.filter(a => a.from === item.id || a.to === item.id),
      annotations:  annotations.filter(b => b.target === item.id),
      lists:  lists.filter(l => l.target === item.id)
    }
  })
  .filter(item => item.bridges.length + item.annotations.length + item.lists.length >= 0)

  const allLinks  = links.map(link => showOneLink({
    zIndex,
    link,
    onCreate,
    getCsAPI,
    getLinksAPI:  () => linksAPI
  }))
  .filter(x => x)

  const linksAPI = {
    links: allLinks,
    hide: () => {
      allLinks.forEach(item => item.hide())
    },
    destroy: () => {
      allLinks.forEach(item => {
        try {
          item.destroy()
        } catch (e) {
          log('some exception', e)
        }
      })
    }
  }

  return linksAPI
}

export const showOneLink = ({ zIndex, link, getLinksAPI, getCsAPI, color, opacity, needBadge = true, upvoteBridge = false, onCreate = () => {}, onLikeElement = () => {} }) => {
  log('showOneLink', link.type, link)
  
  switch (link.type) {
    case ELEMENT_TYPE.IMAGE:
      return showImage({ zIndex, link, getLinksAPI, getCsAPI, color, opacity, needBadge, upvoteBridge, onCreate, onLikeElement })

    case ELEMENT_TYPE.SELECTION:
      return showSelection({ zIndex, link, getLinksAPI, getCsAPI, color, opacity, needBadge, upvoteBridge, onCreate, onLikeElement })

    default:
      throw new Error(`Unsupported type '${link.type}'`)
  }
}

const commonShowAPI = ({ rects }) => {
  const normalizedRects = rects.map(r => ({
    left:   pageX(r.left),
    top:    pageY(r.top),
    width:  r.width,
    height: r.height
  }))

  return {
    isInView: () => {
      const winRect = {
        left:     scrollLeft(document),
        top:      scrollTop(document),
        width:    clientWidth(document),
        height:   clientHeight(document)
      }
      const result = or(
        ...normalizedRects.map(rect => isRectsIntersect(winRect, rect))
      )

      // log('isInView', normalizedRects, winRect, result)
      return result
    },
    pointPosition: (point, distance) => {
      return rectsPointPosition({
        point,
        rects: normalizedRects,
        nearDistance: distance
      })
    }
  }
}

// const isShowHyperLinkBadgeCalled = () => {
//   return(
//     window.location.host !== "www.youtube.com" && window.location.host !== "www.quora.com"
//   )
// }


/**
 * This function is for other URL reference purpose.
 *
 * If any page has some url and that url contain any bridge elements then this url has badge with total counts and by clicking it redirect to the page
 * 
 * Args:
 *     totalCount (int):
 *        no.of elements(bridge/notes/lists)
 *      url(string):
 *        url of page which contain other elements
 *      $el(object):
 *        ELements for the badge
 *      globalLiveBuildAPI(object):
 *        GLobal object which contain badge information
 */
export const showHyperLinkBadge = ({ totalCount, url, $el, globalLiveBuildAPI }) => {
  let timer

  const liveBuildAPI = liveBuild({
    bindEvent: (fn) => {
      // if ( isShowHyperLinkBadgeCalled() ) {
        window.addEventListener('resize', fn)
        window.addEventListener('scroll', fn)
        timer = setInterval(fn, 2000)
      // }
    },
    unbindEvent: (fn) => {
      window.removeEventListener('resize', fn)
      window.removeEventListener('scroll', fn)
      clearInterval(timer)
    },
    getFuse: () => {
      const rect = $el.getBoundingClientRect()
      return rect
    },
    isEqual: (r1, r2) => {
      const encode = (r) => JSON.stringify(r)
      return encode(r1) === encode(r2)
    },
    onFuseChange: (rect, oldAPI) => {
      if (oldAPI) oldAPI.destroy()

      const topRight  = {
        top:  pixel(pageY(rect.top)),
        left: pixel(pageX(rect.left + rect.width))
      }
      const badgeAPI  = showBridgeCount({
        text:     totalCount,
        position: topRight,
        style: {
          background: '#ef5d8f',
          color:      '#fff'
        },
        onClick:  () => { window.location.href = url },
        isHyperLinkBadge: true
      })

      const api = {
        getBadgeContainer: () => {
          return badgeAPI.$dom
        },
        show: () => {
          badgeAPI.show()
        },
        hide: () => {
          // badgeAPI.hide()
          badgeAPI.fade()
        },
        destroy: () => {
          badgeAPI.destroy()
        }
      }

      return api
    }
  })
  globalLiveBuildAPI.push(liveBuildAPI);

  const api = ['getOverlayContainer', 'getBadgeContainer', 'getElement', 'show', 'hide', 'isInView', 'pointPosition'].reduce((prev, key) => {
    prev[key] = (...args) => {
      if (!liveBuildAPI)  return
      return liveBuildAPI.getAPI()[key](...args)
    }
    return prev
  }, {})

  api.destroy = () => {
    liveBuildAPI.getAPI().destroy()
    liveBuildAPI.destroy()
  }

  return api
}

export const showImage = ({ zIndex, link, getLinksAPI, getCsAPI, color, opacity, needBadge, upvoteBridge, onCreate, onLikeElement }) => {
  const { bridges = [], annotations = [], lists = [] } = link
  const totalCount  = bridges.length + annotations.length + lists.length
  let timer

  const liveBuildAPI = liveBuild({
    initial: true,
    bindEvent: (fn) => {
      window.addEventListener('resize', fn)
      window.addEventListener('scroll', fn)
      // timer = setInterval(fn, 2000)
    },
    unbindEvent: (fn) => {
      window.removeEventListener('resize', fn)
      window.removeEventListener('scroll', fn)
      // clearInterval(timer)
    },
    getFuse: () => {
      try {
        const $img        = getElementByXPath(link.locator)
        const boundRect   = $img.getBoundingClientRect()
        const ratio       = link.imageSize && link.imageSize.width ? (boundRect.width / link.imageSize.width) : 1
        const rect        = {
          top:      ratio * link.rect.y + boundRect.top,
          left:     ratio * link.rect.x + boundRect.left,
          width:    ratio * link.rect.width,
          height:   ratio * link.rect.height
        }
        return rect
      } catch (e) {
        return null
      }
    },
    isEqual: (r1, r2) => {
      const encode = (r) => JSON.stringify(r)
      return encode(r1) === encode(r2)
    },
    onFuseChange: (rect, oldAPI) => {
      if (!rect)  return null
      if (oldAPI) oldAPI.destroy()

      const topRight    = {
        top:  pixel(pageY(rect.top)),
        left: pixel(pageX(rect.left + rect.width))
      }
      const overlayAPI  = createOverlayForRects({ zIndex, color, opacity, rects: [rect], upvoteBridge, onLikeElement })
      const badgeAPI    = needBadge ? showBridgeCount({
        zIndex,
        text:     '' + totalCount,
        position: topRight,
        onClick:  () => {
          // if (totalCount > 0) {
            appendActiveElements({element_id: link.id, showContentElements: getCsAPI().showContentElements})
            showBridgesModal({ getCsAPI, bridges, annotations, lists, elementId: link.id, element: link })
          // }
        }
      }) : {
        show: () => {},
        hide: () => {},
        fade: () => {},
        destroy: () => {}
      }

      const api = {
        ...commonShowAPI({ rects: [rect] }),
        getOverlayContainer: () => {
          return overlayAPI.$container
        },
        getBadgeContainer: () => {
          return badgeAPI.$dom
        },
        getElement: () => {
          return link
        },
        show: () => {
          overlayAPI.show()
          badgeAPI.show()
        },
        hide: () => {
          // overlayAPI.hide()
          overlayAPI.fade()
          badgeAPI.fade()
          // badgeAPI.hide()
        },
        destroy: () => {
          overlayAPI.destroy()
          badgeAPI.destroy()
        }
      }

      onCreate(api)
      return api
    }
  })

  const api = ['getOverlayContainer', 'getBadgeContainer', 'getElement', 'show', 'hide', 'isInView', 'pointPosition'].reduce((prev, key) => {
    prev[key] = (...args) => {
      if (!liveBuildAPI)  return
      return liveBuildAPI.getAPI()[key](...args)
    }
    return prev
  }, {})

  api.destroy = () => {
    liveBuildAPI.getAPI().destroy()
    liveBuildAPI.destroy()
  }

  return api
}


/**
 * Track bridge cross (how many users open particular bridge).
 *
 * Args:
 *     bridges (object):
 *        bridges information         
 *     link (object):
 *        Contain information in which we hightlight it
 *
 */
const bridgeCross = (bridges, link) => {
  API.fetchUserInfo().then(user => {

    if (bridges.length > 0) {
      let bridges_obj = {data: []};
      bridges.forEach(bridge => {
        if (!user || bridge.created_by != user.id) {
          let bridge_cross = {'bridge_id': bridge.id,'user_id': user ? user.id : 0, 'ending_content_element': link.id == bridge.from ? bridge.to : bridge.from}
          bridges_obj.data.push(bridge_cross)
        }
      })
      if (bridges_obj.data.length > 0) API.bridgeCross(bridges_obj)

    }

  });
    
}

export const showSelection = ({ zIndex, link, getLinksAPI, getCsAPI, color, opacity, needBadge, upvoteBridge, onCreate, onLikeElement }) => {
  const { bridges = [], annotations = [], lists = [] } = link
  const totalCount  = bridges.length + annotations.length + lists.length
  let timer

  const liveBuildAPI = liveBuild({
    initial: true,
    bindEvent: (fn) => {
      window.addEventListener('resize', fn)
      window.addEventListener('scroll', fn)
      timer = setInterval(fn, 2000)
    },
    unbindEvent: (fn) => {
      window.removeEventListener('resize', fn)
      window.removeEventListener('scroll', fn)
      clearInterval(timer)
    },
    getFuse: () => {
      try {
        const range = parseRangeJSON(link)
        log('showSelection - getFuse', range, range.getClientRects(), range.getBoundingClientRect())
        const rects = range.getClientRects()
        return Array.from(rects)
      } catch (e) {
        return null
      }
    },
    isEqual: (rs1, rs2) => {
      const encode = (rs) => JSON.stringify(rs.map(r => r.toJSON()))
      return encode(rs1) === encode(rs2)
    },
    onFuseChange: (rects, oldAPI) => {
      log('showSelection', rects)
      if (!rects || !rects.length)  return null
      if (oldAPI) oldAPI.destroy()

      const topRight    = {
        top:  pixel(pageY(rects[0].top)),
        left: pixel(pageX(rects[0].left + rects[0].width))
      }
      const overlayAPI = createOverlayForRects({ color, opacity, rects, zIndex, upvoteBridge, onLikeElement })
      const badgeAPI    = needBadge ? showBridgeCount({
        zIndex,
        text:     '' + totalCount,
        position: topRight,
        onClick:  () => {
          // if (totalCount > 0) {
            appendActiveElements({element_id: link.id, showContentElements: getCsAPI().showContentElements})
            showBridgesModal({ getCsAPI, bridges, annotations, lists, elementId: link.id, element: link })
            bridgeCross(bridges, link)
          // }
        }
      }) : {
        show: () => {},
        hide: () => {},
        fade: () => {},
        destroy: () => {}
      }

      const api = {
        ...commonShowAPI({ rects }),
        getOverlayContainer: () => {
          return overlayAPI.$container
        },
        getBadgeContainer: () => {
          return badgeAPI.$dom
        },
        getElement: () => {
          return link
        },
        show: () => {
          overlayAPI.show()
          badgeAPI.show()
        },
        hide: () => {
          // overlayAPI.hide()
          // badgeAPI.hide()
          overlayAPI.fade()
          badgeAPI.fade()
        },
        destroy: () => {
          overlayAPI.destroy()
          badgeAPI.destroy()
        }
      }

      onCreate(api)
      return api
    }
  })

  const api = ['getOverlayContainer', 'getBadgeContainer', 'getElement', 'show', 'hide', 'isInView', 'pointPosition'].reduce((prev, key) => {
    prev[key] = (...args) => {
      if (!liveBuildAPI)  return
      return liveBuildAPI.getAPI()[key](...args)
    }
    return prev
  }, {})

  api.destroy = () => {
    liveBuildAPI.getAPI().destroy()
    liveBuildAPI.destroy()
  }

  return api
}


/**
 * Shows bridge count for every selected content(ex. if we created any bridges/notes/lists for content).
 *
 * Args:
 *     zIndex (int):
 *        It contain zINdex for the badge count         
 *     position (object):
 *        It contain position of that badge (left and top) 
 *     text (int):
 *        total count (this badge contain how many notes/bridges/lists)
 *     onClick (function):
 *        pass function, which executed when click on badge
 *     style (int):
 *        styling for that selection (content)
 *     isHyperLinkBadge (boolean):
 *        two type of badge
 *           1. Simple badge, by clicking it would open popup which contain no.of lists/notes/bridges
 *           2. Redirect badge, by clicking it would redirect to the page where we create bridge
 *
 */
export const showBridgeCount = ({ zIndex, position, text, onClick, style = {}, isHyperLinkBadge = false }) => {

  const className = isHyperLinkBadge ? "bridgit_bridge_count" : "bridgit_content_element";

  const size  = 40
  const $el   = createEl({
    text,
    style: {
      ...commonStyle,
      ...position,
      'user-select': 'none',
      transform:  'translate(-80%, -80%)',
      position:   'absolute',
      'z-index':    zIndex , //11, 100001
      width:      `${size}px`,
      height:     `${size}px`,
      'line-height': `${size}px`,
      'border-radius': `${size / 2}px`,
      border:     '1px solid #666',
      'font-size':   '18px',
      'font-weight': 'bold',
      background: '#fff',
      color:      '#ef5d8f',
      cursor:     'pointer',
      'text-align':  'center',
      'box-shadow':  'rgba(0, 0, 0, 0.14) 0px 2px 2px 0px, rgba(0, 0, 0, 0.12) 0px 1px 5px 0px, rgba(0, 0, 0, 0.2) 0px 3px 1px -2px',
      ...style
    },
    attrs: {
      class: className
    }
  })

  $el.addEventListener('click', onClick)
  document.body.appendChild($el)

  return {
    $dom: $el,
    hide: () => {
      setStyle($el, { display: 'none' })
    },
    fade: () => {
      let opacity = 1.0;
      if ($el.style.opacity && parseInt($el.style.opacity) !== 1) {
        return;
      }
      let fadeEffect = setInterval(() => {
        if (opacity > 0) {
          opacity -= 0.25;
        } else {
          setStyle($el, { display: 'none' })
          clearInterval(fadeEffect);
          return;
        }
        setStyle($el, { opacity: opacity })
      }, 100)
    },
    show: () => {
      setStyle($el, { display: 'block', opacity: 1 })
    },
    destroy: () => {
      $el.removeEventListener('click', onClick)
      $el.remove()
    }
  }
}


/**
 * It would open sharing modal.
 *
 * Args:
 *     shareContent (object):
 *        information that may contain bridge/note/list data         
 *     type (int):
 *        specify which type should be share (ex. bridge/note/list)
 *     followers (object):
 *        no.of followers that follow current user
 *
 */
export const showShareContent = ({ shareContent, type, followers }) => {
  const iframeAPI = createIframeWithMask({
    url:    Ext.extension.getURL('share_content.html'),
    width:  500,
    height: 320,
    onAsk:  (cmd, args) => {
      switch (cmd) {
        case 'INIT':
          return {
            shareContent,
            type,
            followers
          }
        case 'COPIED_URL':
          copyTextToClipboard(args.share_url, {clientY: 400}, 500000, 400);
          return true;
        case 'CLOSE':
          iframeAPI.destroy()
          return true
        case 'DONE':
          iframeAPI.destroy()
          return true
      }
    }
  })

  setStyle(iframeAPI.$iframe, {
    position: 'fixed',
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    border: '1px solid #ccc'
  })
}
export const showFlagContent = ({ content }) => {
    const iframeAPI = createIframeWithMask({
      url:    Ext.extension.getURL('flag_content.html'),
      width:  500,
      height: 450,
      onAsk:  (cmd, args) => {
        switch (cmd) {
          case 'INIT':
            return {
              content
            }
          case 'CLOSE':
            iframeAPI.destroy()
            return true
          case 'DONE':
            iframeAPI.destroy()
            return true
        }
      }
    })

    setStyle(iframeAPI.$iframe, {
      position: 'fixed',
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
      border: '1px solid #ccc'
    })
}


/**
 * this function popup message if user in not login and try to open any badge.
 */
const loginMessage = () => {

  API.getLoginMessage()
    .then(data => {
      
      if (data && data.message) {
        // const showMsg = (e) => {

        const message = data.message.replace(/<\/?[^>]+(>|$)/g, "");
        setTimeout(() => {
          showMessage(message, {yOffset: 400 }, getGlobalValue().messageZindex);
        }, 1000);
          // window.removeEventListener('mousemove', showMsg);
        // }
        // window.addEventListener('mousemove', showMsg);
      }

  })
  .catch(err => console.log(err))
}

/**
 * Shows modal when user click on badge(upper part of highlight section).
 *
 * Args:
 *     getCsAPI (object):
 *        It contain multiple values like fetch latest data from backend, fetch annotate or bridge value         
 *     bridges (object):
 *        It contain bridges information if there 
 *     annotations (object):
 *        It contain notes(annotations) information if there
 *     lists (object):
 *        It contain lists information if there
 *     elementId (int):
 *        unique elementId for that content
 *     element (object):
 *        It contain element information like page identification, element identification
 *
 */
export const showBridgesModal = ({ getCsAPI, bridges, annotations, lists, elementId, element }) => {
  const iframeAPI = createIframeWithMask({
    url:    Ext.extension.getURL('related_elements.html'),
    width:  clientWidth(document),
    height: clientHeight(document),
    onAsk: (cmd, args) => {
      log('showBridgesModal onAsk', cmd, args)

      switch (cmd) {
        case 'INIT_RELATED_ELEMENTS': {
          const getExtraRelationIds = (bridges, relations) => {
            return bridges.reduce((list, b) => {
              if (!relations.find(r => r.id === b.relation)) {
                list.push(b.relation)
              }
              return list
            }, [])
          }
          const getExtraCategoryIds = (annotations, noteCategories) => {
            return annotations.reduce((list, a) => {
              if (!noteCategories.find(n => n.id === a.relation)) {
                list.push(a.relation)
              }
              return list
            }, [])
          }
          return Promise.all([
            API.loadRelations(),
            API.checkUser().catch(e => null),
            API.loadNoteCategories()
          ])
          .then(([relations, userInfo, noteCategories]) => {
            if (!userInfo) loginMessage();
            // Note: there could be relations used in bridges, but not included in your own relation list
            const extraRelationIds  = getExtraRelationIds(bridges, relations)
            const pExtraRelations   = extraRelationIds.length > 0
                                        ? API.listRelationsByIds(extraRelationIds)
                                        : Promise.resolve([])

            const extraCategoryIds = getExtraCategoryIds(annotations, noteCategories)
            const pExtraCategories = extraCategoryIds.length > 0
                                      ? API.listNoteCategoriesByIds(extraCategoryIds)
                                      : Promise.resolve([])
            return Promise.all([
              pExtraRelations,
              pExtraCategories
            ]).then(([extraRelations, extraCategories]) => {
              return {
                userInfo,
                bridges,
                annotations,
                elementId,
                element,
                lists,
                relations: [...relations, ...extraRelations],
                noteCategories: [...noteCategories, ...extraCategories]
              }
            })
          })
        }
        case 'RELOAD_BRIDGES_AND_NOTES': {
          getCsAPI().showContentElements()
          return true
        }
        case 'FLAG_CONTENT': {
          showFlagContent({content: args.content})
          return true
        }
        case 'SHARE_CONTENT': {
          //0 : bridge, 1: notes, 2= content elements, 3 = lists
          showShareContent({shareContent: args.shareContent, type: args.type, followers: args.followers})
          return true
        }
        case 'EDIT_LIST': {
          const csAPI = getCsAPI()
          openBridgitSidebar('', csAPI.showContentElements, true, args.list);
          return true
        }

        case 'EDIT_ANNOTATION': {
          const csAPI = getCsAPI()

          csAPI.annotate({
            mode:           C.UPSERT_MODE.EDIT,
            linkData:       args.annotation.target,
            annotationData: args.annotation,
            onSuccess: ({ annotation }) => {
              log('EDIT_ANNOTATION onSuccess', annotation)
              API.loadRelations()
                .then(relations => {
                  iframeAPI.ask('UPDATE_ANNOTATION', { annotation, relations })
                })
              csAPI.showContentElements()
            }
          })
          return true
        }

        case 'EDIT_BRIDGE': {
          const csAPI = getCsAPI()

          API.setLocalBridge({
            from:     args.bridge.fromElement,
            to:       args.bridge.toElement,
            relation: args.bridge.relation,
            tags:     args.bridge.tags,
            desc:     args.bridge.desc
          })
          .then(() => {
            csAPI.buildBridge({
              mode:         C.UPSERT_MODE.EDIT,
              bridgeData:   args.bridge,
              linkPair:     {
                data: {
                  links: [
                    args.bridge.fromElement,
                    args.bridge.toElement
                  ]
                }
              },
              onSuccess: ({ bridge }) => {
                log('EDIT_BRIDGE onSuccess', bridge)

                // Note: There could be new relation created,
                API.loadRelations()
                .then(relations => {
                  iframeAPI.ask('UPDATE_BRIDGE', { bridge, relations })
                })

                csAPI.showContentElements()
              }
            })
          })
          .catch(e => {
            log.error(e.stack)
          })

          return true
        }

        case 'CLOSE_RELATED_ELEMENTS':
          modalAPI.destroy()
          return true
      }
    }
  })

  const onResize = () => {
    setStyle(iframeAPI.$iframe, {
      width:  pixel(clientWidth(document)),
      height: pixel(clientHeight(document))
    })
  }
  window.addEventListener('resize', onResize)

  setStyle(iframeAPI.$iframe, {
    position: 'fixed',
    left: '0',
    top: '0',
    right: '0',
    bottom: '0'
  })

  const modalAPI = {
    destroy: () => {
      window.removeEventListener('resize', onResize)
      iframeAPI.destroy()
    }
  }

  return modalAPI
}
