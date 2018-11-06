import {db, fetchUsers, fetchTodos} from './mock/apis';
import datascheme from './mock/datascheme';

var request = store => datascheme.request(store);
var stores = datascheme.allStores();

test('Insert linked models : From array link attributes', () => {
  return request('users')
    .call(() => fetchUsers({populate: true}))
    .store({groups: ['myUsers']})
    .result.then(users => {
      expect(stores.users.getGroup('myUsers')).toEqual(Object.values(db.users));
      expect(stores.todos.getArray()).toEqual(Object.values(db.todos));
    });
});

test('Insert linked models : From single link attributes', () => {
  stores.users.clear();
  stores.todos.clear();

  return (
    request('todos')
      .call(() => fetchTodos({populate: true}))
      // .store({groups: ['myTodos']})
      .store()
      .result.then(todos => {
        expect(stores.todos.getGroup('all')).toEqual(Object.values(db.todos));
        expect(stores.users.getArray()).toEqual(Object.values(db.users));
      })
  );
});
