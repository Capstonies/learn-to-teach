import { createStore, combineReducers, applyMiddleware } from 'redux';
import createLogger from 'redux-logger';
import thunkMiddleware from 'redux-thunk';
import { composeWithDevTools } from 'redux-devtools-extension';
import { reducer as form } from 'redux-form';
import { meReducer as me, usersReducer as users } from './users';
import questions from './questions';
import categories from './categories';
import classroom from './classroom';
import threads from './threads';

const reducer = combineReducers({
  form,
  me,
  users,
  questions,
  categories,
  classroom,
  threads
});

const middleware = composeWithDevTools(
  applyMiddleware(thunkMiddleware, createLogger({ collapsed: true }))
);

const store = createStore(reducer, middleware);

export default store;
export * from './users';
export * from './questions';
export * from './categories';
export * from './classroom';
export * from './threads';
