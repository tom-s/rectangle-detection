#!/bin/bash

rm -rf dist/
mkdir dist
mkdir dist/js
browserify js/main.js -o dist/js/bundle.js
cp index.html dist/
cp js/contour-worker.js dist/js
cp CNAME dist/

surge dist/
