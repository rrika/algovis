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
    dpad: 6,
    tasks: [
        { est: 0, lct: 5, p: 1, c: 3, row: 3 },
        { est: 2, lct: 5, p: 3, c: 1, row: 2 },
        { est: 2, lct: 5, p: 2, c: 2, row: 0 },
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
var updateTasks = function (s, T) {
    var taskSel = s.selectAll("path").data(T.tasks).join("path");
    taskSel
        .attr("fill", "transparent")
        .attr("stroke", "black")
        .attr("stroke-width", "1px")
        .attr("d", function (t) { return taskBracketsPath(t, t.row, T.scale); });
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
var fixedTriangle = null;
var focusTriangle = null;
var taskGroup = null;
var update = function () {
    updateFocus(focusTriangle, t);
    updateTasks(taskGroup, t);
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
    taskGroup = svg.append("g");
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
    taskGroup.append("path")
        .attr("fill", "transparent")
        .attr("stroke", "black")
        .attr("stroke-width", "2px")
        .attr("d", "M0," + s * 0.5 + "L0," + s * t.dpad + "L" + s * t.tspan + "," + s * t.dpad + "L" + s * t.tspan + "," + s * 0.5 + "Z" +
        ("M0," + s * 0.5 + "L" + s * t.tspan + "," + s * t.dpad) +
        ("M0," + s * t.dpad + "L" + s * t.tspan + "," + s * 0.5));
    svg.on("mousemove", mousemove);
    svg.on("mouseleave", mouseleave);
    update();
};
window.addEventListener("load", cumulative_init);
