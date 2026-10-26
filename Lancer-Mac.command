#!/bin/bash
cd -- "$(dirname -- "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
 echo 'Installez Node.js 22 ou ultérieur depuis nodejs.org, puis relancez.'
 read -r -p 'Entrée pour fermer.'
 exit 1
fi
if [ ! -d node_modules/electron/dist ]; then
 npm ci || exit 1
fi
npm run build:native || exit 1
unset ELECTRON_RUN_AS_NODE
npm start
