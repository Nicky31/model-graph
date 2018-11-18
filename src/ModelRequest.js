export default function requestBuilder(datascheme) {
  return targetStore => {
    const store = datascheme.store(targetStore);
    const model = datascheme.model(targetStore);
    const idAttribute = model.idAttribute;
    // Implements differents handlers linking user input / methods to stores
    return function ModelRequest(input) {
      this.result = Promise.resolve(input);
      this.updatedStores = new Set();

      this.value = val => {
        this.result = Promise.resolve(val);
        return this;
      };

      this.get = id => {
        return this.value(store.get(id));
      };

      this.then = function(...args) {
        return this.result.then.call(this.result, ...args)
      }

      // Perform call, save their result and metadatas
      // If oneshot is false, fn can't be called twice at the same time,
      // but can be performed again as soon as previous call has ended
      // By default, fn will not ever be called more than 1 time
      this.savedCall = ({callId, oneshot = true, fn, params = []}) => {
        const saved = datascheme.savedCall(callId);
        // Return saved call only if oneshot is enabled OR call is still running
        if (saved && (oneshot || saved.running)) {
          return this.value(saved.result);
        }
        this.call(fn, params);
        datascheme.saveCall(callId, this.result, true);
        return this.call(result => datascheme.saveCall(callId, result, false));
      };

      this.call = (fn, ...args) => {
        this.result = new Promise((resolve, reject) => {
          this.result
            .catch(error => {
              reject(error);
            })
            .then(val => resolve(fn(val, ...args)));
        });
        return this;
      };

      this.delete = id => {
        return this.call(data => {
          id = (id || data.id)
          if (id === undefined) {
            return;
          }
          this.updatedStores.add(targetStore);
          return store.delete(id);
        });
      };

      // Given some entities and their modelName, look for any linked model
      // in other stores.
      // Update every found entities link attributes accordingly
      this.fillLinkedModelsWith = (entities, modelName) => {
        if (!(modelName in datascheme.autolinks)) {
          return;
        }
        // Can this model fill another one ?
        var autolinks = datascheme.autolinks[modelName];
        // Go through each of them
        autolinks.forEach(autolink => {
          const linkedStore = datascheme.store(autolink.linkedModel)
          const linkedModelIdAttr = linkedStore.model.idAttribute
          let updates = [] // link updates we will push to linkedStore

          // Get each of these entities that may fill remote entities of current autolink
          entities.forEach(entity => {
            const linkedId = typeof entity[autolink.via] === 'object'
              ? entity[autolink.via][linkedModelIdAttr]
              : entity[autolink.via];              
            const linkedEntity = linkedStore.get(linkedId)
            if (!linkedEntity ||
                !linkedStore.updateLinkField(linkedId, autolink.linkedAttr, entity[idAttribute])
            ) {
              return
            }
            this.updatedStores.add(autolink.linkedModel);
          })
        })
      }

      // Update every stores with current value
      this.store = ({value, groups, replace} = {}) => {
        return this.call(ret => {
          if (value) {
            ret = value;
          }
          if (!ret) {
            return;
          }

          ret = model.normalize(ret);
          // Loop over each different models extracted from api return
          var result = null;
          Object.keys(ret.entities).forEach(storeName => {
            this.updatedStores.add(storeName);
            var datas = Object.values(ret.entities[storeName]);
            this.fillLinkedModelsWith(datas, storeName);
            // Target store model -> save datas that we'll return
            if (targetStore === storeName) {
              if (typeof replace !== 'undefined') {
                result = store.replace(replace, datas[0]);
              } else {
                result = store.update(datas.length < 2 ? datas[0] : datas, {
                  groups,
                });
              }
            } else {
              datascheme
                .store(storeName)
                .update(datas.length < 2 ? datas[0] : datas);
            }
          });

          return result;
        });
      };
    };
  };
}
