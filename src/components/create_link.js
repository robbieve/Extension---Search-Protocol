import React from 'react'
import PropTypes from 'prop-types'
import { Alert, Button, Select, Form, Input } from 'antd'
import { translate } from 'react-i18next'

import { ELEMENT_TYPE } from '../common/models/element_model'
import API from '../common/api/cs_api'
import './create_link.scss'
import log from '../common/log';
import * as C from '../common/constant'
import { compose, updateIn } from '../common/utils';
import { EDIT_BRIDGE_TARGET } from '../common/models/local_model';

class CreateLinkComp extends React.Component {
  static propTypes = {
    mode:           PropTypes.string.isRequired,
    bridge:         PropTypes.object,
    linkPair:       PropTypes.object,
    onUpdateField:  PropTypes.func.isRequired,
    onSubmit:       PropTypes.func.isRequired,
    onCancel:       PropTypes.func.isRequired
  }

  state = {
    relations: []
  }

  encodeData = (values) => {
    return updateIn(['relation'], x => parseInt(x, 10), values)
  }

  decodeData = (values) => {
    return updateIn(['relation'], x => x && ('' + x), values)
  }

  onSubmit = () => {
    this.props.form.validateFields((err, values) => {
      if (err)  return

      const pair = this.props.linkPair.data
      const data = {
        ...this.encodeData(values),
        from: pair.links[0],
        to:   pair.links[1]
      }

      this.props.onSubmit(data)
    })
  }

  componentDidMount () {
    API.loadRelations()
    .then(relations => {
      this.setState({ relations })
    })
    .catch(e => log.error(e))

    if (this.props.bridge) {
      setTimeout(() => {
        this.props.form.setFieldsValue(this.decodeData({
          desc:       this.props.bridge.desc,
          tags:       this.props.bridge.tags,
          relation:   this.props.bridge.relation
        }))
      }, 60)
    }
  }

  componentWillReceiveProps (nextProps) {
    if (nextProps.bridge && nextProps.bridge !== this.props.bridge) {
      this.props.form.setFieldsValue(this.decodeData({
        desc:       nextProps.bridge.desc,
        tags:       nextProps.bridge.tags,
        relation:   nextProps.bridge.relation
      }))
    }
  }

  renderLinkPreview (link, editBridgetTarget) {
    const { t, mode }   = this.props
    const renderDetail  = () => {
      switch (link.type) {
        case ELEMENT_TYPE.IMAGE:
        case ELEMENT_TYPE.SCREENSHOT:
          return (
            <div className="image-box">
              <img src={link.image} />
            </div>
          )

        case ELEMENT_TYPE.SELECTION:
          if (link.image) {
            return (
              <div className="image-box">
                <img src={link.image} />
              </div>
            )
          } else {
            return (
              <div className="text-box">
                {link.text}
              </div>
            )
          }
      }
    }

    return (
      <div className="element-box">
        {renderDetail()}
        {mode === C.UPSERT_MODE.EDIT ? (
          <div className="element-actions">
            <Button
              type="primary"
              onClick={() => {
                API.startEditBridge({
                  ...this.props.bridge,
                  from: this.props.bridge.fromElement,
                  to:   this.props.bridge.toElement
                }, editBridgetTarget)
                API.showElementInNewTab(link)
              }}
            >
              {t('buildBridge:update')}
            </Button>
          </div>
        ) : null}
      </div>
    )
  }

  renderTitle () {
    const { t } = this.props

    switch (this.props.mode) {
      case C.UPSERT_MODE.ADD:
        return t('buildBridge')

      case C.UPSERT_MODE.EDIT:
        return t('buildBridge:editBridge')
    }
  }

  render () {
    if (!this.props.linkPair) return null

    const { t } = this.props
    const { getFieldDecorator } = this.props.form
    const pair = this.props.linkPair.data

    if (!pair.links || !pair.links.length)  return null

    return (
      <div className="to-create-link">
        <h2>{this.renderTitle()}</h2>
        <Form onSubmit={this.handleSubmit} className="create-link-form">
          <Form.Item label={t('buildBridge:relationLabel')} className="relation-form-item">
            <div className="relationship-row">
              {this.renderLinkPreview(pair.links[0], EDIT_BRIDGE_TARGET.FROM)}

              <div>
                {getFieldDecorator('relation', {
                  ...(pair.relation ? { initialValue: '' + pair.relation } : {}),
                  rules: [
                    { required: true, message: t('buildBridge:relationErrMsg') }
                  ]
                })(
                  <Select
                    placeholder={t('buildBridge:relationPlaceholder')}
                    onChange={val => this.props.onUpdateField(parseInt(val, 10), 'relation')}
                  >
                    {this.state.relations.map(r => (
                      <Select.Option key={r.id} value={'' + r.id}>{r.active_name}</Select.Option>
                    ))}
                  </Select>
                )}
              </div>

              {this.renderLinkPreview(pair.links[1], EDIT_BRIDGE_TARGET.TO)}
            </div>
          </Form.Item>

          <Form.Item label={t('buildBridge:descLabel')} className="desc-form-item">
            {getFieldDecorator('desc', {
              initialValue: pair.desc,
              validateTrigger: ['onBlur'],
              rules: [
                { required: true, message: t('buildBridge:descErrMsg') }
              ]
            })(
              <Input.TextArea
                placeholder={t('buildBridge:descPlaceholder')}
                onChange={e => this.props.onUpdateField(e.target.value, 'desc')}
              />
            )}
          </Form.Item>
          <Form.Item label={t('tags')}>
            {getFieldDecorator('tags', {
              initialValue: pair.tags,
              validateTrigger: ['onBlur'],
              rules: [
                {
                  required: true,
                  message: t('tagsRequiredErrMsg')
                },
                {
                  validator: (rule, value, callback) => {
                    const parts = (value || '').split(',')

                    if (parts.length > 5) {
                      const msg = t('tagsCountErrMsg')
                      return callback(msg)
                    }

                    callback()
                  }
                }
              ]
            })(
              <Input
                placeholder={t('tagsPlaceholder')}
                onChange={e => this.props.onUpdateField(e.target.value, 'tags')}
              />
            )}
          </Form.Item>
        </Form>

        <div className="actions">
          <Button
            type="primary"
            size="large"
            className="post-button"
            onClick={this.onSubmit}
          >
            {t('buildBridge:postIt')}
          </Button>
          <Button
            type="danger"
            size="large"
            className="cancel-button"
            onClick={this.props.onCancel}
          >
            {t('cancel')}
          </Button>
        </div>
      </div>
    )
  }
}

export default compose(
  Form.create(),
  translate(['common', 'buildBridge'])
)(CreateLinkComp)
