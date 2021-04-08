import React, { useMemo } from 'react'
import PropTypes from 'prop-types'
import { ReactReduxContext } from './Context'
import Subscription from '../utils/Subscription'
import { useIsomorphicLayoutEffect } from '../utils/useIsomorphicLayoutEffect'

/**
 *  Provider所做的工作。
 * 1.创建一个ContextValue，这里的context会优先使用Provider props上的context对象。
 * 2.在创建ContextValue时，会去创建一个Subscription（根订阅器）。
 * 3.通过react 的context，把contextvalue传递给子孙组件。
 */
function Provider({ store, context, children }) {
  const contextValue = useMemo(() => {
    //创建一个store的根订阅器，
    const subscription = new Subscription(store)
    subscription.onStateChange = subscription.notifyNestedSubs
    return {
      store,
      subscription,
    }
    //每次store变化都会创建一个新的contextValue对象
  }, [store])

  /*  获取更新之前的state值，函数组件里面的上下文要优先于组件更新渲染，
  * TODO: 这里后面需要去弄明白为何这里是更新之前的state值
  */
  const previousState = useMemo(() => store.getState(), [store])

  useIsomorphicLayoutEffect(() => {
    const { subscription } = contextValue
    subscription.trySubscribe() //进行订阅操作。
    /** 发现组件更新后，前后的state不一致，此时需要去触发 subscription.notifyNestedSubs()来派发更新 */
    if (previousState !== store.getState()) {
      subscription.notifyNestedSubs()
    }
    return () => {
      //在每次组件重新更新时，需要去将旧的订阅器对象销毁。因为每次contextValue都会是一个新的对象
      subscription.tryUnsubscribe()
      subscription.onStateChange = null
    }
  }, [contextValue, previousState])
 /*  尝试使用传入的context对象，如果不存在则会创建一个context  ，这里的ReactReduxContext就是由createContext创建出的context */
  const Context = context || ReactReduxContext

  return <Context.Provider value={contextValue}>{children}</Context.Provider>
}

if (process.env.NODE_ENV !== 'production') {
  Provider.propTypes = {
    store: PropTypes.shape({
      subscribe: PropTypes.func.isRequired,
      dispatch: PropTypes.func.isRequired,
      getState: PropTypes.func.isRequired,
    }),
    context: PropTypes.object,
    children: PropTypes.any,
  }
}

export default Provider
