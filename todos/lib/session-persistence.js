"use strict";

// const SeedData = require("./seed-data");
const deepCopy = require("./deep-copy");
const { sortTodoLists, sortTodos } = require("./sort");
const nextId = require("./next-id");

module.exports = class SessionPersistence {
  constructor(session) {
    this._todoLists = session.todoLists;
    session.todoLists = this._todoLists;
  }

  // Returns `true` if `error` seems to indicate a `UNIQUE` constraint
  // violation, `false` otherwise.
  isUniqueConstraintViolation(_error) {
    return false;
  }

  // Are all of the todos in the todo list done? If the todo list has at least
  // one todo and all of its todos are marked as done, then the todo list is
  // done. Otherwise, it is undone.
  isDoneTodoList(todoList) {
    return todoList.todos.length > 0 && todoList.todos.every(todo => todo.done);
  }

  isDoneTodo(todo) {
    return todo.done;
  }

  // Return the list of todo lists sorted by completion status and title
  // (case-insensitive)
  sortedTodoLists() {
    let todoLists = deepCopy(this._todoLists);
    let undone = todoLists.filter(todoList => !this.isDoneTodoList(todoList));
    let done = todoLists.filter(todoList => this.isDoneTodoList(todoList));
    return sortTodoLists(undone, done);
  }

  // Return the list of todos sorted by completion status and title
  // (case-insensitive)
  sortedTodos(todoList) {
    let todos = deepCopy(todoList.todos);
    let undone = todos.filter(todo => !this.isDoneTodo(todo));
    let done = todos.filter(todo => this.isDoneTodo(todo));
    return deepCopy(sortTodos(undone, done));
  }

  // Find a todo list with the indicated ID. Returns `undefined` if not found.
  // Note that `todoListId` must be numeric.
  loadTodoList(todoListId) {
    let todoList = this._findTodoList(todoListId);
    return deepCopy(todoList);
  }

  // Return a copy of a todo with the indicated ID in the indicated todo list. Returns
  // `undefined` if not found. Note that both `todoListId` and `todoId` must be
  // numeric.
  loadTodo(todoListId, todoId) {
    let todo = this._findTodo(todoListId, todoId);
    return deepCopy(todo);
  }

  // Returns an object containing informative properties about the todoList
  todoListInfo(todoList) {
    let countAllTodos = todoList.todos.length;
    let countDoneTodos = todoList.todos.filter(todo => todo.done).length;
    let isDone = this.isDoneTodoList(todoList);
    return {
      countAllTodos,
      countDoneTodos,
      isDone
    };
  }

  // Returns a reference to the todo list with the indicated ID. Returns
  // `undefined`. if not found. Note that `todoListId` must be numeric.
  _findTodoList(todoListId) {
    return this._todoLists
      .find(todoList => todoList.id === todoListId);
  }

  // Returns a reference to the indicated todo in the indicated todo list.
  // Returns `undefined` if either the todo list or the todo is not found. Note
  // that both IDs must be numeric.
  _findTodo(todoListId, todoId) {
    let todoList = this._findTodoList(todoListId);
    if (!todoList) return undefined;
    return todoList.todos.find(todo => todo.id === todoId);
  }

  // Toggle a todo between the done and not done state. Returns `true` on
  // success, `false` if the todo or todo list doesn't exist. The id arguments
  // must both be numeric.
  toggledTodo(todoListId, todoId) {
    let todo = this._findTodo(todoListId, todoId);
    if (!todo) return false;

    todo.done = !todo.done;
    return true;
  }

  // Delete the specified todo from the specified todo list. Returns `true` on
  // success, `false` if the todo or todo list doesn't exist. The id arguments
  // must both be numeric.
  deletedTodo(todoListId, todoId) {
    let todoList = this._findTodoList(todoListId);
    if (!todoList) return false;

    let todoIndex = todoList.todos.findIndex(todo => todo.id === todoId);
    if (todoIndex === -1) return false;

    todoList.todos.splice(todoIndex, 1);
    return true;
  }

  // Delete the specified todo list using the passed in ID argument.
  // If the todo list does not exist return 'false' otherwise return 'true'.
  // The id must be a numeric.
  deleteTodoList(todoListId) {
    let index = this._todoLists
      .findIndex(todoList => todoList.id === todoListId);
    if (index === -1) return false;

    this._todoLists.splice(index, 1);
    return true;
  }

  // Mark all todos on the todo list as done. Returns `true` on success,
  // `false` if the todo list doesn't exist. The todo list ID must be numeric.
  completeAllTodos(todoListId) {
    let todoList = this._findTodoList(todoListId);
    if (!todoList || todoList.todos.length === 0) return false;

    todoList.todos.forEach(todo => {
      if (!todo.done) todo.done = true;
    });
    return true;
  }

  // Create a new todo with the specified title and add it to the indicated todo
  // list. Returns `true` on success, `false` on failure.
  createTodo(todoListId, title) {
    let todoList = this._findTodoList(todoListId);
    if (!todoList) return false;

    let todo = {
      id: nextId(),
      title,
      done: false
    };

    todoList.todos.push(todo);
    return true;
  }

  // Create a new todo list with the specified title and add it to the list of
  // todo lists. Returns `true` on success, `false` on failure. (At this time,
  // there are no known failure conditions.)
  createTodoList(title) {
    let todoList = {
      id: nextId(),
      title,
      todos: []
    };

    this._todoLists.push(todoList);
    return true;
  }

  // Find the todo list using the specified id and change its title to the
  // specified title argument. Returns 'true' on successful find of todo list
  // and 'false' on failure.
  setTodoListTitle(todoListId, title) {
    let todoList = this._findTodoList(todoListId);
    if (!todoList) return false;

    todoList.title = title;
    return true;
  }

  // Returns `true` if a todo list with the specified title exists in the list
  // of todo lists, `false` otherwise.
  existsTodoListTitle(todoListTitle) {
    return this._todoLists.some(list => list.title === todoListTitle);
  }

};