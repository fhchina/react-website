import React, { Component } from 'react'
import hoistNonReactStatics from 'hoist-non-react-statics'

import { get_display_name } from '../../utility'

export const PRELOAD_METHOD_NAME  = '__preload__'
export const PRELOAD_OPTIONS_NAME = '__preload_options__'

// `@preload(preloader, [options])` decorator.
//
// `preloader` function must return a `Promise` (or be `async`):
//
// `function preloader({ dispatch, getState, location, parameters, server })`.
//
// The decorator also receives an optional `options` argument (advanced topic):
//
// * `blocking` — If `false` then all child `<Route/>`'s  `@preload()`s will not
//                wait for this `@preload()` to finish in order to get executed
//                (is `true` by default).
//
// * `blockingSibling` — If `true` then all further adjacent (sibling) `@preload()`s
//                       for the same `<Route/>`'s component will wait for this
//                       `@preload()` to finish in order to get executed.
//                       (is `true` by default).
//
// * `client`   — If `true` then the `@preload()` will be executed only on client side.
//                Otherwise the `@preload()` will be executed normally:
//                if part of initial page preloading then on server side and
//                if part of subsequent preloading (e.g. navigation) then on client side.
//
// * `server`   — If `true` then the `@preload()` will be executed only on server side.
//                Otherwise the `@preload()` will be executed normally:
//                if part of initial page preloading then on server side and
//                if part of subsequent preloading (e.g. navigation) then on client side.
//
export default function preload(preload, options)
{
	return function(DecoratedComponent) {
		class PreloadedComponent extends Component {
			render() {
				return <DecoratedComponent {...this.props} />
			}
		}

		// Since there can be several `@preload()`s
		// on a single component, using arrays here.
		PreloadedComponent[PRELOAD_METHOD_NAME]  = DecoratedComponent[PRELOAD_METHOD_NAME]  || []
		PreloadedComponent[PRELOAD_OPTIONS_NAME] = DecoratedComponent[PRELOAD_OPTIONS_NAME] || []

		PreloadedComponent[PRELOAD_METHOD_NAME].unshift(preload)
		PreloadedComponent[PRELOAD_OPTIONS_NAME].unshift({
			blocking: true,
			blockingSibling: true,
			...options
		})

		// Component naming for React DevTools
		PreloadedComponent.displayName = `Preloaded(${get_display_name(DecoratedComponent)})`

		// Keep all non-React-specific static methods
		return hoistNonReactStatics(PreloadedComponent, DecoratedComponent)
	}
}