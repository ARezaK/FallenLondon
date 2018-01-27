$(document).ready(function() {
    var dataSource = {};
    var char = $.getJSON("char_sitbuttheadxx_copy.json");
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
            var previousRow = [];
            for (var i = 0; i < dataSource.char.rows.length; i++) {
				console.log("#: ", i);
                var charData = dataSource.char.rows[i].doc;
                var charId = charData.id_;
                var chartId = charData.type;
				console.log("charData: ", charData);
				console.log("chartId: ", chartId);

                if (charData.type == "event") {
                    var charCode = "event :" + charId;
                    var eventData = getNodeData(dataSource.event.rows, charId);
                    eventData = eventData.doc;
                    var eventRow = appendRow("event", eventData, previousRow);
                    // Add event row to rows
                    rows.push(eventRow);
                    previousRow = eventRow;
                    // Get event branches
                    var branches = eventData.branches;

                    for (var b = 0; b < branches.length; b++) {
                        var branchId = branches[b];
                        var branchData = getNodeData(dataSource.branch.rows, branchId);
                        branchData = branchData ? branchData.doc : {
                            _id: branchId
                        }
						console.log("branchData: ", branchData);
                        var branchRow = appendRow("branch", branchData, previousRow);
                        rows.push(branchRow);
                    }
                } if (charData.type == "branch") {
                    var _branchRow = rows.filter(function(obj) {
						console.log("branchobj: ", obj)
                        var content = typeof obj[0] == "string" ? obj[0] : obj[0].v;
                        return content == "branch : " + charId;
                    })[0];
					console.log("_branchrow: ", _branchRow);
                    var branchIndex = rows.indexOf(_branchRow);
					console.log(branchIndex);
                    var branchRow = rows[branchIndex];
					console.log(branchRow);
                    var pass_or_fail = charData.pass_or_fail;
					console.log('pass or fail: ', pass_or_fail);
                    if (pass_or_fail == "success") {
                        branchRow[0].f = updateBranchNode(branchRow[0].f, "success");
                    } else if (pass_or_fail == "inevitable") {
                        branchRow[0].f = updateBranchNode(branchRow[0].f, "inevitable");
                    } else if (pass_or_fail == "fail") {
                        branchRow[0].f = updateBranchNode(branchRow[0].f, "fail");
                    }
                    previousRow = branchRow;
                }
            }
            // For each orgchart box, provide the name, manager, and tooltip to show.
            data.addRows(rows);

            // Create the chart.
            var chart = new google.visualization.OrgChart(document.getElementById('chart_div'));
            // Draw the chart, setting the allowHtml option to true for the tooltips.
            google.visualization.events.addListener(chart, 'ready', function() {
                $("td .node").each(function(index, el) {
                    var _class = $(el).prop("class");
                    $(el).closest("td").addClass(_class);
                });
            });
            chart.draw(data, {
                allowHtml: true,
				size:'medium',
	
            });

            function appendRow(type, rowData, prevRow) {
                if (!rowData._id) {
                    console.log();
                }
                var row = [];
                row[0] = {};
                row[0].v = type + " : " + rowData._id;

                var template = "<div class='node "+ type +"'>";
                template += row[0].v;
                template += "<p> TITLE: "+ (rowData.title || "") +"</p>";
                template += "<p> TEXT: "+ (rowData.text || "") +"</p>";
				try{
				if(type === 'branch'){
				template += "<p> Failure TITLE: "+ (rowData.results[0].title || "") +"</p>";
				template += "<p> Failure TEXT: "+ (rowData.results[0].text || "") +"</p>";
				template += "<p> Success TITLE: "+ (rowData.results[1].title || "") +"</p>";
				template += "<p> Success TEXT: "+ (rowData.results[1].text || "") +"</p>";
				};
				} catch (err){
					console.log("Got Err2: ", err)
				}
                template += "</div>";
                row[0].f = template;
                
                row[1] = prevRow[0];
                if (prevRow[0]) {
                    row[1] = typeof prevRow[0] == "string" ? prevRow[0] : prevRow[0].v;
                }                
                row[2] = "";

                return row;
            }
            function getNodeData(array, id) {
                var item = array.filter(function(obj) {
                    return obj.id == id;
                });

                return item[0];
            }
            function updateBranchNode(html, _class) {
                var $html = $(html);
				
                $html.addClass(_class);
                return $html.wrap('<div/>').parent().html();

            }
        }
    });
});