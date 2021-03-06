import React, { Component } from 'react'
import { Button } from 'antd'
import { translate } from 'react-i18next'

import { notifyError, notifySuccess } from '../components/notification'
import { ipcForIframe } from '../common/ipc/cs_postmessage'
import API from 'cs_api'
import log from '../common/log'
import { Box, getAnchorRects, BOX_ANCHOR_POS } from '../common/shapes/box'
import './app.scss'
import { pixel, dataUrlFromImageElement } from '../common/dom_utils'
import { rectFromXyToLeftTop, isTwoRectsIntersecting, or, objMap } from '../common/utils'
import { LOCAL_BRIDGE_STATUS } from '../common/models/local_model'
import config from '../config'

const ipc = ipcForIframe()

class App extends Component {
  state = {
    linkPair: null,
    status: null,
    linkData: null,
    cropRect: null,
    image: {
      dataUrl: null,
      width: 0,
      height: 0
    },
    existingImageAreas: []
  }

  canBuildBridge = () => {
    const { linkPair } = this.state
    if (!linkPair)  return false
    return linkPair.status === LOCAL_BRIDGE_STATUS.ONE || linkPair.data.lastAnnotation
  }

  canUpdateElementInBridge = () => {
    const { linkPair } = this.state
    if (!linkPair)  return false
    return linkPair.status === LOCAL_BRIDGE_STATUS.EDITING
  }

  getImageAreaRatio = (element, fullSize) => {
    return element.imageSize && element.imageSize.width ? (fullSize.width / element.imageSize.width) : 1
  }

  prepareLinkData = () => {
    const { t }     = this.props
    const { existingImageAreas, image, cropRect } = this.state
    const totalArea = image.width * image.height
    const area      = cropRect.width * cropRect.height
    let errMsg

    log('prepareLinkData, area', area, totalArea)

    if (area < config.settings.minImageArea) {
      errMsg = `Selected area must be larger than ${config.settings.minImageArea} pixel^2`
    }

    // if (!errMsg && area < (config.settings.minImageAreaRatio * totalArea)) {
    //   errMsg = `Selected area must be larger than ${config.settings.minImageAreaRatio * 100}% of the image area`
    // }

    if (!errMsg) {
      const convertElementToRect = (element) => {
        const ratio = this.getImageAreaRatio(element, image)
        return objMap(val => val * ratio, element.rect)
      }
      const hasAnyIntersect = or(
        ...existingImageAreas.map(element => {
          return isTwoRectsIntersecting(cropRect, convertElementToRect(element))
        })
      )

      if (hasAnyIntersect) {
        errMsg = t('selecteImageArea:intersectExistingErrMsg')
      }
    }

    if (errMsg) {
      alert(errMsg)
      throw new Error(errMsg)
    }

    return dataUrlFromImageElement(this.$img, cropRect)
    .then(({ dataUrl }) => {
      return {
        ...this.state.linkData,
        rect:   cropRect,
        image:  dataUrl
      }
    })
  }

  onClickAnnotate = () => {
    this.prepareLinkData()
    .then(linkData => {
      return ipc.ask('ANNOTATE', { linkData })
    })
    .catch(e => log.error(e.stack))
  }

  onClickCreateBridge = () => {
    this.prepareLinkData()
    .then(linkData => ipc.ask('CREATE_BRIDGE', { linkData }))
    .catch(e => log.error(e.stack))
  }

  onClickBuildBridge = () => {
    this.prepareLinkData()
    .then(linkData => ipc.ask('BUILD_BRIDGE', { linkData }))
    .catch(e => log.error(e.stack))
  }

  onClickUpdateElementInBridge = () => {
    this.prepareLinkData()
    .then(linkData => ipc.ask('UPDATE_ELEMENT_IN_BRIDGE', { linkData }))
    .catch(e => log.error(e.stack))
  }

  onClickCancel = () => {
    ipc.ask('CLOSE')
  }

  onMouseMove = (e) => {
    switch (this.state.status) {
      case 'moving_box': {
        this.state.box.moveBox({
          dx: e.pageX - this.state.startPos.x,
          dy: e.pageY - this.state.startPos.y
        })
        break
      }

      case 'moving_anchor': {
        const containerRect = this.$container.getBoundingClientRect()
        const x = e.clientX - containerRect.left
        const y = e.clientY - containerRect.top

        this.state.box.moveAnchor({ x, y })
        break
      }
    }
  }

  onMouseUp = (e) => {
    switch (this.state.status) {
      case 'moving_box':
        this.state.box.moveBoxEnd()
        break

      case 'moving_anchor':
        this.state.box.moveAnchorEnd()
        break
    }

    this.setState({ status: null })
  }

