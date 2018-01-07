# FallenLondon
Use this to extract couch db info
https://github.com/danielebailo/couchdb-dump

access couchdb config @ ipaddress:6969/_utils/index.html

bash couchdb-backup.sh -b -H 127.0.0.1 -d fl_branches -f fl_branchesDB.json -u admin -p admin

bash couchdb-backup.sh -b -H 127.0.0.1 -d fl_events -f fl_eventsDB.json -u admin -p admin
