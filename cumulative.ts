/// <reference path="node_modules/@types/d3/index.d.ts" />

type Task = {
	est: number,
	lct: number,
	p: number,
	c: number
};

type TaskDraw = Task & {
	row?: number,
	color?: string
};

type Triangle = {
	xorigin?: number,
	yorigin?: number,
	scale?: number,
	tspan: number,
	xpad: number,
	ypad: number,
	dpad: number,

	tasks: TaskDraw[],

	focus_est?: number,
	focus_lct?: number,

	igrab?: number,
	xgrab?: number,
	ygrab?: number
};

let fitTriangle = (t: Triangle, w: number, h: number) => {
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
	let dpad2 = t.dpad * 1; //Math.sqrt(2);
	let uw = t.xpad + t.tspan + dpad2 + t.xpad;
	let uh = t.ypad + t.tspan + dpad2 + t.ypad;
	let scale = Math.min(w/uw, h/uh);

	t.scale = scale;
	t.xorigin = (w-uw*scale) / 2;
	t.yorigin = (h-uh*scale) / 2;
};

let xyTriangle = (t: Triangle, x: number, y: number) =>
	`${t.xorigin+t.scale*(t.xpad+x)},${t.yorigin+t.scale*(t.ypad+y)}`;

let t: Triangle = {
	tspan: 10,
	xpad: 1,
	ypad: 1,
	dpad: 8,
	tasks: [
		{est: 0, lct:  5, p: 1, c: 3, row: 5},
		{est: 2, lct:  5, p: 3, c: 1, row: 4},
		{est: 2, lct:  5, p: 2, c: 2, row: 2},
		{est: 0, lct: 10, p: 3, c: 2, row: 0}
	]
};
fitTriangle(t, 540, 300);

let updateFocus = (s: d3.Selection<any, any, any, any>, t: Triangle) => {
	if (t.focus_est !== undefined) {
		let path = s.selectAll("path").data([null]).join("path");
		let a = xyTriangle(t, t.focus_est, t.tspan-t.focus_est);
		let b = xyTriangle(t, t.focus_est, t.tspan-t.focus_lct);
		let c = xyTriangle(t, t.focus_lct, t.tspan-t.focus_lct);
		path
			.attr("fill", "rgba(0, 0, 0, 0.2)")
			.attr("stroke", "black")
			.attr("stroke-width", "1px")
			.attr("d", `M${a}L${b}L${c}`)
	} else {
		s.selectAll("path").data([]).join("path");
	}
};

let updateTasks = (
	spots:    d3.Selection<any, any, any, any>,
	brackets: d3.Selection<any, any, any, any>,
	blocks:   d3.Selection<any, any, any, any>,
	T: Triangle) =>
{
	let circles = spots.selectAll("circle").data(T.tasks).join("circle");
	circles.attr("cx", (t: TaskDraw) => T.xorigin + T.scale*(T.xpad+t.est));
	circles.attr("cy", (t: TaskDraw) => T.yorigin + T.scale*(T.ypad+T.tspan-t.lct));
	circles.attr("r", "2.5px");
	circles.attr("stroke", "black");
	circles.attr("stroke-width", "1px");
	circles.attr("fill", "transparent");

	let bracketSel = brackets.selectAll("path").data(T.tasks).join("path");
	bracketSel
		.attr("fill", "transparent")
		.attr("stroke", "black")
		.attr("d", (t: TaskDraw) => taskBracketsPath(t, t.row, T.scale*Math.sqrt(2)));
	if (T.focus_est === undefined)
		bracketSel.attr("stroke-width", "1px");
	else
		bracketSel.attr("stroke-width", (t: TaskDraw) =>
			T.focus_est <= t.est && t.lct <= T.focus_lct ? "2px" : "1px");

	let blockSel = blocks.selectAll("path").data(T.tasks).join("path");
	blockSel
		.attr("stroke", "none")
		.attr("d", (t: TaskDraw) => taskBlockPath(t, t.row, t.lct-t.est-t.p, T.scale*Math.sqrt(2)));
	if (T.focus_est === undefined)
		blockSel.attr("fill", "gray");
	else
		blockSel.attr("fill", (t: TaskDraw) =>
			T.focus_est <= t.est && t.lct <= T.focus_lct ? "black" : "gray");
};

