#!/bin/zsh
# Double-click to open the OxGuess question editor. Leave this window open while you edit; close it when done.
cd "$(dirname "$0")/../.." || exit 1
( sleep 1 && open "http://localhost:4400" ) &
node tools/editor/server.mjs
