$(document).ready(function() {
    var dataSource = {};
    var char = $.getJSON("char_sitbuttheadxx.json");
    var branch = $.getJSON("fl_branches.json");
    var event = $.getJSON("fl_events.json");
    $tree = $("#primaryNav");

    $.when(char, branch, event).done(function(char, branch, event) {
        dataSource.char = char[0];
        dataSource.branch = branch[0];
        dataSource.event = event[0];




        google.charts.load('current', {
            packages: ["orgchart"]
        });
        google.charts.setOnLoadCallback(drawChart);

        function drawChart() {
            var data = new google.visualization.DataTable();
            data.addColumn('string', 'Name');
            data.addColumn('string', 'Manager');
            data.addColumn('string', 'ToolTip');

            var rows = [];
            for (var i = 0; i < dataSource.char.rows.length; i++) {
                var item = dataSource.char.rows[i].doc;
                if (item.type == "event") {
                    
                    var prevItem = dataSource.char.rows[i-1];
                    var eventId = item.id_;
                    if (!getNodeData(dataSource.event.rows, eventId)) {
                            console.log();
                        }
                    var eventData = getNodeData(dataSource.event.rows, eventId).doc;
                    var eventContent = eventData.type + " : " + eventData.id_;
                    var eventBranches = eventData.branches;
                    for (var b = 0; b < eventBranches.length; b++) {
                        var branchId = eventBranches[b];
                        if (!getNodeData(dataSource.branch.rows, branchId)) {
                            console.log();
                        }
                        var branchData = getNodeData(dataSource.branch.rows, branchId);
                        branchData = branchData ? branchData : {doc:{type: "branch", id_:branchId}};
                        var content = "branch : " + branchId;
                        var r = appendRow(branchData.doc, content);
                        rows.push(r);
                    }
                    var row = appendRow(eventData.doc, prevItem ? prevItem.doc.type + " : " + prevItem.doc.id_ : "");
                    rows.push(row);
                }
            }
            // For each orgchart box, provide the name, manager, and tooltip to show.
            data.addRows(rows);

            // Create the chart.
            var chart = new google.visualization.OrgChart(document.getElementById('chart_div'));
            // Draw the chart, setting the allowHtml option to true for the tooltips.
            chart.draw(data, {
                allowHtml: true
            });
        console.log(dataSource);

        function appendRow(rowData, parent) {
            var row = [];
            row[0] = rowData.type + " : " + rowData.id_;
            row[1] = parent;
            row[2] = "";

            return row;
        }
        function getNodeData(array, id) {
            var item = array.filter(function(obj) {
                return obj.id == id;
            });

            return item[0];
        }

        return;
        var _root = true;
        for (var i = 0; i < dataSource.char.rows.length; i++) {
            var item = dataSource.char.rows[i].doc;
            if (item.type == "event") {
                var eventId = item.id_;
                var eventData = getNodeData(dataSource.event.rows, eventId).doc;
                var template = "";
                var content = item.type + " : " + eventId;
                var rootId = _root ? "home" : "";
                _root = false;
                template += '<li id="'+rootId+'" event_id="'+eventId+'"><a href="#">'+content+'</a>';
                
                var eventBranches = eventData.branches;
                template += "<ul>";
                for (var b = 0; b < eventBranches.length; b++) {
                    var branchId = eventBranches[b];
                    if (!getNodeData(dataSource.branch.rows, branchId)) {
                        console.log();
                    }
                    var branchData = getNodeData(dataSource.branch.rows, branchId);
                    var content = "branch : " + branchId;
                    template += '<li id="" event_id="'+eventId+'" branch_id="'+branchId+'"><a href="#">'+content+'</a></li>';    
                }
                template += "</ul></li>";
                $tree.append(template);
            }
        }

        function getNodeData(array, id) {
            var item = array.filter(function(obj) {
                return obj.id == id;
            });

            return item[0];
        }
        }
    });
});