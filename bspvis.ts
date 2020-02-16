/// <reference path="node_modules/@types/d3/index.d.ts" />

type Point = [number, number];
type Polygon = Point[];
type Line = [Point, Point];

let vecAdd = (p: Point, q: Point) : Point => [p[0]+q[0], p[1]+q[1]];
let vecSub = (p: Point, q: Point) : Point => [p[0]-q[0], p[1]-q[1]];
let vecDot = (p: Point, q: Point) : number => p[0]*q[0] + p[1]*q[1];
let vecMul = (p: Point, q: number) : Point => [p[0]*q, p[1]*q];
let vecLength = (p: Point) : number => Math.sqrt(p[0]*p[0] + p[1]*p[1]);
let vecNormalize = (p: Point) : Point => vecMul(p, 1/vecLength(p));
let vecRot90 = (p: Point) : Point => [-p[1], p[0]];

let deflateCorner = (a: Point, b: Point, c: Point, f: number) => {
	let ab: Point = vecNormalize(vecSub(b, a));
	let bc: Point = vecNormalize(vecSub(c, b));
	let between = vecRot90(vecAdd(ab, bc));
	let g = vecDot(between, vecRot90(ab));
	// let h = vecDot(between, vecRot90(bc));
	return vecAdd(b, vecMul(between, f/g));
};

let deflatePolygon = (p: Polygon, f: number) => {
	let r: Point[] = [];
	let n = p.length;
	for (let i = 0; i < n; i++) {
		let a = p[i];
		let b = p[(i+1) % n];
		let c = p[(i+2) % n];
		r.push(deflateCorner(a, b, c, f));
	} 
	return r;
};

let polygonPath = (p: Polygon) => {
	let scale = 30;
	let last = p[p.length-1];
	let letter = "M";
	let path = "";
	for (let point of p) {
		path += `${letter}${scale*point[0]},${scale*point[1]}`;
		letter = "L";
	}
	return path + "z";
};

let linePath = (l: Line) => {
	let scale = 30;
	return `M${scale*l[0][0]},${scale*l[0][1]}L${scale*l[1][0]},${scale*l[1][1]}`;
};

let lineShorten = (l: Line, n: number) : Line => {
	let ab = vecSub(l[1], l[0]);
	let lab = vecLength(ab);
	let i = n / lab;
	return [
		vecAdd(l[0], vecMul(ab, i)),
		vecAdd(l[1], vecMul(ab, -i))
	];
};

let normalOn = (l: Line, n: number) : Line => {
	let midpoint = vecMul(vecAdd(l[0], l[1]), 0.5);
	let normal = vecRot90(vecNormalize(vecSub(l[1], l[0])));
	return [midpoint, vecAdd(midpoint, vecMul(normal, n))];
};

let rectPoly = (minx: number, miny: number, maxx: number, maxy: number) : Polygon => [
	[minx, miny],
	[maxx, miny],
	[maxx, maxy],
	[minx, maxy]
];

let planePoly = ([a, b]: Line, w: number, h: number) : Point[] => {
	// +      +
	//         
	//  __–––¯|
	// |      |
	// +------+
	//

	let n = vecRot90(vecSub(a, b));
	let d = vecDot(a, n);
	let d00 = vecDot([0, 0], n) - d;
	let dw0 = vecDot([w, 0], n) - d;
	let d0h = vecDot([0, h], n) - d;
	let dwh = vecDot([w, h], n) - d;

	let r = [];
	if (d00 >= 0) r.push([0, 0]);
	if ((d00 >= 0) != (d0h >= 0)) r.push([0, d / n[1]]);
	if (d0h >= 0) r.push([0, h]);
	if ((d0h >= 0) != (dwh >= 0)) r.push([(d-h*n[1]) / n[0], h]);
	if (dwh >= 0) r.push([w, h]);
	if ((dwh >= 0) != (dw0 >= 0)) r.push([w, (d-w*n[0]) / n[1]]);
	if (dw0 >= 0) r.push([w, 0]);
	if ((dw0 >= 0) != (d00 >= 0)) r.push([d / n[0], 0]);

	if (r.length == 0)
		return [[0, 0]];

	return r;
};

