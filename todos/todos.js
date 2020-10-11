"use strict";

/* eslint-disable max-statements */
/* eslint-disable max-lines-per-function */
const express = require("express");
const morgan = require("morgan");
const flash = require("express-flash");
const session = require("express-session");
const { body, validationResult } = require("express-validator");
const store = require("connect-loki");
const PgPersistence = require("./lib/pg-persistence");

const app = express();
const host = "localhost";
const port = 3000;
const LokiStore = store(session);

app.set("views", "./views");
app.set("view engine", "pug");

app.use(morgan("common"));
app.use(express.static("public"));
app.use(express.urlencoded({ extended: false }));
app.use(session({
  cookie: {
    httpOnly: true,
    maxAge: 31 * 24 * 60 * 60 * 1000, // 31 days in millseconds
    path: "/",
    secure: false,
  },
  name: "launch-school-todos-session-id",
  resave: false,
  saveUninitialized: true,
  secret: "this is not very secure",
  store: new LokiStore({}),
}));

app.use(flash());

// Create a new datastore
app.use((req, res, next) => {
  res.locals.store = new PgPersistence(req.session);
  next();
});

// Temporary test code
app.use(async (req, res, next) => {
  try {
    await res.locals.store.testQuery1();
    await res.locals.store.testQuery2();
    res.send("quitting");
  } catch (error) {
    next(error);
  }
});

// Extract session info
app.use((req, res, next) => {
  res.locals.flash = req.session.flash;
  delete req.session.flash;
  next();
});

// Redirect start page
app.get("/", (req, res) => {
  res.redirect("/lists");
});

// Render the list of todo lists
app.get("/lists", (req, res) => {
  let store = res.locals.store;
  let todoLists = store.sortedTodoLists();

  let todosInfo = todoLists.map(todoList => store.todoListInfo(todoList));

  res.render("lists", {
    todoLists,
    todosInfo
  });
});

// Render new todo list page
app.get("/lists/new", (req, res) => {
  res.render("new-list");
});

// Create a new todo list
app.post("/lists",
  [
    body("todoListTitle")
      .trim()
      .isLength({ min: 1 })
      .withMessage("The list title is required.")
      .isLength({ max: 100 })
      .withMessage("List title must be between 1 and 100 characters.")
      .withMessage("List title must be unique."),
  ],
  (req, res, next) => {
    let store = res.locals.store;
    let errors = validationResult(req);
    let todoListTitle = req.body.todoListTitle;

    let rerenderNewList = () => {
      res.render("new-list", {
        flash: req.flash(),
        todoListTitle,
      });
    };

    if (!errors.isEmpty()) {
      errors.array().forEach(message => req.flash("error", message.msg));
      rerenderNewList();
    } else if (store.existsTodoListTitle(req.body.todoListTitle)) {
      req.flash("error", "List title must be unique");
      rerenderNewList();
    } else {
      let created = store.createTodoList(todoListTitle);
      if (!created) {
        next(new Error("Failed to create todo list."));
      } else {
        req.flash("success", "The todo list has been created.");
        res.redirect("/lists");
      }
    }
  }
);

// Render individual todo list and its todos
app.get("/lists/:todoListId", (req, res, next) => {
  let store = res.locals.store;
  let todoListId = req.params.todoListId;
  let todoList = store.loadTodoList(+todoListId);
  let todosInfo = store.todoListInfo(todoList);
  if (todoList === undefined) {
    next(new Error("Not found."));
  } else {
    todoList.todos = store.sortedTodos(todoList);

    res.render("list", {
      todoList,
      todosInfo
    });
  }
});

// Toggle completion status of a todo
app.post("/lists/:todoListId/todos/:todoId/toggle", (req, res, next) => {
  let store = res.locals.store;
  let { todoListId, todoId } = { ...req.params };
  let toggled = store.toggledTodo(+todoListId, +todoId);
  if (!toggled) {
    next(new Error("Not found."));
  } else {
    let todo = store.loadTodo(+todoListId, +todoId);
    let title = todo.title;
    if (todo.done) {
      req.flash("success", `"${title}" marked as NOT done!`);
    } else {
      req.flash("success", `"${title}" marked done.`);
    }

    res.redirect(`/lists/${todoListId}`);
  }
});

