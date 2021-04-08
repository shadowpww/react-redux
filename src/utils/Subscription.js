import { getBatch } from './batch'

// encapsulates the subscription logic for connecting a component to the redux store, as
// well as nesting subscriptions of descendant components, so that we can ensure the
// ancestor components re-render before descendants

const nullListeners = { notify() {} }

//一个双向链表
function createListenerCollection() {
  const batch = getBatch()
  let first = null
  let last = null

  return {
    clear() {
      first = null
      last = null
    },

    notify() {
      batch(() => {
        let listener = first
        while (listener) {
          listener.callback()
          listener = listener.next
        }
      })
    },

    get() {
      let listeners = []
      let listener = first
      while (listener) {
        listeners.push(listener)
        listener = listener.next
      }
      return listeners
    },

    subscribe(callback) {
      let isSubscribed = true

      let listener = (last = {
        callback,
        next: null,
        prev: last,
      })

      if (listener.prev) {
        listener.prev.next = listener
      } else {
        first = listener
      }

      return function unsubscribe() {
        if (!isSubscribed || first === null) return
        isSubscribed = false

        if (listener.next) {
          listener.next.prev = listener.prev
        } else {
          last = listener.prev
        }
        if (listener.prev) {
          listener.prev.next = listener.next
        } else {
          first = listener.next
        }
      }
    },
  }
}

export default class Subscription {
  constructor(store, parentSub) {
    this.store = store
    this.parentSub = parentSub
    this.unsubscribe = null
    this.listeners = nullListeners

    this.handleChangeWrapper = this.handleChangeWrapper.bind(this)
  }
   
  //添加订阅函数
  addNestedSub(listener) {
    //尝试初始化Subscription对象
    this.trySubscribe()
    return this.listeners.subscribe(listener)
  }
 //执行listener队列
  notifyNestedSubs() {
    this.listeners.notify()
  }
 /* 对于 provide onStateChange 就是 notifyNestedSubs 方法，对于 connect 包裹接受更新的组件 ，onStateChange 就是 负责更新组件的函数 。   */
  handleChangeWrapper() {
    if (this.onStateChange) {
      this.onStateChange()
    }
  }
/* 判断有没有开启订阅 */
  isSubscribed() {
    return Boolean(this.unsubscribe)
  }

  trySubscribe() {
    //如果未进行初始化操作
    if (!this.unsubscribe) {
      //如果传入了parentSub，就将子Subscription对象的handleChangeWrapper添加到父Subscription的订阅函数队列中去。
      //这样子其实是会在父Subscription派发更新操作时，触发handleChangeWrapper函数。
      //最终会触发子Subscription对象上的listeners（订阅函数队列）的执行。
      this.unsubscribe = this.parentSub
        ? this.parentSub.addNestedSub(this.handleChangeWrapper)
        : this.store.subscribe(this.handleChangeWrapper)
      //创建用于存储订阅函数的队列。
      this.listeners = createListenerCollection()
    }
  }
 //取消订阅
  tryUnsubscribe() {
    if (this.unsubscribe) {
      this.unsubscribe()
      this.unsubscribe = null
      this.listeners.clear()
      this.listeners = nullListeners
    }
  }
}
