import modelGraphReduxMiddleware from './middleware';

export function reduxMiddleware(params) {
  if (!params.datascheme) {
    throw new Error({error: 'Missing model-graph datascheme'});
  }
  return modelGraphReduxMiddleware(params);
}

export { default as DataScheme } from './DataScheme.js';

export { default as DataStore } from './DataStore';

export { default as requestBuilder } from './ModelRequest';
