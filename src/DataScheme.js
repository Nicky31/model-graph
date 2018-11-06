import {schema, normalize} from 'normalizr';
import DataStore from './DataStore';
import ModelRequest from './ModelRequest';

export default function DataScheme(models, args = {}) {
  var self = this;
  this.savedCalls = {};
  this.models = {};
  // Details model attributes to be filled on linked models instantiation
  // Keys are model names, values are list of models with attribute to
  // autofill with first model
  this.autolinks = {};

  function EntityModel(name) {
    var normalizrEntityParams = args.normalizrEntityParams || {};
    if (!normalizrEntityParams.idAttribute) {
      normalizrEntityParams.idAttribute = args.idAttribute || 'id';
    }
    schema.Entity.call(this, name, {}, normalizrEntityParams);

    /*
   * Overload of normalizr.Entity
   * 2nd new 'autolinks' parameter allows any linked attribute to be
   * filled whenever the linked model is instantiated with a
   * matching attribute
   */
    this.define = function(links, autolinks = {}) {
      Object.getPrototypeOf(this).define.call(this, links);

      let dependencies = Object.entries(this.schema);
      this.dependencies = dependencies
        // force array conversion if single dependance
        .map(dep => (Array.isArray(dep[1]) ? dep[1][0] : dep[1]))
        .reduce((allDeps, depModel, idx) => {
          allDeps[dependencies[idx][0]] = depModel._key;
          return allDeps;
        }, {});

      Object.keys(autolinks).forEach(attr => {
        if (!(attr in this.dependencies)) {
          throw new Error({
            error: `Model ${
              this._key
            } : Trying to set attribute ${attr} which does not correspond to any
            model dependency as an autolink.`,
          });
        }
        let dep = this.dependencies[attr];
        if (!(dep in self.autolinks)) {
          self.autolinks[dep] = [];
        }
        self.autolinks[dep].push({
          linkedModel: this._key,
          linkedAttr: attr,
          via: autolinks[attr].via, // Corresponds to 'dep' model attribute
        });
      });
    };
  }

  EntityModel.prototype = Object.create(schema.Entity.prototype);
  EntityModel.prototype.constructor = EntityModel;

  // Getters
  this.model = name => {
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

  // Normalize input data based on given model
  this.normalize = (datas, model) => {
    if (Array.isArray(datas)) {
      model = [model];
    }
    var ret = normalize(datas, model);
    return ret;
  };

  // Models helpers : need 'this' to point a valid model
  function _populate(stores) {
    var clone = Object.assign(Object.create(Object.getPrototypeOf(this)), this);
    var modelDependencies = self.models[this._key].model.dependencies;
    for (let attr in modelDependencies) {
      if (attr in clone && clone[attr]) {
        clone[attr] = stores[modelDependencies[attr]].get(clone[attr]);
      }
    }
    return clone;
  }

  // Define a new model with its associated store
  this.define = (name, opts = {}) => {
    var proto = opts.proto || {};
    Object.defineProperty(proto, '_populate', {value: _populate});
    Object.defineProperty(proto, '_key', {value: name});

    var model = new EntityModel(name);

    this.models[name] = {
      model,
      store: new DataStore({
        ...opts,
        idAttribute: model.idAttribute,
        proto,
      }),
      Request: null,
      opts,
    };
    this.models[name].Request = ModelRequest(this)(name);
    return this;
  };

  // Init
  for (let name in models) {
    this.define(
      name,
      typeof models[name] === 'object' ? models[name] : undefined
    );
  }
}
