#!/bin/bash

# switch to project root directory
cd "$(dirname "$0")/.."

# load service port configurations from .env file
if [ -f .env ]; then
    echo "Loading service port configurations from .env file..."
    export $(cat .env | grep "SERVER_PORT" | grep -v '^#' | xargs)
else
    echo "Warning: .env file not found!"
fi

# get project name prefix
namePrefix=$(basename $(pwd))
if [ ! -z "$APP_PREFIX" ]; then
    namePrefix=$APP_PREFIX
fi


cleanup_port() {
    # if get port failed, return directly
    if [ -z "$SERVER_PORT" ]; then
        echo "Skipping port cleanup for $service due to port not found"
        return
    fi
    
    echo "Checking port $SERVER_PORT"
    
    # find process using this port
    # pid can only get the first line of losf value
    local pid=$(lsof -ti:$SERVER_PORT | head -n 1)
    if [ ! -z "$pid" ]; then
        echo "Found process $pid using port $SERVER_PORT, killing it..."
        kill -9 $pid
        sleep 1
    fi
}


echo "Stopping agent..."
pm2 stop "${namePrefix}-agent" | grep "${namePrefix}-agent"
sleep 2
cleanup_port

echo "Starting agent..."
pm2 start "${namePrefix}-agent"
