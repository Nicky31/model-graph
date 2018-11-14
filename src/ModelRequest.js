export default function requestBuilder(datascheme) {
  return targetStore => {
    const store = datascheme.store(targetStore);
    const model = datascheme.model(targetStore);
    const idAttribute = 'ifed';
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

      this.otherwise = fn => {
        this.result.then(result => {
          if (typeof result !== 'undefined') {
            return this;
          }
          return fn(this);
        });
        return this;
      };

      this.checkNotNull = () => {
        this.result.then(ret => {
          if (!ret) {
            throw new Error({error: 'Empty request result !'});
          }
        });
        return this;
      };

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

      this.delete = input2 => {
        return this.call(data => {
          if (!data) {
            return;
          }
          this.updatedStores.add(targetStore);
          return store.delete(data.id);
        });
      };

      // Given some entities and their modelName, look for any linked model
      // in other stores.
      // Update every found entities link attributes accordingly
      this.fillLinkedModelsWith = (entities, modelName) => {
        if (!(modelName in datascheme.autolinks)) {
          return;
        }
        var autolinks = datascheme.autolinks[modelName];
        // Loop over each model that given one can fill
        autolinks.forEach(autolink => {
          entities.forEach(entity => {
            var id =
              typeof entity[autolink.via] === 'object'
                ? entity[autolink.via][idAttribute]
                : entity[autolink.via];
            // Try to find a linked model corresponding to 'id'
            datascheme
              .request(autolink.linkedModel)
              .get(id)
              .call(linkedModel => {
                if (!linkedModel) {
                  return;
                }
                this.updatedStores.add(autolink.linkedModel);
                // A linked model exists ; update the link attribute
                let updatedAttr = linkedModel[autolink.linkedAttr];
                // Check if linked attribute is an array : concat
                if (
                  Array.isArray(updatedAttr) &&
                  !updatedAttr.includes(entity[idAttribute])
                ) {
                  updatedAttr = [...updatedAttr, entity[idAttribute]];
                } else if (
                  !Array.isArray(updatedAttr) &&
                  updatedAttr !== entity[idAttribute]
                ) {
                  updatedAttr = entity[idAttribute];
                }

                datascheme.store(autolink.linkedModel).update({
                  id,
                  [autolink.linkedAttr]: updatedAttr,
                });
              });
          });
        });
      };

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
