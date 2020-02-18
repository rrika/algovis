/// <reference path="node_modules/@types/d3/index.d.ts" />
var fitTriangle = function (t, w, h) {
    /*  |        |
      --+-------,+.
        |     ,´   `.
        |   ,´       `+--
        | ,´
      --+´
         `.
           `.
            |
    */
    var dpad2 = t.dpad * 1; //Math.sqrt(2);
    var uw = t.xpad + t.tspan + dpad2 + t.xpad;
    var uh = t.ypad + t.tspan + dpad2 + t.ypad;
    var scale = Math.min(w / uw, h / uh);
    t.scale = scale;
    t.xorigin = (w - uw * scale) / 2;
    t.yorigin = (h - uh * scale) / 2;
};
var xyTriangle = function (t, x, y) {
    return t.xorigin + t.scale * (t.xpad + x) + "," + (t.yorigin + t.scale * (t.ypad + y));
};
var t = {
    tspan: 10,
    xpad: 1,
    ypad: 1,
    dpad: 8,
    tasks: [
        { est: 0, lct: 5, p: 1, c: 3, row: 5 },
        { est: 2, lct: 5, p: 3, c: 1, row: 4 },
        { est: 2, lct: 5, p: 2, c: 2, row: 2 },
        { est: 0, lct: 10, p: 3, c: 2, row: 0 }
    ]
};
fitTriangle(t, 540, 300);
var updateFocus = function (s, t) {
    if (t.focus_est !== undefined) {
        var path_1 = s.selectAll("path").data([null]).join("path");
        var a = xyTriangle(t, t.focus_est, t.tspan - t.focus_est);
        var b = xyTriangle(t, t.focus_est, t.tspan - t.focus_lct);
        var c = xyTriangle(t, t.focus_lct, t.tspan - t.focus_lct);
        path_1
            .attr("fill", "rgba(0, 0, 0, 0.2)")
            .attr("stroke", "black")
            .attr("stroke-width", "1px")
            .attr("d", "M" + a + "L" + b + "L" + c);
    }
    else {
        s.selectAll("path").data([]).join("path");
    }
};
var updateTasks = function (spots, brackets, blocks, T) {
    var circles = spots.selectAll("circle").data(T.tasks).join("circle");
    circles.attr("cx", function (t) { return T.xorigin + T.scale * (T.xpad + t.est); });
    circles.attr("cy", function (t) { return T.yorigin + T.scale * (T.ypad + T.tspan - t.lct); });
    circles.attr("r", "2.5px");
    circles.attr("stroke", "black");
    circles.attr("stroke-width", "1px");
    circles.attr("fill", "transparent");
    var bracketSel = brackets.selectAll("path").data(T.tasks).join("path");
    bracketSel
        .attr("fill", "transparent")
        .attr("stroke", "black")
        .attr("d", function (t) { return taskBracketsPath(t, t.row, T.scale * Math.sqrt(2)); });
    if (T.focus_est === undefined)
        bracketSel.attr("stroke-width", "1px");
    else
        bracketSel.attr("stroke-width", function (t) {
            return T.focus_est <= t.est && t.lct <= T.focus_lct ? "2px" : "1px";
        });
    var blockSel = blocks.selectAll("path").data(T.tasks).join("path");
    blockSel
        .attr("stroke", "none")
        .attr("d", function (t) { return taskBlockPath(t, t.row, t.lct - t.est - t.p, T.scale * Math.sqrt(2)); });
    if (T.focus_est === undefined)
        blockSel.attr("fill", "gray");
    else
        blockSel.attr("fill", function (t) {
            return T.focus_est <= t.est && t.lct <= T.focus_lct ? "black" : "gray";
        });
};
var taskBracketsPath = function (t, row, scale) {
    var o = -2;
    var r = 2;
    var row1 = row;
    var row2 = row + t.c;
    return ("M" + (scale * t.est + r) + "," + (scale * row1 - o) +
        ("L" + scale * t.est + "," + (scale * row1 - o)) +
        ("L" + scale * t.est + "," + (scale * row2 + o)) +
        ("L" + (scale * t.est + r) + "," + (scale * row2 + o)) +
        ("M" + (scale * t.lct - r) + "," + (scale * row1 - o)) +
        ("L" + scale * t.lct + "," + (scale * row1 - o)) +
        ("L" + scale * t.lct + "," + (scale * row2 + o)) +
        ("L" + (scale * t.lct - r) + "," + (scale * row2 + o)));
};
var taskBlockPath = function (t, row, relstart, scale) {
    var p = 3;
    var col1 = t.est + relstart;
    var col2 = t.est + relstart + t.p;
    var row1 = row;
    var row2 = row + t.c;
    return ("M" + (scale * col1 + p) + "," + (scale * row1 + p) +
        ("L" + (scale * col1 + p) + "," + (scale * row2 - p)) +
        ("L" + (scale * col2 - p) + "," + (scale * row2 - p)) +
        ("L" + (scale * col2 - p) + "," + (scale * row1 + p)) +
        "Z");
};
var fixedTriangle = null;
var focusTriangle = null;
var taskSpots = null;
var taskGroup = null;
var taskBrackets = null;
var taskBlocks = null;
var update = function () {
    updateFocus(focusTriangle, t);
    updateTasks(taskSpots, taskBrackets, taskBlocks, t);
};
var mousedown = function (datum, index) {
    var e = d3.event;
    // let x = (e.offsetX - t.xorigin) / t.scale - t.xpad;
    // let y = (e.offsetY - t.yorigin) / t.scale - t.ypad;
    t.igrab = index;
    t.xgrab = e.offsetX;
    t.ygrab = e.offsetY;
};
var mouseup = function (datum, index) {
    delete t.igrab;
    delete t.xgrab;
    delete t.ygrab;
};
var mousemove = function (datum, index) {
    var e = d3.event;
    var x = (e.offsetX - t.xorigin) / t.scale - t.xpad;
    var y = (e.offsetY - t.yorigin) / t.scale - t.ypad;
    if (x + y > t.tspan) {
        delete t.focus_est;
        delete t.focus_lct;
    }
    else {
        t.focus_est = Math.max(0, x);
        t.focus_lct = t.tspan - Math.max(0, y);
    }
    update();
};
var mouseleave = function (datum, index) {
    delete t.focus_est;
    delete t.focus_lct;
    update();
};
var cumulative_init = function () {
    var svg = d3.select("svg");
    fixedTriangle = svg.append("path");
    focusTriangle = svg.append("g");
    taskSpots = svg.append("g");
    taskGroup = svg.append("g");
    taskBrackets = taskGroup.append("g");
    taskBlocks = taskGroup.append("g");
    //
    var x = t.xorigin + t.scale * t.xpad;
    var y = t.yorigin + t.scale * t.ypad;
    var v = t.scale * t.tspan;
    fixedTriangle
        .attr("fill", "transparent")
        .attr("stroke", "black")
        .attr("stroke-width", "2px")
        .attr("d", "M" + x + "," + y + "L" + x + "," + (y + v) + "L" + (x + v) + "," + y + "Z");
    //
    var tr1 = svg.node().createSVGTransform();
    var tr2 = svg.node().createSVGTransform();
    tr1.setTranslate(t.xorigin + t.scale * t.xpad, t.yorigin + t.scale * (t.ypad + t.tspan));
    tr2.setRotate(-45, 0, 0);
    var transformList = taskGroup.node().transform.baseVal;
    transformList.appendItem(tr1);
    transformList.appendItem(tr2);
    var s = t.scale * Math.sqrt(2);
    taskBlocks.on("mousedown", mousedown);
    svg.on("mouseup", mouseup);
    svg.on("mousemove", mousemove);
    svg.on("mouseleave", mouseleave);
    update();
};
window.addEventListener("load", cumulative_init);
