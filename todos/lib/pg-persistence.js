"use strict";

const { dbQuery } = require("./db-query");
const bcrypt = require("bcrypt");

module.exports = class PgPersistence {
  constructor(session) {

  }

  // Returns `true` if `error` seems to indicate a `UNIQUE` constraint
  // violation, `false` otherwise.
  isUniqueConstraintViolation(error) {
    return /duplicate key value violates unique constraint/.test(String(error));
  }

  // Are all of the todos in the todo list done? If the todo list has at least
  // one todo and all of its todos are marked as done, then the todo list is
  // done. Otherwise, it is undone.
  isDoneTodoList(todoList) {
    return todoList.todos.length > 0 && todoList.todos.every(todo => todo.done);
  }

  // Returns a promise that resolves to a sorted list of all the todo lists
  // together with their todos. The list is sorted by completion status and
  // title (case-insensitive). The todos in the list are unsorted.
  async sortedTodoLists() {
    const ALL_TODOLISTS = "SELECT * FROM todolists ORDER BY lower(title) ASC";
    const FIND_TODOS = "SELECT * FROM todos WHERE todolist_id = $1";

    let result = await dbQuery(ALL_TODOLISTS);
    let todoLists = result.rows;

    for (let index = 0; index < todoLists.length; index += 1) {
      let todoList = todoLists[index];
      let todos = await dbQuery(FIND_TODOS, todoList.id);
      todoList.todos = todos.rows;
    }

    return this._partitionTodoLists(todoLists);
  }

  // Returns a new list of todo lists partitioned by completion status.
  _partitionTodoLists(todoLists) {
    let undone = [];
    let done = [];

    todoLists.forEach(todoList => {
      if (this.isDoneTodoList(todoList)) {
        done.push(todoList);
      } else {
        undone.push(todoList);
      }
    });

    return undone.concat(done);
  }

  // Return the list of todos sorted by completion status and title
  // (case-insensitive)
  async sortedTodos(todoList) {
    const FIND_TODOS = "SELECT * FROM todos WHERE todolist_id = $1 ORDER BY done ASC, lower(title) ASC";
    let result = await dbQuery(FIND_TODOS, todoList.id);
    return result.rows;;
  }

  // Returns a promise that resolves to a todo list with the indicated ID.
  // The todo list contains the todos for the list. Todos are not sroted.
  // The promise resolves to 'undefined' if the todo list is not found.
  async loadTodoList(todoListId) {
    const FIND_TODOLIST = "SELECT * FROM todolists WHERE id = $1";
    const FIND_TODOS = "SELECT * FROM todos WHERE todolist_id = $1";
  
    let resultTodoList = dbQuery(FIND_TODOLIST, todoListId);
    let resultTodos = dbQuery(FIND_TODOS, todoListId);
    let finalResult = await Promise.all([resultTodoList, resultTodos]);
    
    let todoList = finalResult[0].rows[0];
    if (!todoList) return undefined;

    todoList.todos = finalResult[1].rows;
    return todoList;
  }

  // Return a copy of a todo with the indicated ID in the indicated todo list. Returns
  // `undefined` if either the todo list or todo is not found. 
  // Note that both `todoListId` and `todoId` must be numeric.
  async loadTodo(todoListId, todoId) {
    const FIND_TODO = "SELECT * FROM todos WHERE todolist_id = $1 AND id = $2";

    let result = await dbQuery(FIND_TODO, todoListId, todoId);
    return result.rows[0];
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
    // return this._todoLists
    //   .find(todoList => todoList.id === todoListId);
  }

  // Returns a reference to the indicated todo in the indicated todo list.
  // Returns `undefined` if either the todo list or the todo is not found. Note
  // that both IDs must be numeric.
  _findTodo(todoListId, todoId) {
    // let todoList = this._findTodoList(todoListId);
    // if (!todoList) return undefined;
    // return todoList.todos.find(todo => todo.id === todoId);
  }

  // Toggle a todo between the done and not done state. Returns a promise that
  // resolves to `true` on success, `false` if the todo list or todo doesn't
  // exist. The id arguments must both be numeric.
  async toggledTodo(todoListId, todoId) {
    const TOGGLE_DONE = "UPDATE todos SET done = NOT done" +
                        "  WHERE todolist_id = $1 AND id = $2";
    
    let result = await dbQuery(TOGGLE_DONE, todoListId, todoId);
    return result.rowCount > 0;
  }

  // Delete the specified todo from the specified todo list. Returns 
  // a promsie that resolves to `true` on success, `false` if the todo or
  // todo list doesn't exist. The id arguments must both be numeric.
  async deletedTodo(todoListId, todoId) {
    const DELETE_TODO = "DELETE FROM todos WHERE todolist_id = $1 AND id = $2";

    let result = await dbQuery(DELETE_TODO, todoListId, todoId);
    return result.rowCount > 0;
  }

  // Delete the specified todo list using the passed in ID argument.
  // If the todo list does not exist returns a promise that resolves to
  // 'false' otherwise 'true'. The id must be a numeric.
  async deleteTodoList(todoListId) {
    const DELETE_TODO_LIST = "DELETE FROM todolists WHERE id = $1";

    let result = await dbQuery(DELETE_TODO_LIST, todoListId);
    return result.rowCount > 0;
  }

  // Mark all todos on the todo list as done. Returns
  // a promise that resolves to `true` on success,
  // `false` if the todo list doesn't exist. The todo list ID must be numeric.
  async completeAllTodos(todoListId) {
    const COMPLETE_TODOS = "UPDATE todos SET done = true" +
                           "  WHERE todolist_id = $1 AND NOT done";

    let result = await dbQuery(COMPLETE_TODOS, todoListId);
    return result.rowCount > 0;
  }

  // Create a new todo with the specified title and add it to the indicated todo
  // list. Returns a promise that resolves to `true` on success, `false` on failure.
  async createTodo(todoListId, title) {
    const CREATE_TODO = "INSERT INTO todos (title, todolist_id) VALUES ($1, $2)";

    let result = await dbQuery(CREATE_TODO, title, todoListId);
    return result.rowCount > 0;
  }

  // Create a new todo list with the specified title and add it to the list of
  // todo lists. Returns a Promise that resolves to `true` on success, `false`
  // if the todo list already exists.
  async createTodoList(title) {
    const CREATE_TODOLIST = "INSERT INTO todolists (title) VALUES ($1)";

    try {
      let result = await dbQuery(CREATE_TODOLIST, title);
      return result.rowCount > 0;
    } catch (error) {
      if (this.isUniqueConstraintViolation(error)) return false;
      throw error;
    }
  }

  // Find the todo list using the specified id and change its title to the
  // specified title argument. Returns a promise that resolves to 
  // 'true' on successful find of todo list and 'false' on failure.
  async setTodoListTitle(todoListId, title) {
    const UPDATE_TITLE = "UPDATE todolists SET title = $1 WHERE id = $2";

    let result = await dbQuery(UPDATE_TITLE, title, todoListId);
    return result.rowCount > 0;
  }

  // Returns a promise that resolves to `true` if a todo list with the
  // specified title exists in todolists, `false` otherwise.
  async existsTodoListTitle(todoListTitle) {
    const FIND_TODOLIST_TITLE = "SELECT title FROM todolists WHERE title = $1";

    let result = await dbQuery(FIND_TODOLIST_TITLE, todoListTitle);
    return result.rowCount > 0;
  }

  // Returns a Promise that resolves to `true` if `username` and `password`
  // combine to identify a legitimate application user, `false` if either the
  // `username` or `password` is invalid.
  async authenticate(username, password) {
    const FIND_HASHED_PASSWORD = "SELECT password FROM users" +
                      "  WHERE username = $1";

    let result = await dbQuery(FIND_HASHED_PASSWORD, username);
    if (result.rowCount === 0) return false;

    return bcrypt.compare(password, result.rows[0].password);
  }
};