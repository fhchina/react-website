import React from 'react'
import ReactDOM from 'react-dom'

import clientSideRender from '../../client/render'
import render from './render'
import createHttpClient from '../HttpClient'
import normalizeSettings from '../normalize'
import createStore from '../store'
import { resetInstantBack } from './instantBack'
import { getLocationUrl } from '../../location'
import { convertRoutes } from '../../router'
import { createHistoryProtocol } from '../../router/client'
import { redirect, _RESOLVE_MATCH } from '../../router'

// This function is what's gonna be called from the project's code on the client-side.
//
// There are two passes of client-side render happening here.
// React has the concept of "re-hydration" which demands that
// the initial client-side React rendering results be equal to
// the server-side React rendering results, character-by-character.
// Otherwise it complains.
// That's the reason why the application on client side first performs
// a "dummy" rendering without resolving any `@preload`s, just to complete
// the React "hydration" process, and only when the "hydration" process finishes
// does it perform the second pass of rendering the page,
// now resolving all client-side `@preload`s.
// Therefore, the first pass of `.render()` always happens with data missing
// if that data is loaded in "client-side only" `@preload`s.
// (that is, the `@preload`s configured with `{ client: true }`).
//
// If React "re-hydration" step didn't exist
// then the library would first execute all client-side preloads
// and only then would it render the application.
// That would be more intuitive and convenient for developers I guess.
//
export default function setUpAndRender(settings, options = {}) {

	settings = normalizeSettings(settings)

	const {
		devtools,
		stats,
		onNavigate,
		onStoreCreated
	} = options

	// Redux store.
	let store

	// Create HTTP client (Redux action creator `http` utility)
	const httpClient = createHttpClient(settings, () => store)
	// E.g. for WebSocket message handlers, since they only run on the client side.
	window._react_website_http_client = httpClient

	// Reset "instant back" on page reload
	// since Redux state is cleared.
	// "instant back" chain is stored in `window.sessionStorage`
	// and therefore it survives page reload.
	resetInstantBack()

	// The first pass of initial client-side render
	// is to render the markup which matches server-side one.
	// The second pass will be to render after resolving `getData`.
	if (window._server_side_render) {
		window._react_website_initial_prerender = true
		window._react_website_skip_preload = true
	}

	// Create Redux store
	store = createStore(settings, getState(true), createHistoryProtocol, httpClient, {
		devtools,
		stats,
		onNavigate
	})

	// `onStoreCreated(store)` is called here.
	//
	// For example, client-side-only applications
	// may capture this `store` as `window.store`
	// to call `bindActionCreators()` for all actions (globally).
	//
	// onStoreCreated: store => window.store = store
	//
	// import { bindActionCreators } from 'redux'
	// import actionCreators from './actions'
	// const boundActionCreators = bindActionCreators(actionCreators, window.store.dispatch)
	// export default boundActionCreators
	//
	// Not saying that this is even a "good" practice,
	// more like "legacy code", but still my employer
	// happened to have such binding, so I added this feature.
  // Still this technique cuts down on a lot of redundant "wiring" code.
  //
	if (onStoreCreated) {
		onStoreCreated(store)
	}

	// Render the page.
	// If it's a server-side rendering case then that will be the
	// first pass, without preloading data, just for `React.hydrate()`.
	// If it's a client-side rendering case then that will be the
	// first pass with preloading data.
	return clientSideRender({
		container: settings.container,
		render,
		renderParameters: {
			store
		}
	})
	.then((result) => {
		// Perform the second pass of initial client-side rendering.
		// The second pass resolves `getData` on `<Route/>`s.
		// (which means it resolves all client-side `@preload()`s)
		if (window._server_side_render) {
			store.dispatch(redirect(document.location))
		} else {
			// `RESOLVE_MATCH` is not being dispatched
			// for the first render for some reason.
			// https://github.com/4Catalyzer/found/issues/202
			// With server-side rendering enabled
			// initially there are two rendering passes
			// and therefore `RESOLVE_MATCH` does get dispatched
			// after the page is initialized and rendered.
			// With server-side rendering disabled
			// `RESOLVE_MATCH` does not get dispatched
			// therefore a custom `_RESOLVE_MATCH` event is
			// dispatched manually.
			store.dispatch({
				type: _RESOLVE_MATCH,
				payload: window._react_website_update_match_payload
			})
		}
		return result
	})
}

// Gets Redux store state before "rehydration".
// In case someone needs to somehow modify
// Redux state before client-side render.
// (because the variable could be potentially renamed in future)
export function getState(erase) {
	const state = window._redux_state
	if (erase) {
		delete window._redux_state
	}
	return state
}

// Returns `http` utility on client side.
// Can be used in WebSocket message handlers,
// since they only run on the client side.
export function getHttpClient() {
	return window._react_website_http_client
}