import React from 'react'
import PropTypes from 'prop-types'
import './clamp_pre.scss'

class ClampPre extends React.Component {
  static propTypes = {
    lines: PropTypes.number,
    extraActions: PropTypes.node
  }

  static defaultProps = {
    lines: 3
  }

  state = {
    ready: false,
    needClamp: false,
    fold: false
  }

  toggleFold = () => {
    if(this.state.fold){
      this.props.onShowMore()
    }
    this.setState({
      fold: !this.state.fold
    })
  }

  componentDidMount () {
    setTimeout(() => this.calculate(), 100)
  }

  componentWillReceiveProps (nextProps) {
    if (nextProps.children !== this.props.children) {
      setTimeout(() => this.calculate(), 100)
    }
  }

  calculate () {
    const $pre = this.$pre
    $pre.style.display = 'block';

    const fullHeight = $pre.offsetHeight

    $pre.style.display  = '-webkit-box'
    const partialHeight = $pre.offsetHeight
    const needClamp     = fullHeight > partialHeight

    console.log('partial, full, needClamp', partialHeight, fullHeight, needClamp)

    $pre.removeAttribute('style')

    this.setState({
      needClamp,
      fold: needClamp,
      ready: true
    })
  }

  renderShowAllButton () {
    if (!this.state.ready) return null

    return (
      <div className="action-button" onClick={this.state.needClamp ? this.toggleFold : () => {}}>
        {this.state.needClamp ? (<span className="toggle-fold">{this.state.fold ? 'Show all ▼' : 'Hide ▲'}</span>) : null}
        {this.props.extraActions || null}
      </div>
    )
  }

  render () {
    const { needClamp, fold } = this.state

    return (
      <div
        className={'clamp-pre ' + (fold ? 'fold' : '')}
        style={{ visiblity: this.state.ready ? 'visible' : 'hidden' }}
      >
        <pre
          ref={ref => { this.$pre = ref }}
        >
          {this.props.children}
        </pre>
        {this.renderShowAllButton()}
      </div>
    )
  }
}

ClampPre.defaultProps = {
  onShowMore : () => {}
}
export default ClampPre
