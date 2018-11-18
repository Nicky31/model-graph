# model-store

Node js library allowing easy management of data stores respecting predefined models.

model-graph lets you build smart features on top of your request functions :

* update desired store with returned entity
* update any other linked stores if this entity has any linking attribute
* saved calls allow you to
    * keep trace of their last usage
    * synchronise 2 simultaneous same call with the same promise (instead of executing twice)
    * use one shot calls (unique instance over the entire program run)
* autogetters looks for a given entity id before executing request
* quick inserts update stores with your freshly created entity before running the request. Request return result updates this temporary entity, or deletes it on failure.
* models can be given a prototype to extend all of their entities features
* entity groups lets you organize entities in groups

## Installation
`npm --save i model-graph`


## API

### DataScheme
`import { DataScheme } from 'model-graph';`
Lets you define models and links.

#### new DataScheme(models: obj?, opts: obj?)
`models` may contain model names and their options (key / value)
`opts` may contain various DataScheme options.

DataScheme options :

* idAttribute : id attribute name, 'id' by default


#### void define(modelName: string, opts: obj?)
Creates a new `Model` identified by `modelName`, with `opts` options.
This is the same method called by constructor with each key / value pairs. Note that `modelName` will **also be the name of the corresponding `DataStore`**.

Model options :

* idAttribute : id attribute name, if different from DataScheme level
* proto : prototype object to be inherited by `modelName` entities

#### void linking(schemeFn: function)
Call schemeFn with an object containing every models as parameter, in order to link them in a more convenient way.

#### object allStores()
Returns every stores in a single object

#### DataStore store(name: string)
Returns `name` store

#### Model model(name: string)
Returns `name` model

#### ModelRequest request(name: string)
Prepares and returns a new request on `name` stores

#### object savedCall(callId: string)
Returns informations about `callId` saved call, or undefined if it does not exist yet.

#### bool isRunningCall(callId: string)
Returns if `callId` is currently running or not.


### Model
Template of a specific entity type, contains the few logic needed by datascheme declaration, should not be used outside this context.

`Model` should **never be instantiated directly** but only via `DataScheme` (constructor or define method), since it needs the enclosing `DataScheme` instance. 

#### curInstance link(attrName: string?, linkedModel: Model, opts: obj?)
Links this model to `linkedModel` through `attrName` attribute. If `attrName` is meant to be an array (containing every linked entities), `linkedModel` should be an array as well (only containing the proper `Model`).

When receiving an entity of such a linked model, model-graph tries to extract the linked entity from `attrName` to its owner `DataStore`, leaving only ids in `attrName`.

__Example :__
`
datascheme.model('todos').link('owner', datascheme.model('users'))
`

__link options : __

* via : object defining an **autolink** between the two models.
    * attr : indicates the remote model attribute name supposed to refer to an instance of current model.

With an autolink attribute, each `linkedModel` entity creation makes model-graph check if any entity of current model (referred by remote entity `via.attr` attribute) could have its `attrName` updated.

In short, this feature ensures that any incoming new entity would bind to their linked entities in a bidirectionnal way. 

__Example :__
`
datascheme.model('users').link('todos', [datascheme.model('todos')], {
  via: {
    attr: 'owner'
  }
})
`

Suppose we already have an user 5 (with an empty todos attr) and we receive `{objectId: 37, owner: 5, descr: "My awesome todo"}` :
the autolink would have user 5 `todos` attribute updated with `[37]` value 


### DataStore
Contains every entities of a specific model.
Should never be instantiated directly, since DataScheme already takes care of this in the same time a Model is defined.

#### array getArray()
Returns an array of every entities

#### obj get(id: string)
Return entity corresponding to `id`

#### array getGroup(group: string)
Returns an array of `group` entities

#### array|object update(entities: array|object, opts?)
Update this store with entities (can be a single entity or an array)
Always ensure that each entity still have its prototype.
Returns `entities`, but please not it may have been re-instantiated / altered (prototypes).

__update options :__
* groups : array of groups `entities` should be assigned at

#### void delete(id: string)
Delete entity `id` and clear groups accordingly

#### void deleteFromGrp(id: string, group: string)
Remove `id` entity from `group`

#### object replace(oldId: string, newEntity: object, opts?)
Replace `oldId` entity by `newEntity`. Essentially, means we insert `newEntity` at same position than `oldId`. 


### ModelRequest
Interface between your request functions and datascheme, implements an important part of model-graph features.
Built in a functionnal way such that most use cases will fit in one chained instruction (so every methods return current instance)
Note that every intermediates values and calls are always promised, so think about it when using it.
Requests have an attribute updatedStores (`Set` container) that lets you know which stores have been updated at any time, by `store` or `delete` methods.

Redux users should use the available middleware instead of directly `ModelRequest`.

#### construction
exported requestBuilder is a currying function that thake care of building the request with proper environment : datascheme object then desired store name.

```
import { requestBuilder } from 'model-graph';
// ... datascheme building
const schemeRequest = requestBuilder(datascheme);
const storeRequest = schemeRequest('users');
var myRequest = storeRequest().call(...)...
```

It is generally easier to build this from the datascheme :
`
var myRequest = datascheme.request('users').call(...)...
`

#### currentInstance get(id: string)
Get and save entity `id` (via DataStore.get)

#### currentInstance value(value: any)
Save value

#### currentInstance then(fn)
Shortcut of `currentInstance.result.then`, `currentInstance.result` being the current promise

#### currentInstance store(opts?)
Generally the last method called in the chain, updates the target store with the last computed value, and save the store's returned value (e.g prototype update)

This is where various link extractions are operated.

**store options :**
* value : any value to overwrite current one
* groups : an array of groups to be given to `DataStore.update`
* replace : entity id to `replace` instead of `update`

Updates `updatedStores`.

#### currentInstance call(fn: function, ...args)
As soon as current promise has resolved, call `fn` with current promise result as first parameter, before `args` additional parameters.

__Example :__
```
function likeThisUser(user) {
    return ({id: user.id, likes: [...user.likes, 0]})
}
datascheme.request('users')
    .get(5)
    .call(likeThisUser)
    .store()
    .then(updated => {
        console.log(updated.likes)
    })
```

#### currentInstance savedCall(params: object)
Same as `call`, except that we are saving this call with a given id.
Notifies DataScheme after both request beginning and ending (running true than false).

params:
* fn : required, the function to be executed
* callId : required, string identifying this call
* oneshot : true by default, prevents any other call `callId` execution, for the entire program running. If false, just prevent from 2 parallel executions. 
* params : Array of parameters to be given to `fn`, empty by default

#### currentInstance delete(id: string?)
If `id` is undefined, looks for it in `result.id` (where result is last computed value).
Then dispatch this deletion to `DataStore.delete`.

Updates `updatedStores` 