let clipLine = ([a, b]: Line, w: number, h: number) : Line => {

	let n = vecRot90(vecSub(a, b));
	let d = vecDot(a, n);

	let clipSide = (p: Point) => {
		if (p[0] < 0)
			p = [0, d / n[1]];
		if (p[1] < 0)
			p = [d / n[0], 0];
		if (p[0] > w)
			p = [w, (d-w*n[0]) / n[1]];
		if (p[1] > h)
			p = [(d-h*n[1]) / n[0], h];
		return p;
	};
	return [clipSide(a), clipSide(b)];
};

type VisMap = {
	cells:        Polygon[],
	portals:      Line[],
	connectivity: [number, number][],
	portalsEnter: number[][]
	portalsExit:  number[][]
};

let ccp: number[][] = null;

let sortByKey = <T>(a: T[], k: (t: T) => number) => a.sort((a, b) => k(a)-k(b));

namespace PathLayout {


	let portalAngle = (p: Line, q: Line) : number => {
		let pdel = vecSub(p[1], p[0]);
		let qmid = vecMul(vecAdd(q[0], q[1]), 0.5);
		let qrel = vecSub(qmid, p[0]);
		let qrot = [
			vecDot(qrel, pdel),
			vecDot(qrel, vecRot90(pdel))
		];
		return qrot[0] / qrot[1];
	};

	export let counterClockwisePortals = (map: VisMap) : number[][] => {
		let r = [];
		let n = map.portals.length;
		for (let p=0; p<n; p++) {
			let cell: number = map.connectivity[p][1];
			r.push(sortByKey(map.portalsExit[cell].filter((q) => p!=(q^1)),
				(q) => portalAngle(map.portals[p], map.portals[q])
			));
		}
		return r;
	};

