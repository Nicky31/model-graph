import {DataScheme} from '../../src/';

const datascheme = new DataScheme(
  {
    users: {
      idAttribute: 'id'
    },

    todos: {},

    comments: {},
  },
  {idAttribute: 'objectId'}
);

// Link models

datascheme.model('users').link('todos', [datascheme.model('todos')], {
  via: {
    attr: 'owner'
  }
})

datascheme.model('todos').link('owner', datascheme.model('users'))

datascheme.model('comments')
  .link('todo', datascheme.model('todos'))
  .link('author', datascheme.model('users'))

export default datascheme