#!/bin/bash

BASEDIR=$(dirname $BASH_SOURCE)
cd $BASEDIR
source utility.sh
# say 'Changed directory to SCRIPT folder (if not already set)'

cd_to_script

export DEVELOPMENT=true

./start.sh