  componentDidMount () {
    ipc.ask('INIT')
    .then(({ linkPair, linkData, dataUrl, width, height, existingImageAreas }) => {
      const box = new Box({
        width,
        height,
        x: 0,
        y: 0,
        firstSilence: false,
        onStateChange: ({ rect }) => {
          log('box onStateChange', rect)
          this.setState({ cropRect: rect })
        },
        normalizeRect: (rect, action, old) => {
          const guard = (rect) => {
            return rect.width * rect.height <= config.settings.minImageArea ? old : rect
          }

          if (action === 'moveAnchor') {
            return guard({
              x:      Math.max(0, rect.x),
              y:      Math.max(0, rect.y),
              width:  Math.min(rect.width, width - rect.x),
              height: Math.min(rect.height, height - rect.y)
            })
          } else if (action === 'moveBox') {
            const dx = (function () {
              if (rect.x < 0)  return -1 * rect.x
              if (rect.x + rect.width > width)  return (width - rect.x - rect.width)
              return 0
            })()
            const dy = (function () {
              if (rect.y < 0)  return -1 * rect.y
              if (rect.y + rect.height > height)  return (height - rect.y - rect.height)
              return 0
            })()

            return guard({
              x:      rect.x + dx,
              y:      rect.y + dy,
              width:  rect.width,
              height: rect.height
            })
          }
        }
      })

      this.setState({
        box,
        linkData,
        linkPair,
        image: {
          dataUrl,
          width,
          height
        },
        existingImageAreas
      })
    })
  }

  renderCropArea () {
    const { cropRect } = this.state
    if (!cropRect)  return null

    const klass = {
      TOP_LEFT:     'lt',
      TOP_RIGHT:    'rt',
      BOTTOM_RIGHT: 'rb',
      BOTTOM_LEFT:  'lb'
    }
    const anchorPos = Object.keys(BOX_ANCHOR_POS).map(key => ({
      key,
      className:  klass[key],
      value:      BOX_ANCHOR_POS[key]
    }))

    return (
      <div
        className="crop-area"
        style={{
          top:    pixel(cropRect.y),
          left:   pixel(cropRect.x),
          width:  pixel(cropRect.width),
          height: pixel(cropRect.height)
        }}
        onMouseDown={(e) => {
          this.state.box.moveBoxStart()
          this.setState({
            status: 'moving_box',
            startPos: {
              x: e.pageX,
              y: e.pageY
            }
          })
        }}
      >
        {anchorPos.map(item => (
          <div
            key={item.key}
            className={`anchor ${item.className}`}
            onMouseDown={(e) => {
              e.stopPropagation()
              this.state.box.moveAnchorStart({ anchorPos: item.value })
              this.setState({ status: 'moving_anchor' })
            }}
          >
          </div>
        ))}
      </div>
    )
  }

  renderExistingImageAreas () {
    const { existingImageAreas, image } = this.state
    const getStyle = (element) => {
      const ratio = this.getImageAreaRatio(element, image)

      return {
        top:    pixel(ratio * element.rect.y),
        left:   pixel(ratio * element.rect.x),
        width:  pixel(ratio * element.rect.width),
        height: pixel(ratio * element.rect.height)
      }
    }

    return (
      <div>
        {existingImageAreas.map((element, i) => (
          <div
            key={i}
            className="existing-image-area"
            style={getStyle(element)}
          >
          </div>
        ))}
      </div>
    )
  }

  render () {
    const { t } = this.props

    return (
      <div
        className="select-area-wrapper"
        onMouseMove={this.onMouseMove}
        onMouseUp={this.onMouseUp}
      >
        <div
          ref={r => { this.$container = r }}
          className="image-wrapper"
          style={{
            width: this.state.image.width,
            height: this.state.image.height
          }}
        >
          <img src={this.state.image.dataUrl} ref={r => { this.$img = r }}/>
          {this.renderExistingImageAreas()}
          {this.renderCropArea()}
        </div>
        <div className="actions">
          <Button
            type="primary"
            size="large"
            className="save-button"
            onClick={this.onClickAnnotate}
          >
            {t('annotate')}
          </Button>
          <Button
            type="primary"
            size="large"
            className="create-bridge-button"
            onClick={this.onClickCreateBridge}
          >
            {t('createBridge')}
          </Button>
          {this.canBuildBridge() ? (
            <Button
              type="primary"
              size="large"
              className="build-bridge-button"
              onClick={this.onClickBuildBridge}
            >
              {t('buildBridge')}
            </Button>
          ) : null}
          {this.canUpdateElementInBridge() ? (
            <Button
              type="primary"
              size="large"
              className="update-element-in-bridge-button"
              onClick={this.onClickUpdateElementInBridge}
            >
              {t('updateElementForBridge')}
            </Button>
          ) : null}
          <Button
            type="danger"
            size="large"
            className="cancel-button"
            onClick={this.onClickCancel}
          >
            {t('cancel')}
          </Button>
        </div>
      </div>
    )
  }
}

export default translate(['common', 'selecteImageArea'])(App)
