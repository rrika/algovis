/// <reference path="node_modules/@types/d3/index.d.ts" />
var vecAdd = function (p, q) { return [p[0] + q[0], p[1] + q[1]]; };
var vecSub = function (p, q) { return [p[0] - q[0], p[1] - q[1]]; };
var vecDot = function (p, q) { return p[0] * q[0] + p[1] * q[1]; };
var vecMul = function (p, q) { return [p[0] * q, p[1] * q]; };
var vecLength = function (p) { return Math.sqrt(p[0] * p[0] + p[1] * p[1]); };
var vecNormalize = function (p) { return vecMul(p, 1 / vecLength(p)); };
var vecRot90 = function (p) { return [-p[1], p[0]]; };
var deflateCorner = function (a, b, c, f) {
    var ab = vecNormalize(vecSub(b, a));
    var bc = vecNormalize(vecSub(c, b));
    var between = vecRot90(vecAdd(ab, bc));
    var g = vecDot(between, vecRot90(ab));
    // let h = vecDot(between, vecRot90(bc));
    return vecAdd(b, vecMul(between, f / g));
};
var deflatePolygon = function (p, f) {
    var r = [];
    var n = p.length;
    for (var i = 0; i < n; i++) {
        var a = p[i];
        var b = p[(i + 1) % n];
        var c = p[(i + 2) % n];
        r.push(deflateCorner(a, b, c, f));
    }
    return r;
};
var polygonPath = function (p) {
    var scale = 30;
    var last = p[p.length - 1];
    var letter = "M";
    var path = "";
    for (var _a = 0, p_1 = p; _a < p_1.length; _a++) {
        var point = p_1[_a];
        path += "" + letter + scale * point[0] + "," + scale * point[1];
        letter = "L";
    }
    return path + "z";
};
var linePath = function (l) {
    var scale = 30;
    return "M" + scale * l[0][0] + "," + scale * l[0][1] + "L" + scale * l[1][0] + "," + scale * l[1][1];
};
var lineShorten = function (l, n) {
    var ab = vecSub(l[1], l[0]);
    var lab = vecLength(ab);
    var i = n / lab;
    return [
        vecAdd(l[0], vecMul(ab, i)),
        vecAdd(l[1], vecMul(ab, -i))
    ];
};
var normalOn = function (l, n) {
    var midpoint = vecMul(vecAdd(l[0], l[1]), 0.5);
    var normal = vecRot90(vecNormalize(vecSub(l[1], l[0])));
    return [midpoint, vecAdd(midpoint, vecMul(normal, n))];
};
var rectPoly = function (minx, miny, maxx, maxy) { return [
    [minx, miny],
    [maxx, miny],
    [maxx, maxy],
    [minx, maxy]
]; };
var planePoly = function (_a, w, h) {
    // +      +
    //         
    //  __–––¯|
    // |      |
    // +------+
    //
    var a = _a[0], b = _a[1];
    var n = vecRot90(vecSub(a, b));
    var d = vecDot(a, n);
    var d00 = vecDot([0, 0], n) - d;
    var dw0 = vecDot([w, 0], n) - d;
    var d0h = vecDot([0, h], n) - d;
    var dwh = vecDot([w, h], n) - d;
    var r = [];
    if (d00 >= 0)
        r.push([0, 0]);
    if ((d00 >= 0) != (d0h >= 0))
        r.push([0, d / n[1]]);
    if (d0h >= 0)
        r.push([0, h]);
    if ((d0h >= 0) != (dwh >= 0))
        r.push([(d - h * n[1]) / n[0], h]);
    if (dwh >= 0)
        r.push([w, h]);
    if ((dwh >= 0) != (dw0 >= 0))
        r.push([w, (d - w * n[0]) / n[1]]);
    if (dw0 >= 0)
        r.push([w, 0]);
    if ((dw0 >= 0) != (d00 >= 0))
        r.push([d / n[0], 0]);
    if (r.length == 0)
        return [[0, 0]];
    return r;
};
var clipLine = function (_a, w, h) {
    var a = _a[0], b = _a[1];
    var n = vecRot90(vecSub(a, b));
    var d = vecDot(a, n);
    var clipSide = function (p) {
        if (p[0] < 0)
            p = [0, d / n[1]];
        if (p[1] < 0)
            p = [d / n[0], 0];
        if (p[0] > w)
            p = [w, (d - w * n[0]) / n[1]];
        if (p[1] > h)
            p = [(d - h * n[1]) / n[0], h];
        return p;
    };
    return [clipSide(a), clipSide(b)];
};
var ccp = null;
var sortByKey = function (a, k) { return a.sort(function (a, b) { return k(a) - k(b); }); };
var PathLayout;
(function (PathLayout) {
    var portalAngle = function (p, q) {
        var pdel = vecSub(p[1], p[0]);
        var qmid = vecMul(vecAdd(q[0], q[1]), 0.5);
        var qrel = vecSub(qmid, p[0]);
        var qrot = [
            vecDot(qrel, pdel),
            vecDot(qrel, vecRot90(pdel))
        ];
        return qrot[0] / qrot[1];
    };
    PathLayout.counterClockwisePortals = function (map) {
        var r = [];
        var n = map.portals.length;
        var _loop_1 = function (p) {
            var cell = map.connectivity[p][1];
            r.push(sortByKey(map.portalsExit[cell].filter(function (q) { return p != (q ^ 1); }), function (q) { return portalAngle(map.portals[p], map.portals[q]); }));
        };
        for (var p = 0; p < n; p++) {
            _loop_1(p);
        }
        return r;
    };
    var crossingScore = function (indices) {
        var score = 0;
        for (var i = 0; i < indices.length; i++) {
            for (var j = 0; j < i; j++) {
                if (indices[i] == -1)
                    continue;
                if (indices[j] == -1)
                    continue;
                if (indices[i] < indices[j])
                    score++;
            }
        }
        return score;
    };
    var monotoneScore = function (indices) {
        var score = 0;
        for (var i = 0; i < indices.length - 1; i++) {
            if (indices[i] < indices[i + 1])
                score++;
        }
        return score;
    };
    var crossingScoreTest = function () {
        console.assert(crossingScore([0, 1]) == 0);
        console.assert(crossingScore([1, 0]) == 1);
        console.assert(crossingScore([0, 0]) == 0);
        console.assert(crossingScore([0, 0, 1]) == 0);
        console.assert(crossingScore([1, 0, 0]) == 2);
        console.assert(crossingScore([1, 0, 3, 2]) == 2);
    };
    var bestInsert = function (elems, elem, evalScore) {
        var best = null;
        var bestScore = null;
        for (var i = 0; i <= elems.length; i++) {
            var copy = elems.slice();
            copy.splice(i, 0, elem);
            var score = evalScore(copy);
            if (best === null || score > bestScore) {
                best = copy;
                bestScore = score;
            }
        }
        return best;
    };
    var crossingMinimization = function (items) {
        var r = [];
        var evalScore = function (items) { return (-crossingScore(items.map(function (_a) {
            var a = _a[0], b = _a[1], c = _a[2];
            return a;
        }))
            - crossingScore(items.map(function (_a) {
                var a = _a[0], b = _a[1], c = _a[2];
                return b;
            }))
        //+monotoneScore(items.map(([a, b, c]) => c)) * 0.001
        ); };
        for (var _a = 0, items_1 = items; _a < items_1.length; _a++) {
            var item = items_1[_a];
            r = bestInsert(r, item, evalScore);
        }
        return r;
    };
    // layout[3] = [2, 5]
    // step three is the second of five crossings of its portal
    PathLayout.doLayout = function (map, path) {
        var ccp = PathLayout.counterClockwisePortals(map);
        var stepsOnEvenPortal = {};
        // false: normal crossing
        for (var i = 0; i < map.portals.length; i += 2) {
            stepsOnEvenPortal[i] = [];
        }
        for (var i = 0; i < path.length; i++) {
            var p = path[i];
            stepsOnEvenPortal[p - (p & 1)].push(i);
        }
        for (var i in ccp) {
            console.log("from", i, "see", JSON.stringify(ccp[i]));
        }
        var _loop_2 = function (i) {
            var se = stepsOnEvenPortal[i];
            if (se.length <= 1)
                return "continue";
            var ahead = ccp[i].reverse();
            var behind = ccp[i + 1];
            console.log("portal", i);
            console.log("  ahead", JSON.stringify(ahead));
            console.log("  behind", JSON.stringify(behind));
            var taskItems = se.map(function (stepIndex) {
                var o = stepIndex > 0 ? path[stepIndex - 1] : -1;
                var p = path[stepIndex];
                console.assert(i == p || (i ^ 1) == p);
                var q = stepIndex < path.length - 1 ? path[stepIndex + 1] : -1;
                var aheadSeek;
                var behindSeek;
                if (path[stepIndex] == i) { // if flipped
                    aheadSeek = o ^ 1;
                    behindSeek = q ^ 1;
                }
                else {
                    aheadSeek = q;
                    behindSeek = o;
                }
                var r = [ahead.indexOf(aheadSeek), behind.indexOf(behindSeek), stepIndex];
                console.log("    step", stepIndex, "portals", o, p, q, "->", r[1], r[0]);
                //`(${behindSeek} in ${behind}) ${r[1]} ${r[0]} (${aheadSeek} in ${ahead})`);
                return r;
            });
            //console.log(" taskItems", JSON.stringify(taskItems));
            var r_1 = crossingMinimization(taskItems);
            var newOrder = r_1.map(function (_a) {
                var _1 = _a[0], _2 = _a[1], stepIndex = _a[2];
                return stepIndex;
            });
            console.log("  newOrder", JSON.stringify(newOrder));
            stepsOnEvenPortal[i] = newOrder;
        };
        // console.log(JSON.stringify(stepsOnEvenPortal));
        for (var i = 0; i < map.portals.length; i += 2) {
            _loop_2(i);
        }
        return path.map(function (step, stepIndex) {
            var fs = stepsOnEvenPortal[step - (step & 1)];
            var flip = (step & 1) != 0;
            var p = fs.indexOf(stepIndex);
            return [flip ? fs.length - 1 - p : p, fs.length];
        });
    };
})(PathLayout || (PathLayout = {}));
;
var doubleSidedPortals = function (portals) {
    var r = [];
    for (var _a = 0, portals_1 = portals; _a < portals_1.length; _a++) {
        var p = portals_1[_a];
        r.push([p[0], p[1]]);
        r.push([p[1], p[0]]);
    }
    return r;
};
var doubleSidedConnectivity = function (connectivity) {
    var r = [];
    for (var _a = 0, connectivity_1 = connectivity; _a < connectivity_1.length; _a++) {
        var _b = connectivity_1[_a], a = _b[0], b = _b[1];
        r.push([a, b]);
        r.push([b, a]);
    }
    return r;
};
var patchEnterExit = function (map) {
    for (var i in map.cells) {
        map.portalsEnter.push([]);
        map.portalsExit.push([]);
    }
    for (var i in map.connectivity) {
        var _a = map.connectivity[i], a = _a[0], b = _a[1];
        map.portalsEnter[b].push(parseInt(i));
        map.portalsExit[a].push(parseInt(i));
    }
};
var map1 = {
    cells: [
        rectPoly(0, 0, 3, 4),
        rectPoly(3, 0, 5, 2),
        rectPoly(5, 1, 7, 4),
        rectPoly(1, 4, 3, 6),
        rectPoly(5, 4, 7, 6),
        rectPoly(7, 4, 8, 6),
        rectPoly(1, 6, 7, 8)
    ],
    portals: doubleSidedPortals([
        [[3, 2], [3, 0]],
        [[5, 2], [5, 1]],
        [[1, 4], [3, 4]],
        [[5, 4], [7, 4]],
        [[7, 6], [7, 4]],
        [[1, 6], [3, 6]],
        [[5, 6], [7, 6]]
    ]),
    connectivity: doubleSidedConnectivity([
        [0, 1],
        [1, 2],
        [0, 3],
        [2, 4],
        [4, 5],
        [3, 6],
        [4, 6]
    ]),
    portalsEnter: [],
    portalsExit: []
};
patchEnterExit(map1);
// console.log(PathLayout.counterClockwisePortals(map1));
var path = [6, 9, 8, 12, 11, 10, 13, 7, 2, 3, 6, 9, 8, 7, 2, 0, 4, 10];
var crossingPoint = function (_a, i, n, spacing) {
    var a = _a[0], b = _a[1];
    //          ,- returned point
    // a -----0-1-2-3-4-5----- b
    //          i       n
    //    spacing <->
    var ab = vecSub(b, a);
    var l = vecLength(ab);
    var nab = vecNormalize(ab);
    var bundleWidth = Math.min(Math.max(l - 2 * spacing, spacing), (n - 1) * spacing);
    var f = (l - bundleWidth) / 2 + (n > 2 ? i * (bundleWidth / (n - 1)) : 0);
    return [vecAdd(a, vecMul(nab, f)), vecRot90(nab)];
};
var scale = 30;
var sp = function (_a) {
    var x = _a[0], y = _a[1];
    return scale * x + "," + scale * y;
};
var simpleSegmentPath = function (a, na, b, nb) {
    var curveAmount = 0.3;
    var a_ = vecAdd(a, vecMul(na, curveAmount));
    var b_ = vecSub(b, vecMul(nb, curveAmount));
    return "L" + sp(a) + " C" + sp(a_) + " " + sp(b_) + " " + sp(b);
};
var curvedPortalPath = function (map, path, segmentPath) {
    var layout = PathLayout.doLayout(map, path);
    var ps = [];
    var spacing = 0.3;
    for (var i = 0; i < path.length; i++) {
        var _a = layout[i], j = _a[0], n = _a[1];
        var p = crossingPoint(map.portals[path[i]], j, n, spacing);
        ps.push(p);
    }
    var svgPath = "";
    for (var i = 0; i < ps.length; i++) {
        var _b = ps[i], curr = _b[0], currNorm = _b[1];
        if (i == 0) {
            var a = vecAdd(curr, vecMul(currNorm, deflateAmount));
            svgPath += "M" + sp(a);
        }
        else {
            var _c = ps[i - 1], prev = _c[0], prevNorm = _c[1];
            var a = vecAdd(prev, vecMul(prevNorm, deflateAmount));
            var b = vecSub(curr, vecMul(currNorm, deflateAmount));
            svgPath += segmentPath(a, prevNorm, b, currNorm);
        }
    }
    return svgPath;
};
var map = null;
var deflateAmount = 0.1;
var bundleX = function (bundle) {
    return bundle ? [
        [bundle.source[0], bundle.target[1]],
        [bundle.target[0], bundle.source[1]],
        [bundle.target[0], bundle.target[1]]
    ] : [];
};
/*let bundleLines = (sel: d3.Selection<any, any, any, any>, bundle: RayBundle) => {
    let width = 18;
    let height = 10;
    sel
        .selectAll("path")
        .data(bundleX(bundle))
        .join("path")
        .attr("stroke", "purple")
        .attr("stroke-width", "2px")
        .attr("d", line => linePath(clipLine(line, width, height)));
};*/
var portalFrontCheck = function (a, b) {
    var n = vecRot90(vecSub(a[1], a[0]));
    var d = vecDot(a[0], n);
    var p = vecDot(b[0], n);
    var q = vecDot(b[1], n);
    if (p <= d && q <= d)
        return false;
    return true;
};
var portalFlood = function (map, path, visited, front, p, limit) {
    if (!visited[p]) {
        path.push(p);
        if (path.length == limit)
            return;
        visited[p] = true;
        for (var _a = 0, _b = ccp[p]; _a < _b.length; _a++) {
            var q = _b[_a];
            //for (let q of map.portalsExit[map.connectivity[p][1]]) {
            if ((p ^ q) != 1 && front[q])
                portalFlood(map, path, visited, front, q, limit);
            if (path.length == limit)
                return;
        }
        path.push(p ^ 1);
        if (path.length == limit)
            return;
    }
};
var intersectSet = function (a, b) {
    var r = {};
    for (var i in a) {
        if (b[i])
            r[i] = true;
    }
    return r;
};
var subtractSet = function (a, b) {
    var r = {};
    for (var i in a) {
        if (b[i] === undefined)
            r[i] = true;
    }
    return r;
};
var unionSet = function (a, b) {
    var r = {};
    for (var i in a)
        r[i] = true;
    for (var i in b)
        r[i] = true;
    return r;
};
var eagerMarking = true;
var portalFlow = function (map, path, flood, cansee, confirmed, p, limit, stack, hack) {
    //let eagerMarking = true;
    //hack[p] = true;
    hack[map.connectivity[p][1]] = true;
    stack = stack.concat([p]);
    var returnValue = {
        cansee: cansee,
        stack: stack
    };
    path.push(p);
    if (path.length == limit)
        return returnValue;
    confirmed[p] = true;
    if (eagerMarking) {
        for (var _a = 0, _b = ccp[p]; _a < _b.length; _a++) {
            var q = _b[_a];
            if (cansee[q])
                confirmed[q] = true;
        }
    }
    for (var _c = 0, _d = ccp[p]; _c < _d.length; _c++) {
        var q = _d[_c];
        if (!cansee[q])
            continue;
        var qcansee = intersectSet(cansee, flood[q]);
        var qwantsee = subtractSet(qcansee, confirmed);
        if (Object.keys(qwantsee).length === 0 && (confirmed[q] === true || eagerMarking))
            continue;
        //if (hack[q]) continue;
        //if (hack[map.connectivity[q][1]]) continue;
        var xreturnValue = portalFlow(map, path, flood, qcansee, confirmed, q, limit, stack, hack);
        if (path.length == limit)
            return xreturnValue;
    }
    path.push(p ^ 1);
    return returnValue;
};
var portalFlowOuter = function (map, path, flood, cansee, confirmed, p, limit, stack) {
    var r = null;
    var nconfirmed = 0;
    while (true) {
        var hack = {};
        r = portalFlow(map, path, flood, cansee, confirmed, p, limit, stack, hack);
        return r; // classic algorithm
        if (path.length == limit)
            return r;
        var nconfirmed2 = Object.keys(confirmed).length;
        if (nconfirmed == nconfirmed2)
            break;
        nconfirmed = nconfirmed2;
    }
};
var summarizeCells = function (map, portals) {
    var cells = {};
    for (var _a = 0, portals_2 = portals; _a < portals_2.length; _a++) {
        var p = portals_2[_a];
        cells[map.connectivity[p][1]] = true;
    }
    ;
    return cells;
};
var requestForStep = function (i, step) {
    if (mode == 0) {
        var floodPath_1 = [];
        var front_1 = {};
        for (var j = 0; j < map.portals.length; j++)
            if (portalFrontCheck(map.portals[i], map.portals[j]))
                front_1[j] = true;
        var floodSet = {};
        portalFlood(map, floodPath_1, floodSet, front_1, i, step + 1);
        var canseeFrontCells_1 = summarizeCells(map, Object.keys(front_1).map(function (n) { return parseInt(n); }));
        var canseeFloodCells_1 = summarizeCells(map, Object.keys(floodSet).map(function (n) { return parseInt(n); }));
        return {
            map: map,
            cellClass: map.cells.map(function (_, j) {
                return (canseeFloodCells_1[j] ? "confirmed " : "") +
                    (canseeFrontCells_1[j] ? "cansee " : "cantsee ") +
                    "cell";
            }),
            portalClass: map.portals.map(function (_, j) {
                return (i == j ? "entry " : "") +
                    (front_1[j] ? "flood_cansee " : "flood_cantsee ") +
                    (floodPath_1.slice(0, step + 1).indexOf(j) != -1 ? "confirmed " : "black ") +
                    "portal";
            }),
            path: floodPath_1.slice(0, step + 1),
            stack: [i]
        };
    }
    else {
        var flood_1 = {};
        var front = {};
        for (var k = 0; k < map.portals.length; k++) {
            front[k] = {};
            for (var j = 0; j < map.portals.length; j++)
                if (portalFrontCheck(map.portals[k], map.portals[j]))
                    front[k][j] = true;
            flood_1[k] = {};
            portalFlood(map, [], flood_1[k], front[k], k, -1);
        }
        var flowPath = [];
        var confirmed_1 = {};
        var flowState = portalFlowOuter(map, flowPath, flood_1, flood_1[i], confirmed_1, i, step + 1, []);
        var canseeFlow_1 = flowState.cansee;
        var stack_1 = flowState.stack;
        var truncatedPath = flowPath.slice(0, step + 1);
        var canseeFloodCells = summarizeCells(map, Object.keys(flood_1[i]).map(function (n) { return parseInt(n); }));
        var canseeFlowCells_1 = summarizeCells(map, Object.keys(canseeFlow_1).map(function (n) { return parseInt(n); }));
        var confirmedCells_1 = summarizeCells(map, Object.keys(confirmed_1).map(function (n) { return parseInt(n); }));
        var first_portal = i;
        var last_portal = flowPath[flowPath.length - 1];
        var first_cell = map.connectivity[first_portal][0];
        var last_cell = map.connectivity[last_portal][1];
        var adjacentToLastCell_1 = {};
        for (var _a = 0, _b = map.portalsExit[last_cell]; _a < _b.length; _a++) {
            var p = _b[_a];
            if (p != (last_portal ^ 1))
                adjacentToLastCell_1[map.connectivity[p][1]] = true;
        }
        var lastCellToHighlightCellPortal_1 = null;
        for (var _c = 0, _d = map.portalsExit[last_cell]; _c < _d.length; _c++) {
            var r_2 = _d[_c];
            if (map.connectivity[r_2][1] == highlightCell)
                lastCellToHighlightCellPortal_1 = r_2;
        }
        var highlightCells_1 = lastCellToHighlightCellPortal_1 !== null
            ? summarizeCells(map, Object.keys(flood_1[lastCellToHighlightCellPortal_1]).map(function (n) { return parseInt(n); }))
            : {};
        if (lastCellToHighlightCellPortal_1 !== null) {
            path.push(lastCellToHighlightCellPortal_1);
            stack_1.push(lastCellToHighlightCellPortal_1);
            last_portal = lastCellToHighlightCellPortal_1;
        }
        var bundle = {
            source: map.portals[first_portal],
            target: map.portals[last_portal]
        };
        return {
            map: map,
            cellClass: map.cells.map(function (_, i) {
                return (adjacentToLastCell_1[i] ? "next " : "") +
                    (lastCellToHighlightCellPortal_1 !== null && highlightCells_1[i] ? "nextflood " : "") +
                    (lastCellToHighlightCellPortal_1 !== null && !highlightCells_1[i] ? "cantsee " : "") +
                    (confirmedCells_1[i] ? "confirmed " : "") +
                    (!confirmedCells_1[i] && canseeFlowCells_1[i] ? "todo " : "") +
                    (canseeFlowCells_1[i] ? "cansee " : "cantsee ") +
                    "cell";
            }),
            portalClass: map.portals.map(function (_, j) {
                return (confirmed_1[j] ? "confirmed " : "") +
                    (!confirmed_1[j] && flood_1[i][j] ? "todo " : "") +
                    (canseeFlow_1[j] ? "cansee " : "cantsee ") +
                    (stack_1.indexOf(j) != -1 ? "onstack " : "") +
                    "portal";
            }),
            path: truncatedPath,
            stack: stack_1,
            bundle: bundle
        };
    }
};
var cells_tg;
var portals_tg;
var paths_tg;
var plane_tg;
var bundle_tg;
var highlightPortal = null;
var highlightCell = null;
var handlePortalMouseOver = function (d, i) {
    //console.log(d, i);
    highlightPortal = d[1];
    update_r();
    build(r);
};
var handlePortalMouseLeave = function (d, i) {
    highlightPortal = null;
    update_r();
    build(r);
};
var handleCellMouseOver = function (d, i) {
    highlightCell = i;
    update_r();
    build(r);
};
var handleCellMouseLeave = function (d, i) {
    highlightCell = null;
    update_r();
    build(r);
};
var newCenters = function () {
    var width = 18;
    var height = 10;
    var radius = 0.5;
    return d3.range(45).map(function (i) { return ([
        Math.random() * (width - radius * 2) + radius,
        Math.random() * (height - radius * 2) + radius,
        Math.random() > 0.4,
        i
    ]); });
};
var gf = -0.5;
var gcenters = newCenters();
var voronoiMap = function () {
    var width = 18;
    var height = 10;
    var radius = 0.5;
    //let centers: Center[] = gcenters;
    var centers = newCenters();
    var f = gf;
    var relaxation = 3;
    while (relaxation--) {
        // try to make all triangles have sides of equal length
        var voronoiConstructor_1 = d3.voronoi();
        voronoiConstructor_1.extent([[0, 0], [width, height]]);
        var voronoi_1 = voronoiConstructor_1(centers);
        for (var _a = 0, _b = voronoi_1.triangles(); _a < _b.length; _a++) {
            var vorTri = _b[_a];
            var a = vorTri[0][3];
            var b = vorTri[1][3];
            var c = vorTri[2][3];
            var pa = [centers[a][0], centers[a][1]];
            var pb = [centers[b][0], centers[b][1]];
            var pc = [centers[c][0], centers[c][1]];
            var dab = vecSub(pa, pb);
            var dbc = vecSub(pb, pc);
            var dca = vecSub(pc, pa);
            var lab = vecLength(dab);
            var lbc = vecLength(dbc);
            var lca = vecLength(dca);
            var l = (lab + lbc + lca) / 3; // the "ideal length"
            var sab = (l - lab) * f / lab;
            var sbc = (l - lbc) * f / lbc;
            var sca = (l - lca) * f / lca;
            dab = vecMul(dab, sab);
            dbc = vecMul(dbc, sbc);
            dca = vecMul(dca, sca);
            var npa = vecAdd(pa, vecSub(dca, dab));
            var npb = vecAdd(pb, vecSub(dab, dbc));
            var npc = vecAdd(pc, vecSub(dbc, dca));
            centers[a] = [npa[0], npa[1], centers[a][2], centers[a][3]];
            centers[b] = [npb[0], npb[1], centers[b][2], centers[b][3]];
            centers[c] = [npc[0], npc[1], centers[c][2], centers[c][3]];
        }
    }
    var voronoiConstructor = d3.voronoi();
    voronoiConstructor.extent([[0, 0], [width, height]]);
    var voronoi = voronoiConstructor(centers);
    var wallReassignment = true;
    if (wallReassignment) {
        // 1. mark a high degree node as wall
        // 2. mark its neighbours as non-wall
        // 3. repeat
        var neighbours = {};
        var numNeighbours = {};
        for (var i_1 = 0; i_1 < centers.length; i_1++) {
            neighbours[i_1] = [];
            numNeighbours[i_1] = 0;
        }
        for (var _c = 0, _d = voronoi.edges; _c < _d.length; _c++) {
            var vorEdge = _d[_c];
            if (!vorEdge || vorEdge.right === undefined)
                continue;
            var l = vorEdge.left.index;
            var r_3 = vorEdge.right.index;
            neighbours[l].push(r_3);
            neighbours[r_3].push(l);
            numNeighbours[l]++;
            numNeighbours[r_3]++;
        }
        var wall = {};
        for (var i_2 = 0; i_2 < centers.length; i_2++) {
            var k = null;
            var kadj = 0;
            for (var j = 0; j < centers.length; j++) {
                if (wall[j] !== undefined)
                    continue;
                if (kadj < numNeighbours[j]) {
                    k = j;
                    kadj = numNeighbours[j];
                }
            }
            if (k === null)
                break;
            wall[k] = false;
            for (var _e = 0, _f = neighbours[k]; _e < _f.length; _e++) {
                var j = _f[_e];
                numNeighbours[j]--;
                if (Math.random() < 0.3)
                    wall[j] = true;
            }
        }
        for (var i_3 = 0; i_3 < centers.length; i_3++) {
            centers[i_3][2] = wall[i_3];
        }
    }
    console.log(centers);
    var cells = [];
    var portals = [];
    var connectivity = [];
    var i = 0;
    var remap = {};
    for (var _g = 0, _h = voronoi.polygons(); _g < _h.length; _g++) {
        var poly = _h[_g];
        if (poly && centers[i][2]) {
            remap[i] = cells.length;
            var p = poly.map(function (c) { return c; });
            p.reverse();
            cells.push(p);
        }
        i += 1;
    }
    for (var _j = 0, _k = voronoi.edges; _j < _k.length; _j++) {
        var vorEdge = _k[_j];
        if (!vorEdge || vorEdge.right === undefined)
            continue;
        if (vorEdge.left.data[2] && vorEdge.right.data[2]) {
            if (vecLength(vecSub(vorEdge[1], vorEdge[0])) < 0.5)
                continue;
            portals.push([vorEdge[1], vorEdge[0]]);
            console.log(vorEdge.left, vorEdge.right);
            connectivity.push([
                remap[vorEdge.right.index],
                remap[vorEdge.left.index]
            ]);
        }
    }
    console.log("cells", cells);
    console.log("portals", portals);
    console.log("connectivity", connectivity);
    return {
        cells: cells,
        portals: doubleSidedPortals(portals),
        connectivity: doubleSidedConnectivity(connectivity),
        portalsEnter: [],
        portalsExit: []
    };
};
var build = function (r) {
    var cells_g = cells_tg
        .selectAll("path")
        .data(r.map.cells)
        .join(function (enter) {
        return enter
            .append("path")
            .on("mouseover", handleCellMouseOver)
            .on("mouseleave", handleCellMouseLeave);
    });
    var portals_g = portals_tg
        .selectAll("g")
        .data(r.map.portals)
        .join("g");
    var paths_g = paths_tg
        .selectAll("path")
        .data([r.path])
        .join("path");
    var cellHover = function (i) {
        if (highlightCell == i)
            return true;
        if (highlightPortal && r.map.connectivity[highlightPortal][1] == i)
            return true;
        return false;
    };
    cells_g
        //.attr("fill", "#eee")
        .attr("class", function (_, i) { return r.cellClass[i] + (cellHover(i) ? " hovered" : ""); })
        .attr("stroke-width", 2)
        .attr("stroke", "#888")
        .attr("d", function (poly) { return polygonPath(deflatePolygon(poly, deflateAmount)); });
    var p01 = portals_g
        .selectAll("path")
        .data(function (p, i) { return [[p, i, 0], [p, i, 1]]; })
        .join(function (enter) {
        return enter
            .append("path")
            .on("mouseover", handlePortalMouseOver)
            .on("mouseleave", handlePortalMouseLeave);
    });
    p01.filter(function (_a) {
        var p = _a[0], i = _a[1], m = _a[2];
        return m == 0;
    })
        .attr("class", function (_a) {
        var p = _a[0], i = _a[1], m = _a[2];
        return r.portalClass[i] + " main";
    })
        .attr("d", function (_a) {
        var p = _a[0], _i = _a[1], _m = _a[2];
        return linePath(lineShorten(p, deflateAmount));
    });
    p01.filter(function (_a) {
        var p = _a[0], i = _a[1], m = _a[2];
        return m == 1;
    })
        .attr("class", function (_a) {
        var p = _a[0], i = _a[1], m = _a[2];
        return r.portalClass[i] + " normal";
    })
        .attr("d", function (_a) {
        var p = _a[0], _i = _a[1], _m = _a[2];
        return linePath(normalOn(p, 0.5));
    });
    /*
      portals_g.join("text")
          .attr("fill", "black")
          // .attr("stroke-width", 1)
          .attr("stroke", "transparent")
          .attr("text-anchor", "middle")
          .attr("alignment-baseline", "middle")
          .attr("stroke", (_, i) => r.portalClass[i])
          //.text((p, index) => `${map.connectivity[index][0]}`)
          .text((p, index) => `${index}`)
          .attr("x", line => 30*normalOn(line, 0.5)[1][0])
          .attr("y", line => 30*normalOn(line, 0.5)[1][1])
          ;
    */
    paths_g
        .attr("fill", "transparent")
        .attr("stroke-width", 2)
        .attr("stroke", "blue")
        .attr("d", function (path) { return curvedPortalPath(map, path, simpleSegmentPath); });
    /*
        .attr("fill-opacity", 0.2)
          .attr("transform", d => `translate(${x((d.x0 + d.x1) / 2)},0)`)
        .selectAll("circle")
        .data(d => d.outliers)
        .join("circle")
          .attr("r", 2)
          .attr("cx", () => (Math.random() - 0.5) * 4)
          .attr("cy", d => y(d.y));
    */
    var plane_g = plane_tg
        .selectAll("path")
        .data(r.stack)
        .join("path");
    plane_g
        .attr("fill", "#000")
        .attr("d", function (i) { return polygonPath(planePoly(map.portals[i], 18, 10)); });
    var bundle_g = bundle_tg
        .selectAll("path")
        .data(bundleX(r.bundle))
        .join("path");
    bundle_g
        .attr("fill", "purple")
        .attr("d", function (l) { return polygonPath(planePoly(l, 18, 10)); });
    // bundleLines(bundle_tg, r.bundle);
};
var counter = 0;
var mode = 0;
var r = null;
var update_r = function () {
    var start = parseInt(document.getElementById("start").value);
    if (start >= map.portals.length)
        start = map.portals.length - 1;
    r = requestForStep(start, counter);
};
var reset_flood = function () {
    counter = 0;
    mode = 0;
    update_r();
    build(r);
};
var reset_flow = function () {
    counter = 0;
    mode = 1;
    update_r();
    build(r);
};
var retreat = function () {
    if (counter)
        counter -= 1;
    update_r();
    build(r);
};
var advance = function () {
    counter += 1;
    update_r();
    build(r);
};
var animate = function (time) {
    update_r();
    // r.time = time;
    build(r);
    window.requestAnimationFrame(animate);
};
var setMap1 = function () {
    map = map1;
    ccp = PathLayout.counterClockwisePortals(map);
    counter = 0;
    update_r();
    build(r);
};
var setMapVoronoi = function () {
    map = voronoiMap();
    patchEnterExit(map);
    ccp = PathLayout.counterClockwisePortals(map);
    counter = 0;
    update_r();
    build(r);
};
var checkbox = function (id) {
    var elem = document.getElementById(id);
    return elem && elem.checked;
};
var algorithmSettings = function () {
    eagerMarking = checkbox("eager");
    update_r();
    build(r);
};
var visSettings = function () {
    bundle_tg.attr("opacity", checkbox("winding_shadow") ? 0.3 : 0.0);
    plane_tg.attr("opacity", checkbox("stack_shadow") ? 0.3 : 0.0);
    update_r();
    build(r);
};
var codeVisible = false;
var toggleCode = function () {
    codeVisible = !codeVisible;
    document.getElementById("pseudocode").className =
        codeVisible ? "" : "hidden";
};
var init = function () {
    var svg = d3.select("svg");
    cells_tg = svg.append("g");
    paths_tg = svg.append("g");
    bundle_tg = svg.append("g")
        .attr("opacity", 0)
        .attr("pointer-events", "none");
    plane_tg = svg.append("g")
        .attr("opacity", 0)
        .attr("pointer-events", "none");
    portals_tg = svg.append("g");
    document.getElementById("reset_flood").addEventListener("click", reset_flood);
    document.getElementById("reset_flow").addEventListener("click", reset_flow);
    document.getElementById("prev").addEventListener("click", retreat);
    document.getElementById("next").addEventListener("click", advance);
    document.getElementById("map1").addEventListener("click", setMap1);
    document.getElementById("mapvor").addEventListener("click", setMapVoronoi);
    document.getElementById("toggleCode").addEventListener("click", toggleCode);
    document.getElementById("eager").addEventListener("change", algorithmSettings);
    document.getElementById("stack_shadow").addEventListener("change", visSettings);
    document.getElementById("winding_shadow").addEventListener("change", visSettings);
    mode = 0;
    setMap1();
    //window.requestAnimationFrame(animate);
};
window.addEventListener("load", init);
