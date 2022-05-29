// #region 向上找到第一个 overflow 为 scroll 或 auto 的父节点
export function findScrollableParent (el) {
  let parent = el
  while (parent) {
    if (parent === document.body || parent === document.documentElement) {
      break
    }
    if (!parent.parentNode) {
      break
    }
    // 向上找到第一个 overflow 为 scroll 或 auto 的父节点
    const curElStyle = getComputedStyle(el)
    if (
      (/(scroll|auto)/).test(curElStyle.getPropertyValue('overflow')) ||
      (/(scroll|auto)/).test(curElStyle.getPropertyValue('overflow-x')) ||
      (/(scroll|auto)/).test(curElStyle.getPropertyValue('overflow-y'))
    ) {
      return parent
    }

    parent = parent.parentNode
  }
  return window
}
// #endregion 向上找到第一个 overflow 为 scroll 或 auto 的父节点

// #region 检查 IntersectionObserver 兼容性
const inBrowser = typeof window !== 'undefined'
function checkIntersectionObserver () {
  if (inBrowser &&
    'IntersectionObserver' in window &&
    'IntersectionObserverEntry' in window &&
    'intersectionRatio' in IntersectionObserverEntry.prototype) {
    // Minimal polyfill for Edge 15's lack of `isIntersecting`
    // See: https://github.com/w3c/IntersectionObserver/issues/211
    if (!('isIntersecting' in IntersectionObserverEntry.prototype)) {
      Object.defineProperty(IntersectionObserverEntry.prototype,
        'isIntersecting', {
          get: function () {
            return this.intersectionRatio > 0
          }
        })
    }
    return true
  }
  return false
}
export const hasIntersectionObserver = checkIntersectionObserver()
// #endregion 检查 IntersectionObserver 兼容性

// #region 节流
export function throttle (fn, delay) {
  let timeoutId = 0
  let lastRun = 0
  function wrapper (...args) {
    if (timeoutId > 0) {
      return
    }
    const self = this
    const pastTimeSinceLastRun = Date.now() - lastRun
    const runFn = function () {
      lastRun = Date.now()
      timeoutId = 0
      fn.apply(self, args)
    }
    if (pastTimeSinceLastRun >= delay) {
      runFn()
    } else {
      timeoutId = window.setTimeout(runFn, delay)
    }
  }
  return wrapper
}
// #endregion 节流