let taskBracketsPath = (t: TaskDraw, row: number, scale: number) : string => {
	let o = -2;
	let r = 2;
	let row1 = row;
	let row2 = row+t.c;
	return (
		`M${scale*t.est + r},${scale*row1 - o}`+
		`L${scale*t.est    },${scale*row1 - o}`+
		`L${scale*t.est    },${scale*row2 + o}`+
		`L${scale*t.est + r},${scale*row2 + o}`+
		`M${scale*t.lct - r},${scale*row1 - o}`+
		`L${scale*t.lct    },${scale*row1 - o}`+
		`L${scale*t.lct    },${scale*row2 + o}`+
		`L${scale*t.lct - r},${scale*row2 + o}`);
};

let taskBlockPath = (t: TaskDraw, row: number, relstart: number, scale: number) : string => {
	let p = 3;
	let col1 = t.est+relstart;
	let col2 = t.est+relstart+t.p;
	let row1 = row;
	let row2 = row+t.c;
	return (
		`M${scale*col1 + p},${scale*row1 + p}`+
		`L${scale*col1 + p},${scale*row2 - p}`+
		`L${scale*col2 - p},${scale*row2 - p}`+
		`L${scale*col2 - p},${scale*row1 + p}`+
		`Z`);
};


let fixedTriangle: d3.Selection<SVGPathElement, any, any, any> = null;
let focusTriangle: d3.Selection<SVGGElement, any, any, any> = null;
let taskSpots: d3.Selection<SVGGElement, any, any, any> = null;
let taskGroup: d3.Selection<SVGGElement, any, any, any> = null;
let taskBrackets: d3.Selection<SVGGElement, any, any, any> = null;
let taskBlocks: d3.Selection<SVGGElement, any, any, any> = null;

let update = () => {
	updateFocus(focusTriangle, t);
	updateTasks(taskSpots, taskBrackets, taskBlocks, t);
};

let mousedown: d3.ValueFn<SVGElement, any, void> = (datum, index) => {
	let e: MouseEvent = d3.event;
	// let x = (e.offsetX - t.xorigin) / t.scale - t.xpad;
	// let y = (e.offsetY - t.yorigin) / t.scale - t.ypad;
	t.igrab = index;
	t.xgrab = e.offsetX;
	t.ygrab = e.offsetY;
};

let mouseup: d3.ValueFn<SVGElement, any, void> = (datum, index) => {
	delete t.igrab;
	delete t.xgrab;
	delete t.ygrab;
};

let mousemove: d3.ValueFn<SVGElement, any, void> = (datum, index) => {
	let e: MouseEvent = d3.event;
	let x = (e.offsetX - t.xorigin) / t.scale - t.xpad;
	let y = (e.offsetY - t.yorigin) / t.scale - t.ypad;
	if (x+y>t.tspan) {
		delete t.focus_est;
		delete t.focus_lct;
	} else {
		t.focus_est = Math.max(0, x);
		t.focus_lct = t.tspan-Math.max(0, y);
	}
	update();
};

let mouseleave: d3.ValueFn<SVGElement, any, void> = (datum, index) => {
	delete t.focus_est;
	delete t.focus_lct;
	update();
};

let cumulative_init = () => {
	let svg = d3.select<SVGSVGElement, undefined>("svg");
	fixedTriangle = svg.append("path");
	focusTriangle = svg.append("g");
	taskSpots = svg.append("g");
	taskGroup = svg.append("g");
	taskBrackets = taskGroup.append("g");
	taskBlocks   = taskGroup.append("g");

	//
	let x = t.xorigin + t.scale * t.xpad;
	let y = t.yorigin + t.scale * t.ypad;
	let v = t.scale * t.tspan;
	fixedTriangle
		.attr("fill", "transparent")
		.attr("stroke", "black")
		.attr("stroke-width", "2px")
		.attr("d", `M${x},${y}L${x},${y+v}L${x+v},${y}Z`);

	//
	let tr1 = svg.node().createSVGTransform();
	let tr2 = svg.node().createSVGTransform();
	tr1.setTranslate(
		t.xorigin+t.scale*t.xpad,
		t.yorigin+t.scale*(t.ypad+t.tspan)
	);
	tr2.setRotate(-45, 0, 0);
	let transformList = taskGroup.node().transform.baseVal;
	transformList.appendItem(tr1);
	transformList.appendItem(tr2);
	let s = t.scale * Math.sqrt(2);
	taskBlocks.on("mousedown", mousedown);
	svg.on("mouseup", mouseup);
	svg.on("mousemove", mousemove);
	svg.on("mouseleave", mouseleave);
	update();
};

window.addEventListener("load", cumulative_init);
