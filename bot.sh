#!/bin/bash
lines="`ps -aux | grep -i index.js | grep -v grep | wc -l`"
exitcode=0

if [ "$lines" == "0" ]
then
	cd ~/Projects/Node/MediaBot

	while [ $exitcode != 100 ]
	do
	    node ./index.js
	    exitcode=$?
	done
else
	echo Bot already running
fi


