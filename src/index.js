import reduxModelStoreMiddleware from './middleware';

export function reduxMiddleware(params) {
    if (!params.datascheme) {
      throw {error: 'Missing ReduxModelStore datascheme'}
    }
	return reduxModelStoreMiddleware(params)
}

export const DataScheme = require('./DataScheme.js').default

export const DataStore = require('./DataStore.js').default

export const requestBuilder = require('./ModelRequest.js').default