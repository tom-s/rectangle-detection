const browserify = require("browserify-middleware");
const express = require("express");
const app = express();

app.use(express.static(__dirname + "/app"));

app.get("/js/bundle.js", browserify("./app/js/main.js"));

app.listen(3000);
console.log("Listening on port 3000");
