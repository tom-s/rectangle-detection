const exec = require("child_process").exec;
const express = require("express");
const app = express();

exec("watchify app/js/main.js -o app/js/bundle.js");

app.use(express.static(__dirname + "/app"));

app.listen(3000);
console.log("Listening on port 3000");
