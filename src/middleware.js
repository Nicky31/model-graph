import { normalize } from 'normalizr';

/*
 * Action struct: {
 *  callId: string,                         // Used by savePromise
 *  savePromise: bool,                      // Save & map promise to callId in order to avoid replaying this call
 *  autoGetter: {id: id},                   // Object containing entity's id to be returned if already fetched (for instance by a dependant entity)
 *  quickInsert : object,                   // Value to insert just after call & updated by async fetch result
 *  fetch: (dispatch, getState) => Promise,
 *  action: 'delete',                       // Optional, if deletion
 *  outputStore: string,                    // Name of store which has to recv datas
 *  updateLinkedModel: {type, id, field},   // Add result entity (must be single) id to a dependant model field
 *  endCallback: ({result, dispatch, getState}) => result // Callback triggered on call's end
 * }
 */

function reduxModelStoreMiddleware({ 
  dispatchAction='UPDATE_MODEL_STORE',
  datascheme
}) {
  datascheme.dispatchAction = storeName => {
      return {
        storeName,
        type: dispatchAction,
        store: datascheme.store(storeName).clone()
      }
  }


  return ({ dispatch, getState }) => next => async action => {
      if (typeof action !== 'object' || !action.fetch || !action.outputStore) {
        return next(action)
      }
      const requestBuilder = datascheme.request.bind(datascheme, action.outputStore)
      const request = requestBuilder()
      if (!request) {
        throw ({error: 'ReduxModelStore: unkown store ' + action.outputStore})
      }

    function fetchRequest({ fetch, action, groups, endCallback , replace }) {
      var request = requestBuilder()
      request.call(fetch, dispatch, getState)
      if  (action == 'delete') {
        request.delete()
      } else {
        request.store({ groups, replace })
      }
      if (endCallback) {
        request.call(endCallback, dispatch, getState)
      }
      return (
        request
        .call(result => {
          request.updatedStores.forEach(storeName => dispatch(datascheme.dispatchAction(storeName)))
          return result
        }).result
      )
    }

    function quickInsertRequest(action) {
      var request = requestBuilder()
      var objectId = Date.now()

      var quickInsert = { ...action.quickInsert, objectId }
      fetchRequest({ fetch: () => Promise.resolve(quickInsert), groups: action.groups })
      return fetchRequest({
        ...action,
        replace: objectId
      })      

    }

    /*
     * Action processing
     */

    // Return target data if already fetch
    if (action.autoGetter && action.autoGetter.id) {
      let data = await request.get(action.autoGetter.id).result
      if (data) {
        return Promise.resolve(data)
      }
    }

    // Return saved promise if any
    if (action.savePromise) {
      return request.savedCall({
        uniqId: action.callId,
        fn: () => fetchRequest(action)
      }).result
    }

    if (action.quickInsert) {
      return quickInsertRequest(action)
    }

    return fetchRequest(action)
  };
}

export default reduxModelStoreMiddleware