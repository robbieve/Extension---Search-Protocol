import React, { Component } from 'react'
import { Modal, Select, Form, Input, Button } from 'antd'
import { notifyError, notifySuccess } from '../components/notification'
import { ipcForIframe } from '../common/ipc/cs_postmessage'
import API from '../common/api/cs_iframe_api'
import './app.scss'

const ipc = ipcForIframe()

class App extends Component {
  state = {
    linkData: null
  }

  onClickSubmit = () => {
    this.props.form.validateFields((err, values) => {
      if (err)  return

      API.saveAnnotation({...this.state.linkData, ...values})
      .then(() => {
        notifySuccess('Successfully saved')
        setTimeout(() => this.onClickCancel(), 1500)
      })
      .catch(e => {
        notifyError(e.message)
      })
    })
  }

  onClickCancel = () => {
    ipc.ask('DID_SAVE')
    ipc.ask('CLOSE')
  }

  onUpdateField = (val, key) => {
    this.setState({ [key]: val })
  }

  componentDidMount () {
    ipc.ask('INIT')
    .then(linkData => {
      console.log('init got annotation', linkData)
      this.setState({ linkData })

      this.props.form.setFieldsValue({
        title:  linkData.title || '',
        desc:   linkData.desc || '',
        tags:   linkData.desc || ''
      })
    })
  }

  render () {
    const { getFieldDecorator } = this.props.form

    return (
      <div className="annotation-wrapper">
        <Form>
          <Form.Item label="Title">
            {getFieldDecorator('title', {
              validateTrigger: ['onBlur'],
              rules: [
                { required: true, message: 'Please input title' }
              ]
            })(
              <Input
                placeholder="Enter Title For This Content"
                onChange={e => this.onUpdateField(e.target.value, 'title')}
              />
            )}
          </Form.Item>
          <Form.Item label="Description">
            {getFieldDecorator('desc', {
              validateTrigger: ['onBlur'],
              rules: [
                { required: true, message: 'Please input description' }
              ]
            })(
              <Input.TextArea
                rows={4}
                placeholder="Enter Description For This Content"
                onChange={e => this.onUpdateField(e.target.value, 'desc')}
              />
            )}
          </Form.Item>
          <Form.Item label="Tags">
            {getFieldDecorator('tags', {
              validateTrigger: ['onBlur'],
              rules: [
                { required: true, message: 'Please input title' }
              ]
            })(
              <Input
                placeholder="Enter Title For This Content"
                onChange={e => this.onUpdateField(e.target.value, 'tags')}
              />
            )}
          </Form.Item>
          <div className="actions">
            <Button
              type="primary"
              size="large"
              className="save-button"
              onClick={this.onClickSubmit}
            >
              Save
            </Button>
            <Button
              type="danger"
              size="large"
              className="cancel-button"
              onClick={this.onClickCancel}
            >
              Cancel
            </Button>
          </div>
        </Form>
      </div>
    )
  }
}

export default Form.create()(App)
