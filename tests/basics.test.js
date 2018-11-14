import {db, fetchUsers, fetchTodos} from './mock/apis';
import datascheme from './mock/datascheme';

var request = store => datascheme.request(store);
var stores = datascheme.allStores();

const grpName = 'customGrp';

test('Inserting datas', () => {
  // Filling users & todos
  return Promise.all([
    request('users')
      .call(fetchUsers)
      .store().result,
    request('todos')
      .call(fetchTodos)
      .store().result,
  ]).then(results => {
    results[0].map(
      user =>
        expect(user).toEqual(db.users[user.id]) &&
        expect(user).toEqual(stores.users.get(user.id))
    );

    results[1].map(
      todo =>
        expect(todo).toEqual(db.todos[todo.objectId]) &&
        expect(todo).toEqual(stores.todos.get(todo.objectId))
    );
  });
});

test('Updating datas with group', async() => {
  var todo = stores.todos.getArray()[0];
  todo.foo = 'bar';

  // Simple update : adding an attribute
  var result = await request('todos').store({value: todo, groups: [grpName]})
    .result;
  expect(result).toEqual(stores.todos.get(result.objectId));
  expect(result).toEqual(todo);

  // Add multiple models in a specific group
  const newTodos = [
    {descr: 'New todo 1', owner: 1, objectId: 10},
    {descr: 'New todo 2', owner: 1, objectId: 11},
  ];

  const expectedGrp = [todo, ...newTodos];
  await request('todos').store({
    groups: [grpName],
    value: newTodos,
  }).result;

  const updatedGrp = stores.todos.getGroup(grpName);
  expectedGrp.map((todo, idx) => expect(todo).toEqual(updatedGrp[idx]));

  // Second simple update with incomplete input object
  var user = stores.users.get(0);
  const update = {id: 0, lastname: 'pion'};
  await request('users').store({value: update}).result;
  expect({...user, ...update}).toEqual(stores.users.get(0));
});

test('Deleting datas', async() => {
  // Simple delete by Id
  var todos = stores.todos.getArray();
  var todoId = todos[0].objectId;
  await request('todos')
    .value({id: todoId})
    .delete().result;
  var updated = stores.todos.getArray();
  expect(updated.length).toBe(todos.length - 1);
  expect(updated[0]).toEqual(todos[1]);
  expect(stores.todos.get(todoId)).toBeUndefined();

  // Deleting a model from a group
  const grp = stores.todos.getGroup(grpName);
  todoId = grp[1].objectId;
  await request('todos')
    .value({id: todoId})
    .delete().result;
  updated = stores.todos.getGroup(grpName);
  expect(updated.length).toBe(grp.length - 1);
  expect(updated[1]).toEqual(grp[2]);
  expect(stores.todos.get(todoId)).toBeUndefined();
});

test('Request gets', () => {
  return request('users')
    .get(0)
    .result.then(user => expect(user).toEqual(stores.users.get(0)));
});

test('Replace', () => {
  var users = stores.users.getArray();
  var replacement = {
    name: 'pedro',
    todos: [],
    id: 80,
  };

  request('users')
    .store({
      value: replacement,
      replace: users[0].id,
    })
    .result.then(() => {
      expect(stores.users.getArray()[0]).toEqual(replacement);
    });
});

test('Oneshot saved calls', async() => {
  var counter = 0;
  const savedCall = {
    callId: 'MY_CALL',
    fn: () =>
      new Promise((resolve, reject) => {
        counter++;
        setTimeout(() => resolve(counter), 200);
      }),
  };

  request('users').savedCall(savedCall);
  expect(datascheme.isRunningCall(savedCall.callId)).toBe(true);
  return request('users')
    .savedCall(savedCall)
    .result.then(result => {
      expect(result).toBe(1);
      return Promise.all([
        new Promise((resolve, reject) => setTimeout(() => resolve(true, 50))),
        request('users')
          .savedCall(savedCall)
          .result.then(result => expect(result).toBe(1)),
      ]).then(() =>
        expect(datascheme.isRunningCall(savedCall.callId)).toBe(false)
      );
    });
});

test('Saved calls', async() => {
  var counter = 0;
  const savedCall = {
    callId: 'MY_CALL_2',
    oneshot: false,
    fn: () =>
      new Promise((resolve, reject) => {
        counter++;
        setTimeout(() => resolve(counter), 500);
      }),
  };

  request('users').savedCall(savedCall);
  expect(datascheme.isRunningCall(savedCall.callId)).toBe(true);
  var result = await request('users').savedCall(savedCall).result;
  expect(result).toBe(1);
  expect(datascheme.isRunningCall(savedCall.callId)).toBe(false);
  result = await request('users').savedCall(savedCall).result;
  expect(result).toBe(2);
});
