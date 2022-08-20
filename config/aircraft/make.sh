#!/bin/bash
# Purpose: Read Comma Separated CSV File
# Author: Vivek Gite under GPL v2.0+
# ------------------------------------------
INPUT=~/Documents/Planes.csv
OLDIFS=$IFS
IFS=','
[ ! -f $INPUT ] && { echo "$INPUT file not found"; exit 99; }
while read icao dob ssn tel status
do
	mv porter-\ $icao\ .yaml porter-$icao.yaml
	yq -i $(echo '.name = "'$icao'"') porter-$icao.yaml
done < $INPUT
IFS=$OLDIFS