	let crossingScore = (indices: number[]) : number => {
		let score = 0;
		for (let i = 0; i < indices.length; i++) {
			for (let j = 0; j < i; j++) {
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

	let monotoneScore = (indices: number[]) : number => {
		let score = 0;
		for (let i = 0; i < indices.length-1; i++) {
			if (indices[i] < indices[i+1])
				score++;
		}
		return score;
	};

	let crossingScoreTest = () => {
		console.assert(crossingScore([0, 1]) == 0);
		console.assert(crossingScore([1, 0]) == 1);
		console.assert(crossingScore([0, 0]) == 0);
		console.assert(crossingScore([0, 0, 1]) == 0);
		console.assert(crossingScore([1, 0, 0]) == 2);
		console.assert(crossingScore([1, 0, 3, 2]) == 2);
	};

	let bestInsert = <T>(elems: T[], elem: T, evalScore: (elems: T[]) => number) : T[] => {
		let best: T[] = null;
		let bestScore = null;
		for (let i = 0; i <= elems.length; i++) {
			let copy = elems.slice();
			copy.splice(i, 0, elem);
			let score = evalScore(copy);
			if (best === null || score > bestScore) {
				best = copy;
				bestScore = score;
			}
		}
		return best;
	};

	let crossingMinimization = (items: [number, number, number][]) : [number, number, number][] => {
		let r = [];
		let evalScore = (items: [number, number, number][]) => (
			-crossingScore(items.map(([a, b, c]) => a))
			-crossingScore(items.map(([a, b, c]) => b))
			//+monotoneScore(items.map(([a, b, c]) => c)) * 0.001
		);
		for (let item of items) {
			r = bestInsert(r, item, evalScore);
		}
		return r;
	};

	type AbstractLayout = [number, number][];
		// layout[3] = [2, 5]
		// step three is the second of five crossings of its portal

	export let doLayout = (map: VisMap, path: number[]) : AbstractLayout => {

		let ccp = counterClockwisePortals(map);
		let stepsOnEvenPortal: {[portal: number]: number[]} = {};
			// false: normal crossing
		for (let i=0; i < map.portals.length; i+=2) {
			stepsOnEvenPortal[i] = [];
		}
		for (let i=0; i < path.length; i++){
			let p = path[i];
			stepsOnEvenPortal[p - (p&1)].push(i);
		}
		for (let i in ccp) {
			console.log("from", i, "see", JSON.stringify(ccp[i]));
		}
		// console.log(JSON.stringify(stepsOnEvenPortal));
		for (let i=0; i < map.portals.length; i+=2) {
			let se = stepsOnEvenPortal[i];
			if (se.length <= 1)
				continue;
			
			let ahead = ccp[i].reverse();
			let behind = ccp[i+1];
			console.log("portal", i);
			console.log("  ahead", JSON.stringify(ahead));
			console.log("  behind", JSON.stringify(behind));
			let taskItems: [number, number, number][] = se.map((stepIndex: number) => {
				let o = stepIndex > 0 ? path[stepIndex-1] : -1;
				let p = path[stepIndex];
				console.assert(i == p || (i^1) == p);
				let q = stepIndex < path.length-1 ? path[stepIndex+1] : -1;
				let aheadSeek: number;
				let behindSeek: number;
				if (path[stepIndex] == i) { // if flipped
					aheadSeek = o^1;
					behindSeek = q^1;
				} else {
					aheadSeek = q;
					behindSeek = o;
				}
				let r: [number, number, number] = [ahead.indexOf(aheadSeek), behind.indexOf(behindSeek), stepIndex];
				console.log("    step", stepIndex, "portals", o, p, q, "->",
					r[1], r[0]);
					//`(${behindSeek} in ${behind}) ${r[1]} ${r[0]} (${aheadSeek} in ${ahead})`);
				return r;
			});
			//console.log(" taskItems", JSON.stringify(taskItems));
			let r = crossingMinimization(taskItems);
			let newOrder = r.map(([_1, _2, stepIndex]) => stepIndex);
			console.log("  newOrder", JSON.stringify(newOrder));
			stepsOnEvenPortal[i] = newOrder;
		}
		return path.map((step, stepIndex) => {
			let fs = stepsOnEvenPortal[step - (step&1)];
			let flip = (step&1) != 0;
			let p = fs.indexOf(stepIndex);
			return [flip ? fs.length-1-p : p, fs.length];
		});
	};
};

let doubleSidedPortals = (portals: Line[]) : Line[] => {
	let r: Line[] = [];
	for (let p of portals) {
		r.push([p[0], p[1]]);
		r.push([p[1], p[0]]);
	}
	return r;
};

let doubleSidedConnectivity = (connectivity: [number, number][]) => {
	let r: [number, number][] = [];
	for (let [a, b] of connectivity) {
		r.push([a, b]);
		r.push([b, a]);
	}
	return r;
};

let patchEnterExit = (map: VisMap) => {
	for (let i in map.cells) {
		map.portalsEnter.push([]);
		map.portalsExit.push([]);
	}
	for (let i in map.connectivity) {
		let [a, b] = map.connectivity[i];
		map.portalsEnter[b].push(parseInt(i));
		map.portalsExit[a].push(parseInt(i));
	}
};

let map1: VisMap = {
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
	portalsEnter: [] as number[][],
	portalsExit: [] as number[][]
};

patchEnterExit(map1);
// console.log(PathLayout.counterClockwisePortals(map1));

let path: number[] = [6, 9, 8, 12, 11, 10, 13, 7, 2, 3, 6, 9, 8, 7, 2, 0, 4, 10];

let crossingPoint = ([a, b]: Line, i: number, n: number, spacing: number) : [Point, Point] => {
	//          ,- returned point
	// a -----0-1-2-3-4-5----- b
	//          i       n
	//    spacing <->
	let ab = vecSub(b, a);
	let l = vecLength(ab);
	let nab = vecNormalize(ab);
	let bundleWidth = Math.min(Math.max(l-2*spacing, spacing), (n-1)*spacing);
	let f = (l-bundleWidth) / 2 + (n > 2 ? i*(bundleWidth/(n-1)) : 0);
	return [vecAdd(a, vecMul(nab, f)), vecRot90(nab)];
};

let scale = 30;
let sp = ([x, y]: Point) => `${scale*x},${scale*y}`;

let simpleSegmentPath = (a: Point, na: Point, b: Point, nb: Point) : string => {
	let curveAmount = 0.3;
	let a_ = vecAdd(a, vecMul(na, curveAmount));
	let b_ = vecSub(b, vecMul(nb, curveAmount));
	return `L${sp(a)} C${sp(a_)} ${sp(b_)} ${sp(b)}`;
};

let curvedPortalPath = (
	map: VisMap,
	path: number[],
	segmentPath: (a: Point, na: Point, b: Point, nb: Point) => string
) => {
	let layout = PathLayout.doLayout(map, path);
	let ps = [];
	let spacing = 0.3;
	for (let i=0; i<path.length; i++) {
		let [j, n] = layout[i];
		let p = crossingPoint(map.portals[path[i]], j, n, spacing);
		ps.push(p);
	}

	let svgPath = "";
	for (let i = 0; i < ps.length; i++) {
		let [curr, currNorm] = ps[i];
		if (i == 0) {
			let a = vecAdd(curr, vecMul(currNorm, deflateAmount));
			svgPath += `M${sp(a)}`;
		} else {
			let [prev, prevNorm] = ps[i-1];
			let a = vecAdd(prev, vecMul(prevNorm, deflateAmount));
			let b = vecSub(curr, vecMul(currNorm, deflateAmount));
			svgPath += segmentPath(a, prevNorm, b, currNorm);
		}
	}
	return svgPath;
};

let map: VisMap = null;

let deflateAmount = 0.1;

type DrawRequest = {
	map: VisMap,
	cellClass: string[],
	portalClass: string[],
	path: number[],
	stack?: number[],
	bundle?: RayBundle
};

type RayBundle = {
	source: Line,
	target: Line
};

let bundleX = (bundle: RayBundle) : Line[] => {
	return bundle ? [
		[bundle.source[0], bundle.target[1]],
		[bundle.target[0], bundle.source[1]],
		[bundle.target[0], bundle.target[1]]
	] : [];
}

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

let portalFrontCheck = (a: Line, b: Line) => {
	let n = vecRot90(vecSub(a[1], a[0]));
	let d = vecDot(a[0], n);
	let p = vecDot(b[0], n);
	let q = vecDot(b[1], n);
	if (p <= d && q <= d)
		return false;
	return true;
};

let portalFlood = (map: VisMap, path: number[], visited: {[p: number]: true}, front: {[p: number]: true}, p: number, limit: number) => {
	if (!visited[p]) {
		path.push(p);
		if (path.length == limit)
			return;
		visited[p] = true;
		for (let q of ccp[p]) {
		//for (let q of map.portalsExit[map.connectivity[p][1]]) {
			if ((p ^ q) != 1 && front[q])
				portalFlood(map, path, visited, front, q, limit);
			if (path.length == limit)
				return;
		}
		path.push(p^1);
		if (path.length == limit)
			return;
	}
};

let intersectSet = (a: {[i: number]: true}, b: {[i: number]: true}) : {[i: number]: true} => {
	let r = {};
	for (let i in a) {
		if (b[i])
			r[i] = true;
	}
	return r;
};

let subtractSet = (a: {[i: number]: true}, b: {[i: number]: true}) : {[i: number]: true} => {
	let r = {};
	for (let i in a) {
		if (b[i] === undefined)
			r[i] = true;
	}
	return r;
};

let unionSet = (a: {[i: number]: true}, b: {[i: number]: true}) : {[i: number]: true} => {
	let r = {};
	for (let i in a) r[i] = true;
	for (let i in b) r[i] = true;
	return r;
};

type FlowState = {
	cansee: {[p: number]: true},
	stack: number[]
};

let eagerMarking: boolean = true;

let portalFlow = (
	map: VisMap,
	path: number[],
	flood: {[p: number]: {[q: number]: true}},
	cansee: {[p: number]: true},
	confirmed: {[p: number]: true},
	p: number,
	limit: number,
	stack: number[],
	hack: {[p: number]: true}
) : FlowState => {

	//let eagerMarking = true;

	//hack[p] = true;
	hack[map.connectivity[p][1]] = true;

	stack = stack.concat([p]);

	let returnValue: FlowState = {
		cansee: cansee,
		stack: stack
	};

	path.push(p);
	if (path.length == limit)
		return returnValue;
	confirmed[p] = true;
	if (eagerMarking)
	{
		for (let q of ccp[p]) {
			if (cansee[q])
				confirmed[q] = true;
		}
	}
	for (let q of ccp[p]) {
		if (!cansee[q])
			continue;

		let qcansee = intersectSet(cansee, flood[q]);
		let qwantsee = subtractSet(qcansee, confirmed);
		if (Object.keys(qwantsee).length === 0 && (confirmed[q] === true || eagerMarking))
			continue;

		//if (hack[q]) continue;
		//if (hack[map.connectivity[q][1]]) continue;

		let xreturnValue = portalFlow(
			map,
			path,
			flood,
			qcansee,
			confirmed,
			q,
			limit,
			stack,
			hack
		);
		if (path.length == limit)
			return xreturnValue;
	}
	path.push(p^1);
	return returnValue;
};

let portalFlowOuter = (
	map: VisMap,
	path: number[],
	flood: {[p: number]: {[q: number]: true}},
	cansee: {[p: number]: true},
	confirmed: {[p: number]: true},
	p: number,
	limit: number,
	stack: number[]
) : FlowState => {
	let r: FlowState = null;
	let nconfirmed = 0;
	while (true) {
		let hack: {[p: number]: true} = {}
		r = portalFlow(
			map,
			path,
			flood,
			cansee,
			confirmed,
			p,
			limit,
			stack,
			hack);
		return r; // classic algorithm
		if (path.length == limit)
			return r;
		let nconfirmed2 = Object.keys(confirmed).length;
		if (nconfirmed == nconfirmed2)
			break;
		nconfirmed = nconfirmed2;
	}
};

let summarizeCells = (map: VisMap, portals: number[]) : {[cell: number]: true} => {
	let cells = {};
	for (let p of portals) {
		cells[map.connectivity[p][1]] = true;
	};
	return cells;
};

let requestForStep = (i: number, step: number) : DrawRequest => {
	if (mode == 0) {
		let floodPath = [];
		let front = {};
		for (let j=0; j<map.portals.length; j++)
			if (portalFrontCheck(map.portals[i], map.portals[j]))
				front[j] = true;
		let floodSet = {};
		portalFlood(map, floodPath, floodSet, front, i, step+1);
		let canseeFrontCells = summarizeCells(map, Object.keys(front).map((n)=>parseInt(n)));
		let canseeFloodCells = summarizeCells(map, Object.keys(floodSet).map((n)=>parseInt(n)));
		return {
			map: map,
			cellClass: map.cells.map((_, j) =>
				(canseeFloodCells[j] ? "confirmed " : "") +
				(canseeFrontCells[j] ? "cansee " : "cantsee ") +
				"cell"),
			portalClass: map.portals.map((_, j) =>
				(i == j ? "entry " : "") +
				(front[j] ? "flood_cansee " : "flood_cantsee ") + 
				(floodPath.slice(0, step+1).indexOf(j) != -1 ? "confirmed " : "black ") +
				"portal"
			),
			path: floodPath.slice(0, step+1),
			stack: [i]
		};
	} else {
		let flood = {};
		let front = {};
		for (let k=0; k<map.portals.length; k++) {
			front[k] = {};
			for (let j=0; j<map.portals.length; j++)
				if (portalFrontCheck(map.portals[k], map.portals[j]))
					front[k][j] = true;
			flood[k] = {};
			portalFlood(map, [], flood[k], front[k], k, -1);
		}
		let flowPath: number[] = [];
		let confirmed = {};
		let flowState = portalFlowOuter(map, flowPath, flood, flood[i], confirmed, i, step+1, []);
		let canseeFlow = flowState.cansee;
		let stack = flowState.stack;
		let truncatedPath = flowPath.slice(0, step+1);
		let canseeFloodCells = summarizeCells(map, Object.keys(flood[i]).map((n)=>parseInt(n)));
		let canseeFlowCells = summarizeCells(map, Object.keys(canseeFlow).map((n)=>parseInt(n)));
		let confirmedCells = summarizeCells(map, Object.keys(confirmed).map((n)=>parseInt(n)));

		let first_portal = i;
		let last_portal = flowPath[flowPath.length-1]
		let first_cell = map.connectivity[first_portal][0];
		let last_cell = map.connectivity[last_portal][1];

		let adjacentToLastCell = {};
		for (let p of map.portalsExit[last_cell])
			if (p != (last_portal^1))
				adjacentToLastCell[map.connectivity[p][1]]=true;

		let lastCellToHighlightCellPortal = null;
		for (let r of map.portalsExit[last_cell]) {
			if (map.connectivity[r][1] == highlightCell)
				lastCellToHighlightCellPortal = r;
		}
		let highlightCells =
			lastCellToHighlightCellPortal !== null
			? summarizeCells(map, Object.keys(flood[lastCellToHighlightCellPortal]).map((n)=>parseInt(n)))
			: {};

		if (lastCellToHighlightCellPortal !== null) {
			path.push(lastCellToHighlightCellPortal);
			stack.push(lastCellToHighlightCellPortal);
			last_portal = lastCellToHighlightCellPortal;
		}

		let bundle: RayBundle = {
			source: map.portals[first_portal],
			target: map.portals[last_portal]
		};

		return {
			map: map,
			cellClass: map.cells.map((_, i) =>
				(adjacentToLastCell[i] ? "next " : "") +
				(lastCellToHighlightCellPortal !== null && highlightCells[i] ? "nextflood ": "") +
				(lastCellToHighlightCellPortal !== null && !highlightCells[i] ? "cantsee ": "") +
				(confirmedCells[i] ? "confirmed " : "") +
				(!confirmedCells[i] && canseeFlowCells[i] ? "todo " : "") +
				(canseeFlowCells[i] ? "cansee " : "cantsee ") +
				"cell"
			),
			portalClass: map.portals.map((_, j) =>
				(confirmed[j] ? "confirmed " : "") +
				(!confirmed[j] && flood[i][j] ? "todo " : "") +
				(canseeFlow[j] ? "cansee " : "cantsee ") +
				(stack.indexOf(j) != -1 ? "onstack " : "") +
				"portal"
			),
			path: truncatedPath,
			stack: stack,
			bundle: bundle
		};
	}
};

let cells_tg;
let portals_tg;
let paths_tg;
let plane_tg;
let bundle_tg;

let highlightPortal: number|null = null;
let highlightCell: number|null = null;

let handlePortalMouseOver = (d, i) => {
	//console.log(d, i);
	highlightPortal = d[1];
	update_r();
	build(r);
};
let handlePortalMouseLeave = (d, i) => {
	highlightPortal = null;
	update_r();
	build(r);
};
let handleCellMouseOver = (d, i) => {
	highlightCell = i;
	update_r();
	build(r);
};
let handleCellMouseLeave = (d, i) => {
	highlightCell = null;
	update_r();
	build(r);
};

type Center = [number, number, boolean, number];

let newCenters = () : Center[] => {
	let width = 18;
	let height = 10;
	let radius = 0.5;
	return d3.range(45).map(i => ([
		Math.random() * (width - radius * 2) + radius,
		Math.random() * (height - radius * 2) + radius,
		Math.random() > 0.4, // true = cell, false = "hole" (it's a wall, really)
		i
	]));
};

let gf = -0.5;
let gcenters: Center[] = newCenters();

let voronoiMap = () : VisMap => {
	let width = 18;
	let height = 10;
	let radius = 0.5;

	//let centers: Center[] = gcenters;
	let centers: Center[] = newCenters();
	let f = gf;

	let relaxation = 3;
	while (relaxation--) {
		// try to make all triangles have sides of equal length
		let voronoiConstructor = d3.voronoi<Center>();
		voronoiConstructor.extent([[0, 0], [width, height]]);
		let voronoi = voronoiConstructor(centers);
		for (let vorTri of voronoi.triangles()) {
			let a = vorTri[0][3];
			let b = vorTri[1][3];
			let c = vorTri[2][3];

			let pa: Point = [centers[a][0], centers[a][1]];
			let pb: Point = [centers[b][0], centers[b][1]];
			let pc: Point = [centers[c][0], centers[c][1]];

			let dab = vecSub(pa, pb);
			let dbc = vecSub(pb, pc);
			let dca = vecSub(pc, pa);

			let lab: number = vecLength(dab);
			let lbc: number = vecLength(dbc);
			let lca: number = vecLength(dca);
			let l = (lab+lbc+lca)/3; // the "ideal length"

			let sab = (l-lab) * f / lab;
			let sbc = (l-lbc) * f / lbc;
			let sca = (l-lca) * f / lca;

			dab = vecMul(dab, sab);
			dbc = vecMul(dbc, sbc);
			dca = vecMul(dca, sca);

			let npa = vecAdd(pa, vecSub(dca, dab));
			let npb = vecAdd(pb, vecSub(dab, dbc));
			let npc = vecAdd(pc, vecSub(dbc, dca));
			
			centers[a] = [npa[0], npa[1], centers[a][2], centers[a][3]];
			centers[b] = [npb[0], npb[1], centers[b][2], centers[b][3]];
			centers[c] = [npc[0], npc[1], centers[c][2], centers[c][3]];
		}
	}

	let voronoiConstructor = d3.voronoi<Center>();
	voronoiConstructor.extent([[0, 0], [width, height]]);
	let voronoi = voronoiConstructor(centers);

	let wallReassignment = true;
	if (wallReassignment) {
		// 1. mark a high degree node as wall
		// 2. mark its neighbours as non-wall
		// 3. repeat
		let neighbours = {};
		let numNeighbours = {};
		for (let i=0; i<centers.length; i++) {
			neighbours[i] = [];
			numNeighbours[i] = 0;
		}
		for (let vorEdge of voronoi.edges) {
			if (!vorEdge || vorEdge.right === undefined)
				continue;
			let l = vorEdge.left.index;
			let r = vorEdge.right.index;
			neighbours[l].push(r);
			neighbours[r].push(l);
			numNeighbours[l]++;
			numNeighbours[r]++;
		}

		let wall = {};

		for (let i=0; i<centers.length; i++) {
			let k = null;
			let kadj = 0;
			for (let j=0; j<centers.length; j++) {
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
			for (let j of neighbours[k])
			{
				numNeighbours[j]--;
				if (Math.random() < 0.3)
					wall[j] = true;
			}
		}
		for (let i=0; i<centers.length; i++) {
			centers[i][2] = wall[i];
		}
	}

	console.log(centers);

	let cells: Polygon[] = [];
	let portals: Line[] = [];
	let connectivity: [number, number][] = [];

	let i = 0;
	let remap = {};
	for (let poly of voronoi.polygons()) {
		if (poly && centers[i][2]) {
			remap[i] = cells.length;
			let p = poly.map((c)=>c);
			p.reverse();
			cells.push(p);
		}
		i += 1;
	}

	for (let vorEdge of voronoi.edges) {
		if (!vorEdge || vorEdge.right === undefined)
			continue;
		if (vorEdge.left.data[2] && vorEdge.right.data[2]) {
			if (vecLength(vecSub(vorEdge[1], vorEdge[0])) < 0.5)
				continue;
			portals.push([vorEdge[1], vorEdge[0]]);
			console.log(vorEdge.left, vorEdge.right)
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
		cells:        cells,
		portals:      doubleSidedPortals(portals),
		connectivity: doubleSidedConnectivity(connectivity),
		portalsEnter: [],
		portalsExit:  []
	}
};

let build = (r: DrawRequest) => {
	const cells_g = cells_tg
		.selectAll("path")
		.data(r.map.cells)
		.join(enter =>
			enter
			.append("path")
			.on("mouseover", handleCellMouseOver)
			.on("mouseleave", handleCellMouseLeave));

	const portals_g = portals_tg
		.selectAll("g")
		.data(r.map.portals)
		.join("g");

	const paths_g = paths_tg
		.selectAll("path")
		.data([r.path])
		.join("path");

	let cellHover = (i) => {
		if (highlightCell == i)
			return true;
		if (highlightPortal && r.map.connectivity[highlightPortal][1] == i)
			return true;
		return false;
	};

	cells_g
		//.attr("fill", "#eee")
		.attr("class", (_, i) => r.cellClass[i] + (cellHover(i) ? " hovered" : ""))
		.attr("stroke-width", 2)
		.attr("stroke", "#888")
		.attr("d", poly => polygonPath(deflatePolygon(poly, deflateAmount)));

	let p01 = portals_g
		.selectAll("path")
		.data((p, i) => [[p, i, 0], [p, i, 1]])
		.join(enter =>
			enter
			.append("path")
			.on("mouseover", handlePortalMouseOver)
			.on("mouseleave", handlePortalMouseLeave)
		);

	p01.filter(([p, i, m]) => m == 0)
		.attr("class", ([p, i, m]) => r.portalClass[i] + " main")
		.attr("d", ([p, _i, _m]) => linePath(lineShorten(p, deflateAmount)));

	p01.filter(([p, i, m]) => m == 1)
		.attr("class", ([p, i, m]) => r.portalClass[i] + " normal")
		.attr("d", ([p, _i, _m]) => linePath(normalOn(p, 0.5)));
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
		.attr("d", path => curvedPortalPath(map, path, simpleSegmentPath));

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

	const plane_g = plane_tg
		.selectAll("path")
		.data(r.stack)
		.join("path");

	plane_g
		.attr("fill", "#000")
		.attr("d", i => polygonPath(planePoly(map.portals[i], 18, 10)))

	const bundle_g = bundle_tg
		.selectAll("path")
		.data(bundleX(r.bundle))
		.join("path");

	bundle_g
		.attr("fill", "purple")
		.attr("d", l => polygonPath(planePoly(l, 18, 10)))

	// bundleLines(bundle_tg, r.bundle);
};

let counter: number = 0;
let mode: number = 0;
let r: DrawRequest = null;

let update_r = () => {
	let start = parseInt((document.getElementById("start") as HTMLInputElement).value);
	if (start >= map.portals.length)
		start = map.portals.length - 1;
	r = requestForStep(start, counter);
};

let reset_flood = () => {
	counter = 0;
	mode = 0;
	update_r();
	build(r);
};

let reset_flow = () => {
	counter = 0;
	mode = 1;
	update_r();
	build(r);
};

let retreat = () => {
	if (counter)
		counter -= 1;
	update_r();
	build(r);
};

let advance = () => {
	counter += 1;
	update_r();
	build(r);
};

let animate = (time: number) => {
	update_r();
	// r.time = time;
	build(r);
	window.requestAnimationFrame(animate);
};

let setMap1 = () => {
	map = map1;
	ccp = PathLayout.counterClockwisePortals(map);
	counter = 0;
	update_r();
	build(r);
};

let setMapVoronoi = () => {
	map = voronoiMap();
	patchEnterExit(map);
	ccp = PathLayout.counterClockwisePortals(map);
	counter = 0;
	update_r();
	build(r);
};

let checkbox = (id: string) => {
	let elem = document.getElementById(id) as HTMLInputElement;
	return elem && elem.checked;
};

let algorithmSettings = () => {
	eagerMarking = checkbox("eager");
	update_r();
	build(r);
};

let visSettings = () => {
	bundle_tg.attr("opacity", checkbox("winding_shadow") ? 0.3 : 0.0);
	plane_tg.attr("opacity", checkbox("stack_shadow") ? 0.3 : 0.0);
	update_r();
	build(r);
};

let codeVisible = false;
let toggleCode = () => {
	codeVisible = !codeVisible;
	document.getElementById("pseudocode").className =
		codeVisible ? "" : "hidden";
};

let init = () => {
	const svg = d3.select("svg");
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
