&emsp;&emsp;黄轶老师在慕课上的音乐 APP 项目中用到了 vue3-lazy 这个库来实现图片懒加载，但课程中仅仅是直接使用它并没有提及原理，看了下它的代码不算复杂，所以自己照着重新实现了一次补充了注释，加深理解。  
vue3-lazy：<https://github.com/ustbhuangyi/vue3-lazy>  
我自己加了注释的：<https://github.com/xia0hj/vue-image-lazy-loader>  
初学者个人拙见，还请指教。  

# 1. 注册指令

```js
install (app: App, options: LazyOptions) {
    const lazy = new Lazy(options)

    app.directive('lazy', {
      mounted: lazy.add.bind(lazy),
      updated: lazy.update.bind(lazy),
      unmounted: lazy.update.bind(lazy)
    })
}
```

&emsp;&emsp;在 install 方法中先根据传入的 options 创建 Lazy 类对象，并注册 v-lazy 指令，mounted 钩子函数调用 Lazy 类的 add 方法，而 updated 和 unmounted 钩子都是调用 Lazy 的 update 方法。

# 2. Lazy 初始化

```js
  constructor (options: LazyOptions) {
    this.error = options.error || DEFAULT_URL
    this.loading = options.loading || DEFAULT_URL

    this.cache = new Set()
    this.managerQueue = []
    this.throttleLazyHandler = throttle(this.lazyHandler.bind(this), THROTTLE_DELAY)

    this.init()
  }

private init (): void {
    if (hasIntersectionObserver) {
      this.initIntersectionObserver()
    } else {
      this.targetQueue = []
    }
}
```

接着来看看 Lazy 类的构造函数做了什么
1. loading、error：加载中和出错时要显示的图片，如果不传入这些参数就会使用默认的图片
2. cache：一个保存图片 src 字符串的 Set，如果某图片已加载过被浏览器缓存了，那么就不需要再去异步获取该图片了
3. managerQueue：每张需要懒加载的图片都被封装成 ImageManager，用一个数组保存所有的 ImageManager 实例
4. throttleLazyHandler：lazyHandler() 方法会在发生滚动事件时执行的回调函数，由于滚动事件触发非常频繁，该方法经过节流处理，0.3 秒内只能触发一次。
5. observer：如果浏览器支持 IntersectionObserver，则选择用 observer 保存创建的 IntersectionObserver 对象
5. targetQueue：如果选择通过监听滚动事件来判断图片是否出现在视图中，那就将被监听的元素存放在这个数组中；数组存放对象 {el: DOM元素，ref: 该元素被监听计数 }，如果多张图片需要监听同一个元素，那就增加 ref 计数避免重复保存

# 3. mounted 钩子

```js
  add (el: HTMLElement, binding: DirectiveBinding): void {
    const src = binding.value
    const parent = scrollParent(el)

    const manager = new ImageManager({
      el,
      parent,
      src,
      error: this.error,
      loading: this.loading,
      cache: this.cache
    })

    this.managerQueue.push(manager)

    if (hasIntersectionObserver) {
      this.observer!.observe(el)
    } else {
      this.addListenerTarget(parent)
      this.addListenerTarget(window)
      this.throttleLazyHandler()
    }
}
```

1. 在 mounted 时，首先是通过 scrollParent() 方法从当前元素开始，逐级向上获取 parentNode，直至找到第一个样式 overflow、overflow-x、overflow-y 的属性值是 scroll 或 auto 的父元素，兜底返回 window 对象
2. 为该图片创建一个 ImageManager 对象并放入 managerQueue 数组
3. 如果支持 IntersectionObserver，那就 observer 当前元素
4. 不支持 IntersectionObserver，那就监听 parent 和 window 的滚动事件，并执行一次检查所有图片可见性

# 4. 监听 DOM 的滚动事件

```js
  private addListenerTarget (el: HTMLElement | Window): void {
    let target = this.targetQueue!.find((target) => {
      return target.el === el
    })

    if (!target) {
      target = {
        el,
        ref: 1
      }
      this.targetQueue!.push(target)
      this.addListener(el)
    } else {
      target.ref++
    }
  }
  
  const events = ['scroll', 'wheel', 'mousewheel', 'resize', 'animationend', 'transitionend', 'touchmove', 'transitioncancel']
  
  private addListener (el: HTMLElement | Window): void {
    events.forEach((event) => {
      el.addEventListener(event, this.throttleLazyHandler as EventListenerOrEventListenerObject, {
        passive: true,
        capture: false
      })
    })
  }
```

&emsp;&emsp;如果要监听的元素已存在 targetQueue 中，则增加该元素的 ref 计数；不存在就设 ref 计数为 1 并加入 targetQueue，然后要为元素添加 events 数组中列举的事件监听，发生这些事件时调用 lazyHandler 检查所有图片的可见性。

# 5. lazyHandler

