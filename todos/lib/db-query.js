"use strict";

let { Client } = require("pg");

const logQuery = (statement, parameters) => {
  let timeStamp = new Date();
  let formattedTimeStamp = timeStamp.toString().substring(4, 24);
  console.log(formattedTimeStamp, statement, parameters);
};

module.exports = {
  async dbQuery(statement, ...parameters) {
    let client = new Client({
      database: "todo-lists",
      user: "pilot",
      password: "6z00kDUdR5zO_M5x",
      host: "10.77.0.3",
      port: "5432"
    });

    await client.connect();
    logQuery(statement, parameters);
    let result = await client.query(statement, parameters);
    await client.end();

    return result;
  },

  async initDb(sql) {
    let client = new Client({
      database: "postgres",
      user: "pilot",
      password: "6z00kDUdR5zO_M5x",
      host: "10.77.0.3",
      port: "5432"
    });

    await client.connect();
    logQuery(sql, "NONE");
    let result = await client.query(sql);
    await client.end();

    return result;
  },
};