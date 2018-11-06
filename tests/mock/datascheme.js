import {DataScheme} from '../../src/';

const datascheme = new DataScheme(
  {
    users: {},

    todos: {},

    comments: {},
  },
  {idAttribute: 'objectId'}
);

// Link models

datascheme.model('todos').define({
  owner: datascheme.model('users'),
});

datascheme.model('users').define({
  todos: [datascheme.model('todos')],
});

datascheme.model('comments').define({
  todo: datascheme.model('todos'),
  author: datascheme.model('users'),
});

export default datascheme;
