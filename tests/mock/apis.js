// Users
const users = {
  0: {
    name: 'jean',
    todos: [2],
    id: 0,
  },

  1: {
    name: 'alice',
    todos: [0, 1],
    id: 1,
  },
};

// Todos
const todos = {
  0: {
    descr: 'Re design header',
    owner: 1,
    done: false,
    objectId: 0,
  },

  1: {
    descr: 'Implement i18n',
    owner: 1,
    done: true,
    objectId: 1,
  },

  2: {
    descr: 'Fix sql injection on login form',
    owner: 0,
    done: false,
    objectId: 2,
  }
};

export const db = {users, todos};

function fetch({id, populate = false, type}) {
  if (id === undefined) {
    id = Object.keys(db[type]);
  }
  const prepare = id => {
    var model = db[type][id];
    if (!model) {
      return false;
    }
    if (populate) {
      model = {...model};
      if (type === 'users') {
        model.todos = model.todos.map(id => db.todos[id]);
      } else if (type === 'todos') {
        model.owner = db.users[model.owner];
      }
    }
    return model;
  };

  return Promise.resolve(Array.isArray(id) ? id.map(prepare) : prepare(id));
}

export function fetchUsers({id, populate} = {}) {
  return fetch({
    id,
    populate,
    type: 'users',
  });
}

export function fetchTodos({id, populate} = {}) {
  return fetch({
    id,
    populate,
    type: 'todos',
  });
}
