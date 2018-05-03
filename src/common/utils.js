import throttle from 'lodash.throttle'

export const delay = (fn, timeout) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        resolve(fn())
      } catch (e) {
        reject(e)
      }
    }, timeout)
  })
}

export const until = (name, check, interval = 1000, expire = 10000) => {
  const start = new Date()
  const go    = () => {
    if (expire && new Date() - start >= expire) {
      throw new Error(`until: ${name} expired!`)
    }

    const { pass, result } = check()

    if (pass) return Promise.resolve(result)
    return delay(go, interval)
  }

  return new Promise((resolve, reject) => {
    try {
      resolve(go())
    } catch (e) {
      reject(e)
    }
  })
}

export const range = (start, end, step = 1) => {
  const ret = []

  for (let i = start; i < end; i += step) {
    ret.push(i)
  }

  return ret
}

export const partial = (fn) => {
  const len = fn.length
  let arbitary

  arbitary = (curArgs, leftArgCnt) => (...args) => {
    if (args.length >= leftArgCnt) {
      return fn.apply(null, curArgs.concat(args))
    }

    return arbitary(curArgs.concat(args), leftArgCnt - args.length)
  }

  return arbitary([], len)
}

export const reduceRight = (fn, initial, list) => {
  var ret = initial

  for (let i = list.length - 1; i >= 0; i--) {
    ret = fn(list[i], ret)
  }

  return ret
}

export const compose = (...args) => {
  return reduceRight((cur, prev) => {
    return x => cur(prev(x))
  }, x => x, args)
}

export const map = partial((fn, list) => {
  var result = []

  for (let i = 0, len = list.length; i < len; i++) {
    result.push(fn(list[i]))
  }

  return result
})

export const on = partial((key, fn, dict) => {
  if (Array.isArray(dict)) {
    return [
      ...dict.slice(0, key),
      fn(dict[key]),
      ...dict.slice(key + 1)
    ]
  }

  return Object.assign({}, dict, {
    [key]: fn(dict[key])
  })
})

export const updateIn = partial((keys, fn, obj) => {
  const updater = compose.apply(null, keys.map(key => on(key)))
  return updater(fn)(obj)
})

export const setIn = partial((keys, value, obj) => {
  const updater = compose.apply(null, keys.map(key => on(key)))
  return updater(() => value)(obj)
})

export const getIn = partial((keys, obj) => {
  return keys.reduce((prev, key) => {
    if (!prev)  return prev
    return prev[key]
  }, obj)
})

export const pick = (keys, obj) => {
  return keys.reduce((prev, key) => {
    prev[key] = obj[key]
    return prev
  }, {})
}

export const uid = () => {
  return '' + (new Date() * 1) + '.' +
         Math.floor(Math.random() * 10000000).toString(16)
}

export const flatten = (list) => {
  return [].concat.apply([], list);
}

export const without = (list1, list2) => {
  return list2.filter(item => list1.indexOf(item) === -1)
}

export const cn = (...list) => {
  return list.reduce((prev, cur) => {
    if (!cur) return prev
    if (typeof cur === 'string') {
      prev.push(cur)
    } else {
      Object.keys(cur).forEach(key => {
        if (cur[key]) prev.push(key)
      })
    }

    return prev
  }, []).join(' ')
}

export const and = (...list) => list.reduce((prev, cur) => prev && cur, true)

export const or = (...list) => list.reduce((prev, cur) => prev || cur, false)

export const liveBuild = ({ bindEvent, unbindEvent, getFuse, isEqual, onFuseChange, initial = true }) => {
  let fuse = initial ? getFuse() : null
  let api  = initial ? onFuseChange(fuse) : null

  const listener = throttle(e => {
    const newFuse = getFuse()
    if (isEqual(newFuse, fuse)) return

    fuse  = newFuse
    api   = onFuseChange(fuse, api)
  }, 200)

  bindEvent(listener)

  return {
    getAPI:   () => api,
    destroy:  () => {
      unbindEvent(listener)
    }
  }
}

// Note: rects here are all DOMRect
// will return a list of objects with top, left, width, height
export const reduceRects = (rects) => {
  const area = rect => rect.width * rect.height
  const isIn = (a, b) => {
    return b.top >= a.top && b.left >= a.left &&
            (b.top + b.height <= a.top + a.height) &&
            (b.left + b.width <= a.left + a.width)
  }
  const list = rects.slice()
  list.sort((a, b) => area(b) - area(a))

  return list.reduce((prev, cur) => {
    if (prev.find(bigger => isIn(bigger, cur))) return prev
    prev.push(cur)
    return prev
  }, [])
}
