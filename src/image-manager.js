export const IMAGE_STATE = {
  loading: 'loading',
  loaded: 'loaded',
  error: 'error'
}

export default class ImageManager {
  constructor ({
    el,
    parent,
    src,
    loading,
    error,
    cachedImageSet
  }) {
    // 指令挂载的元素
    this.el = el
    // el 的第一个可滚动父元素
    this.parent = parent
    // img 的 src
    this.src = src
    // 出错时使用的图片
    this.error = error
    // 加载时使用的图片
    this.loading = loading
    // 记录已加载被缓存的图片 src
    this.cachedImageSet = cachedImageSet
    // 图片加载状态
    this.state = IMAGE_STATE.loading

    // 先将图片渲染为 loading
    this.showImage(this.loading)
  }

  /**
   * @public
   * @returns {boolean} 当前图片是否出现在视图中
   */
  isInView () {
    const rect = this.el.getBoundingClientRect()
    // rect.top 表示 el 到视图顶部的距离，window.innerHeight 表示浏览器窗口的高度，top 大于 innerHeight 表示该元素在下面需要滚动才能看到
    // rect.left 表示 el 到视图左边的距离，window.innerWidth 表示浏览器窗口的宽度，left 大于 innerWidth 表示该元素在右边需要滚动才能看到
    return rect.top < window.innerHeight && rect.left < window.innerWidth
  }

  /**
   * @public
   * 开始加载图片
   */
  load () {
    if (this.state !== IMAGE_STATE.loading) {
      return
    }
    if (this.cachedImageSet.has(this.src)) {
      // src 图片已加载被缓存过了，无需异步去获取图片
      this.state = IMAGE_STATE.loaded
      this.showImage(this.src)
      return
    }
    this.asyncLoadImage()
  }

  /**
   *
   * @param {string} newSrc 新的图片 src
   */
  updateSrc (newSrc) {
    if (newSrc !== this.src) {
      this.src = newSrc
      this.state = IMAGE_STATE.loading
      this.load()
    }
  }

  /**
   * @private
   * Promise 异步获取图片并显示
   */
  asyncLoadImage () {
    new Promise((resolve, reject) => {
      // 创建一个临时的图片 el 去获取图片，获取成功后该图片会被浏览器缓存下来，然后丢弃这个临时 el
      const tempImgEl = new Image()
      tempImgEl.onload = () => {
        resolve()
        clearElReference()
      }
      tempImgEl.onerror = (e) => {
        reject(e)
        clearElReference()
      }
      // 开始获取图片
      tempImgEl.src = this.src
      // 清除 el 的引用使其能被回收
      function clearElReference () {
        tempImgEl.onload = null
        tempImgEl.onerror = null
      }
    }).then(() => {
      this.state = IMAGE_STATE.loaded
      this.showImage(this.src)
      this.cachedImageSet.add(this.src)
    }).catch((e) => {
      this.state = IMAGE_STATE.error
      this.showImage(this.error)
      console.warn(`load failed with src image(${this.src}) and the error msg is ${e.message}`)
    })
  }

  /**
   * @private
   * 修改 el 的 src 属性使其显示图片
   * @param {string} src
   */
  showImage (src) {
    this.el.setAttribute('src', src)
  }
}