// Delete a todo
app.post("/lists/:todoListId/todos/:todoId/destroy", (req, res, next) => {
  let store = res.locals.store;
  let { todoListId, todoId } = { ...req.params };

  let deleted = store.deletedTodo(+todoListId, +todoId);
  if (!deleted) {
    next(new Error("Not found."));
  } else {
    req.flash("success", "The todo has been deleted.");
    res.redirect(`/lists/${todoListId}`);
  }
});

// Mark all todos as done
app.post("/lists/:todoListId/complete_all", (req, res, next) => {
  let store = res.locals.store;
  let todoListId = req.params.todoListId;
  let completedAll = store.completeAllTodos(+todoListId);
  if (!completedAll) {
    next(new Error("Not found."));
  } else {
    req.flash("success", "All todos have been marked as done.");
    res.redirect(`/lists/${todoListId}`);
  }
});

// Create a new todo and add it to the specified list
app.post("/lists/:todoListId/todos",
  [
    body("todoTitle")
      .trim()
      .isLength({ min: 1 })
      .withMessage("The todo title is required.")
      .isLength({ max: 100 })
      .withMessage("Todo title must be between 1 and 100 characters."),
  ],
  (req, res, next) => {
    let store = res.locals.store;
    let todoListId = req.params.todoListId;
    let todoList = store.loadTodoList(+todoListId);
    if (!todoList) {
      next(new Error("Not found."));
    } else {
      let errors = validationResult(req);
      if (!errors.isEmpty()) {
        errors.array().forEach(message => req.flash("error", message.msg));

        todoList.todos = store.sortedTodos(todoList);

        res.render("list", {
          flash: req.flash(),
          todoList,
          todosInfo: store.todoListInfo(todoList),
          todoTitle: req.body.todoTitle,
        });
      } else {
        store.createTodo(+todoListId, req.body.todoTitle);
        req.flash("success", "The todo has been created.");
        res.redirect(`/lists/${todoListId}`);
      }
    }
  }
);

// Render edit todo list form
app.get("/lists/:todoListId/edit", (req, res, next) => {
  let store = res.locals.store;
  let todoListId = req.params.todoListId;
  let todoList = store.loadTodoList(+todoListId);
  if (!todoList) {
    next(new Error("Not found."));
  } else {
    res.render("edit-list", { todoList });
  }
});

// Delete todo list
app.post("/lists/:todoListId/destroy", (req, res, next) => {
  let store = res.locals.store;
  let todoListId = +req.params.todoListId;
  let deleted = store.deleteTodoList(todoListId);
  if (!deleted) {
    next(new Error("Not found."));
  } else {
    req.flash("success", "Todo list deleted.");
    res.redirect("/lists");
  }
});

// Edit todo list title
app.post("/lists/:todoListId/edit",
  [
    body("todoListTitle")
      .trim()
      .isLength({ min: 1 })
      .withMessage("The list title is required.")
      .isLength({ max: 100 })
      .withMessage("List title must be between 1 and 100 characters.")
      .withMessage("List title must be unique."),
  ],
  (req, res, next) => {
    let store = res.locals.store;
    let todoListId = req.params.todoListId;
    let todoListTitle = req.body.todoListTitle;
    let todoList = store.loadTodoList(+todoListId);

    let rerenderEditList = () => {
      if (!todoList) {
        next(new Error("Not found."));
      } else {
        res.render("edit-list", {
          flash: req.flash(),
          todoListTitle,
          todoList: todoList,
        });
      }
    };

    let errors = validationResult(req);
    if (!errors.isEmpty()) {
      errors.array().forEach(message => req.flash("error", message.msg));
      rerenderEditList();
    } else if (store.existsTodoListTitle(todoListTitle)) {
      req.flash("error", "List title must be unique.");
      rerenderEditList();
    } else if (!store.setTodoListTitle(+todoListId, todoListTitle)) {
      next(new Error("Not Found."));
    } else {
      req.flash("success", "Todo list updated.");
      res.redirect(`/lists/${todoListId}`);
    }
  }
);

// Error handler
app.use((err, req, res, _next) => {
  console.log(err); // Writes more extensive information to the console log
  res.status(404).send(err.message);
});

// Listener
app.listen(port, host, () => {
  console.log(`Todos is listening on port ${port} of ${host}!`);
});
