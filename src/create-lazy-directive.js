import { findScrollableParent, throttle, hasIntersectionObserver } from './helpers'
import ImageManager, { IMAGE_STATE } from './image-manager'

const DEFAULT_URL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
// 所有可能导致滚动让图片显示的事件
const SCROLL_EVENTS = ['scroll', 'wheel', 'mousewheel', 'resize', 'animationend', 'transitionend', 'touchmove', 'transitioncancel']
// 节流间隔，当滚动事件频繁触发时，0.3 秒内只允许检查一次图片的可见性
const THROTTLE_DELAY = 300

export default function (options) {
  // 加载中使用的默认图片
  const loading = options.loading || DEFAULT_URL
  // 出错时使用的默认图片
  const error = options.error || DEFAULT_URL
  // 记录已加载被缓存的图片 src
  const cachedImageSet = new Set()
  // ImageManager 图片队列
  const imageQueue = []

  // 要监听一些 dom 用于检查 img 是否在视图中出现，listeningDom = {dom, refCount}
  // 如果使用 IntersectionObserver，则不会初始化 queue
  let listeningQueue
  let observer

  console.debug(`vue-image-lazy-loader use IntersectionObserver = ${hasIntersectionObserver}`)

  if (hasIntersectionObserver) {
    observer = new IntersectionObserver((entries) => {
      // 回调函数会将可见性发生变化的 IntersectionObserver 作为数组返回
      entries.forEach((entry) => {
        // 目标元素的可见比例
        if (entry.intersectionRatio > 0) {
          const curImageManager = imageQueue.find((item) => { return item.el === entry.target })
          if (curImageManager) {
            if (curImageManager.state === IMAGE_STATE.loaded) {
              removeImage(curImageManager)
              return
            }
            curImageManager.load()
          }
        }
      })
    }, {
      rootMargin: '0px',
      threshold: 0 // 可见比例达到 0 时触发回调函数，例如设为 0.5 就表示有一半可见才回调
    })
  } else {
    listeningQueue = []
  }

  /**
   * 图片需要监听某些 dom 来检查自身是否在视图中出现；
   * 多张图片监听同一个 dom，则增加这个元素的引用计数
   * @param {*} dom 被监听的 dom
   */
  function queueListeningDom (dom) {
    const findEl = listeningQueue.find((item) => { return item.dom === dom })
    if (findEl) {
      findEl.refImgCount++
    } else {
      listeningQueue.push({
        dom: dom,
        refImgCount: 1
      })
      SCROLL_EVENTS.forEach((event) => {
        dom.addEventListener(event, checkImageManagerQueue, {
          once: false, // 是否单次监听，默认 false
          passive: true, // true = 忽略不执行 handler 中的 preventDefault()；默认 false
          capture: false // true = 事件由外向内触发；false = 事件从内向外冒泡；默认 false
        })
      })
    }
  }

  /**
   * 有一张图片加载完成，减少一次对 dom 的引用计数；
   * 如果 dom 已经没有被任何图片监听，则移除 dom 的事件监听，并移出 listeningQueue 队列。
   * @param {*} el 被图片监听的 dom
   */
  function removeListeningDom (el) {
    for (let i = 0; i < listeningQueue.length; i++) {
      if (listeningQueue[i].el === el) {
        listeningQueue[i].refImgCount--
        if (listeningQueue[i].refImgCount <= 0) {
          SCROLL_EVENTS.forEach((event) => {
            el.removeEventListener(event, checkImageManagerQueue)
          })
          listeningQueue.splice(i, 1)
        }
      }
    }
  }

  /**
   * 触发滚动事件时执行，遍历图片检查是否有图片在视图中，如果有就要加载；
   * 已做节流处理，每 0.3s 内只能执行一次遍历图片。
   */
  const checkImageManagerQueue = throttle(() => {
    // 倒序遍历 ImageManager 队列
    for (let i = imageQueue.length - 1; i >= 0; i--) {
      const curImageManager = imageQueue[i]
      if (curImageManager.isInView()) {
        if (curImageManager.state === IMAGE_STATE.loaded) {
          removeImage(curImageManager)
          return
        }
        curImageManager.load()
      }
    }
  }, THROTTLE_DELAY)

  /**
   * 有图片加载完成后，需要从 imageQueue 中移出，并移除该图片监听的 dom
   * @param {ImageManager} imageManager 加载完成的图片
   */
  function removeImage (imageManager) {
    // 从 imageQueue 中移出
    const index = imageQueue.indexOf(imageManager)
    if (index >= 0) {
      imageQueue.splice(index, 1)
    }
    if (hasIntersectionObserver) {
      observer.unobserve(imageManager.el)
    } else {
      // 移除该图片监听的 dom
      removeListeningDom(imageManager.parent)
      removeListeningDom(window)
    }
  }

  /**
   * v-lazy 指令挂载的 img 发生 updated 或者 unmounted 时调用
   */
  function afterElUpdated (el, binding) {
    const newSrc = binding.value
    // 找到 el 的图片
    const img = imageQueue.find((item) => {
      return item.el === el
    })
    if (img) {
      img.updateSrc(newSrc)
    }
  }

  return {
    // <img v-lazy="./pic1.jpg"/>
    // el=<img/> binding.value="./pic1.jpg"
    mounted (el, binding) {
      const src = binding.value
      const parent = findScrollableParent(el)
      imageQueue.push(new ImageManager({
        el,
        src,
        loading,
        error,
        cachedImageSet
      }))
      if (hasIntersectionObserver) {
        observer.observe(el)
      } else {
        queueListeningDom(parent)
        queueListeningDom(window)
        checkImageManagerQueue()
      }
    },
    updated: afterElUpdated,
    unmounted: afterElUpdated
  }
}
