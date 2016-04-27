#!/bin/bash

rm -rf dist/
mkdir dist
mkdir dist/js
cp app/index.html dist/
cp app/js/contour-worker.js dist/js
browserify app/js/main.js -o dist/js/bundle.js
cp CNAME dist/

surge dist/
