import React, { Component } from 'react'
import { Form, Input, Button } from 'antd'
import { translate } from 'react-i18next'
import { notifyError, notifySuccess } from '../components/notification'
import { compose } from '../common/utils'
import { ipcForIframe } from '../common/ipc/cs_postmessage'
import API from '../common/api/cs_iframe_api'
import log from '../common/log'
import './app.scss'

const ipc = ipcForIframe()

class App extends Component {
  state = {
    elementData: {},
    disableInputs: true
  }

  followUnFollowElement = (linkData) => {
    const { t } = this.props
    API.elementFollow({element_id: linkData.id})
    .then(() => {
      let successMessage = linkData.is_follow ? t('Successfully Unfollowed') : t('Successfully Followed')
      successMessage += ` element ${linkData.name}`
      notifySuccess(successMessage)
      ipc.ask('DONE')
      setTimeout(() => this.onClickCancel(), 3500)
    })
    .catch(e => {
      notifyError(e.message)
      setTimeout(() => this.onClickCancel(), 3500)
    })
    // notifySuccess(`${linkData.is_follow ? t('Successfully Unfollowed') : t('Successfully Followed')}`)
    // notifySuccess(`${t('elementDescription:successfullyFollowed')} ${linkData.name}`)
  }
 componentDidMount () {
  ipc.ask('INIT')
  .then(({linkData}) => {
    this.setState({
      elementData: linkData
    })
    console.log(linkData)
    if (linkData.name) {
      this.followUnFollowElement(linkData)
    } else {
      this.setState({
        disableInputs: false
      })
    }
    this.props.form.setFieldsValue({
      title: linkData.name,
      desc: linkData.desc || ''
    })
  })
 }
 onClickCancel = () => {
  ipc.ask('CLOSE')
}
 onClickSubmit = () => {
  const { elementData: linkData } = this.state
  this.props.form.validateFields((err, values) => {
    if (err)  return
    const { t } = this.props
    console.log('=====values entered====', values)
    let dataValues = {...values}
    dataValues.name = values.title
    dataValues.element_id = linkData.id

    API.createElementDescription(dataValues)
      .then(() => {
        notifySuccess(t('successfullySaved'))
        this.followUnFollowElement(linkData)
      })
      .catch(e => {
        notifyError(e.message)
        setTimeout(() => this.onClickCancel(), 1500)
      })
  });
}
onUpdateField = (val, key) => {
  this.setState({ [key]: val })
}
  render () {
    const { t } = this.props
    const { getFieldDecorator } = this.props.form
    const { elementData, disableInputs } = this.state
    return (
      <div className='element-wrapper'>
        <div className='element-image'>
          <img src={elementData.image} />
        </div>
        {!disableInputs && 
          <h3>
            {t('elementDescription:defineElementBeforeFollow')}
          </h3>
        }
        <Form>
          <Form.Item label={t('elementDescription:titleLabel')}>
            {getFieldDecorator('title', {
              validateTrigger: ['onBlur'],
              rules: [
                { required: true, message: t('elementDescription:titleErrMsg') }
              ]
            })(
              <Input
                placeholder={t('elementDescription:titlePlaceholder')}
                onChange={e => this.onUpdateField(e.target.value, 'title')}
                disabled={disableInputs}
              />
            )}
          </Form.Item>
          <Form.Item label={t('elementDescription:descLabel')}>
            {getFieldDecorator('desc', {
              validateTrigger: ['onBlur'],
              rules: [
                { required: true, message: t('elementDescription:descErrMsg') }
              ]
            })(
              <Input.TextArea
                rows={4}
                placeholder={t('elementDescription:descPlaceholder')}
                onChange={e => this.onUpdateField(e.target.value, 'desc')}
                disabled={disableInputs}
              />
            )}
          </Form.Item>
          <div className="actions">
            <Button
              type="primary"
              size="large"
              className="save-button"
              disabled={disableInputs}
              onClick={this.onClickSubmit}
            >
              {t('save')}
            </Button>
            <Button
              type="danger"
              size="large"
              className="cancel-button"
              onClick={this.onClickCancel}
            >
              {t('cancel')}
            </Button>
          </div>
        </Form>
      </div>
    )
  }
}

export default compose(
  Form.create(),
  translate(['common', 'elementDescription'])
)(App)
