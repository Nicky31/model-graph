import {DataScheme} from '../../src/';

const datascheme = new DataScheme(
  {
    users: {
      idAttribute: 'id',
    },

    todos: {},

    comments: {},
  },
  {idAttribute: 'objectId'}
);

// Link models
datascheme.linking(({ users, todos, comments }) => {
  users.link('todos', [todos], {
    via: {
      attr: 'owner',
    },
  });

  todos.link('owner', users);

  comments
    .link('todo', todos)
    .link('author', users);
});

export default datascheme;
