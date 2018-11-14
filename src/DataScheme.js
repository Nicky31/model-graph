import {schema, normalize} from 'normalizr';
import DataStore from './DataStore';
import ModelRequest from './ModelRequest';

export default function DataScheme(models, args = {}) {
  var self = this;
  this.savedCalls = {};
  this.models = {};
  // Details model attributes to be filled on linked models instantiation
  // Keys are model names, values are list of models with attribute that
  // may be autofilled from first model instantiation
  this.autolinks = {};

  function EntityModel(name, opts = {}) {
    this.idAttribute = opts.idAttribute || 'id'
    this.normalizr = new schema.Entity(name, {}, {
      idAttribute: this.idAttribute,
      ...(opts.normalizrEntityParams || {})
    })
    this.name = name
    this.dependencies = {}
    this.proto = {}

    this.link = function(attr, linkedModel, opts = {}) {
      var modelName = ''
      // Give normalizr entity the information of linked model
      if (Array.isArray(linkedModel)) {
        this.normalizr.define({[attr]: linkedModel.map(cur => cur.normalizr)})
        modelName = linkedModel[0].name
      } else {
        this.normalizr.define({[attr]: linkedModel.normalizr})
        modelName = linkedModel.name
      }

      this.dependencies[attr] = {
        model: linkedModel
      }

      // 'via' autolinks
      if (opts.via) {
        if (!opts.via.attr) {
          throw new Error({error: 'model-graph \'via\' option of entity.link() at least needs \'attr\' attribute.'})
        }
        if (!(linkedModel in self.autolinks)) {
          self.autolinks[linkedModel] = []
        }
        self.autolinks[linkedModel].push({
          linkedModel: name,
          linkedAttr: attr,
          via: opts.via.attr, // Corresponds to linkedModel attribute (which have to points current model id)
        });        
      }

      return this
    }

    this.normalize = function(datas) {
      var model = this.normalizr
      if (Array.isArray(datas)) {
        model = [model];
      }
      var ret = normalize(datas, model);
      return ret;
    }
  }

  // Define a new model with its associated store
  this.define = (name, opts) => {
    var proto = opts.proto || {};
    Object.defineProperty(proto, '_populate', {value: _populate});
    Object.defineProperty(proto, '_model', {value: name});

    var model = new EntityModel(name, {
      idAttribute: opts.idAttribute || args.idAttribute
    });
    model.proto = proto

    this.models[name] = {
      model,
      store: new DataStore(model, opts),
      Request: null,
      opts,
    };
    this.models[name].Request = ModelRequest(this)(name);
    return this;    
  }


  // Getters
  this.model = name => {
    if (!(name in this.models)) {
      throw new Error({error: `model-graph: try to get unknown '${name}' model`})
    }
    return this.models[name] && this.models[name].model;
  };
  this.store = name => {
    return this.models[name] && this.models[name].store;
  };
  this.request = name => {
    return this.models[name] && new this.models[name].Request();
  };

  this.allStores = () =>
    Object.keys(this.models).reduce((stores, curName) => {
      stores[curName] = this.store(curName);
      return stores;
    }, {});

  // Returns saved call corresponding to given id
  this.saveCall = (callId, result, running) => {
    this.savedCalls[callId] = {
      result: result,
      running,
      time: new Date(),
    };
    return result;
  };

  this.savedCall = callId => {
    return this.savedCalls[callId];
  };

  this.isRunningCall = callId => {
    return this.savedCalls[callId] && this.savedCalls[callId].running;
  };

  // Models helpers : need 'this' to point a valid entity
  function _populate(stores) {
    var clone = Object.assign(Object.create(Object.getPrototypeOf(this)), this);
    var modelDependencies = self.models[this._model].model.dependencies;
    for (let attr in modelDependencies) {
      if (attr in clone && clone[attr]) {
        clone[attr] = stores[modelDependencies[attr].model].get(clone[attr]);
      }
    }
    return clone;
  }

  // Init
  for (let name in models) {
    this.define(
      name,
      typeof models[name] === 'object' ? models[name] : undefined
    );
  }
}