```js
  private lazyHandler (e: Event): void {
    for (let i = this.managerQueue.length - 1; i >= 0; i--) {
      const manager = this.managerQueue[i]
      if (manager.isInView()) {
        if (manager.state === State.loaded) {
          this.removeManager(manager)
          return
        }
        manager.load()
      }
    }
  }

  private removeManager (manager: ImageManager): void {
    const index = this.managerQueue.indexOf(manager)
    if (index > -1) {
      this.managerQueue.splice(index, 1)
    }
    if (this.observer) {
      this.observer.unobserve(manager.el)
    } else {
      this.removeListenerTarget(manager.parent)
      this.removeListenerTarget(window)
    }
  }
  
  private removeListenerTarget (el: HTMLElement | Window): void {
    this.targetQueue!.some((target, index) => {
      if (el === target.el) {
        target.ref--
        if (!target.ref) {
          this.removeListener(el)
          this.targetQueue!.splice(index, 1)
        }
        return true
      }
      return false
    })
  }
```

1. 遍历 managerQueue 判断图片是否在视图中出现，如果出现了需要调用 manager 的 load() 方法去加载真正的图片；
2. 对于已经加载完成的图片将其移出 managerQueue，如果该图片监听了其他元素的滚动事件也要移除，将被监听 target 的引用计数 ref 减 1，如果计数是 0 就移出 targetQueue

# 6. IntersectionObserver 的回调函数

```js
  private initIntersectionObserver (): void {
    this.observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const manager = this.managerQueue.find((manager) => {
            return manager.el === entry.target
          })
          if (manager) {
            if (manager.state === State.loaded) {
              this.removeManager(manager)
              return
            }
            manager.load()
          }
        }
      })
    }, {
      rootMargin: '0px',
      threshold: 0
    })
  }
```

1. 如果使用 IntersectionObserver，那就不需要监听元素的滚动事件了，回调函数的参数 entries 是一个数组，保存了可见性发生变化的 observer
2. entry.isIntersecting 表示可见，entry.target 保存的是图片元素，后面执行的逻辑与 lazyHandler 类似，都是从 managerQueue 中找出变为可见的图片，然后调用 ImageManager 的方法去加载真正的图片。
3. 加载完成的图片后不需要再 observe 它了，调用 IntersectionObserver 的 unobserve() 方法取消

# 7. ImageManager

## 7.1. 构造函数

```js
  constructor (options: ImageManagerOptions) {
    this.el = options.el
    this.parent = options.parent
    this.src = options.src
    this.error = options.error
    this.loading = options.loading
    this.cache = options.cache
    this.state = State.loading

    this.render(this.loading)
  }
```

1. 图片的 State 分为三种：loading（未加载原本的图片）、loaded（原本的图片已显示）、error（获取原本的图片时出错）；初始化为 loading 状态。
2. 构造函数中会通过 this.render() 先将元素的 src 设为 loading。

## 7.2. 判断图片可见性

```js
  isInView (): boolean {
    const rect = this.el.getBoundingClientRect()
    return rect.top < window.innerHeight && rect.left < window.innerWidth
  }
```

&emsp;&emsp;通过 getBoundingClientRect() 方法获取元素相对于视图的位置，top 表示元素离视图顶部的距离，
window.innerHeight 表示视图的高度，假如 top 大于 innerHeight 就表示元素在视图的下面，需要向下滚动才能看到；left 和 innerWidth 同理。

## 7.3. 加载原本的图片

```js
  load (next?: Function): void {
    if (this.state > State.loading) {
      return
    }
    if (this.cache.has(this.src)) {
      this.state = State.loaded
      this.render(this.src)
      return
    }
    this.renderSrc(next)
  }
  
  private renderSrc (): void {
    loadImage(this.src).then(() => {
      this.state = State.loaded
      this.render(this.src)
      this.cache.add(this.src)
    }).catch((e) => {
      this.state = State.error
      this.render(this.error)
      warn(`load failed with src image(${this.src}) and the error msg is ${e.message}`)
    })
  }
  
export default function loadImage (src: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const image = new Image()

    image.onload = function () {
      resolve()
      dispose()
    }

    image.onerror = function (e) {
      reject(e)
      dispose()
    }

    image.src = src

    function dispose () {
      image.onload = image.onerror = null
    }
  })
}
  
```

1. load() 在图片可见且 state=loading 的情况会加载真正的图片，会先检查要加载的图片 src 是否已在缓存 this.cache 中，如果在就表示该图片已被浏览器缓存，可以直接同步加载该图片。
2. renderSrc() 在图片未被浏览器缓存时调用，会异步获取图片；成功获取图片后会记录到 this.cache 中
3. loadImage() 先创建一个临时的 img 标签并设定 src，这样会去请求获取图片，虽然这个临时 img 没有显示在页面上，但只要成功获取就会缓存到浏览器中，不论获取图片是否成功，之后都要重置临时 img 的 onload 和 onerror 回调函数为 null 取消引用，使这个 img 可以被回收

# 8. updated 和 unmounted 钩子

```js
  update (el: HTMLElement, binding: DirectiveBinding): void {
    const src = binding.value
    const manager = this.managerQueue.find((manager) => {
      return manager.el === el
    })
    if (manager) {
      manager.update(src)
    }
  }

  update (src: string): void {
    const currentSrc = this.src
    if (src !== currentSrc) {
      this.src = src
      this.state = State.loading
      this.load()
    }
  }
```

&emsp;&emsp;找到元素对应的 imageManager，如果 src 发生了变化与原来的不相同，则直接加载新的图片，不会再等它在视图中出现