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
	focus_lct?: number
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
	dpad: 6,
	tasks: [
		{est: 0, lct:  5, p: 1, c: 3, row: 3},
		{est: 2, lct:  5, p: 3, c: 1, row: 2},
		{est: 2, lct:  5, p: 2, c: 2, row: 0},
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

let updateTasks = (s: d3.Selection<any, any, any, any>, T: Triangle) => {
	let taskSel = s.selectAll("path").data(T.tasks).join("path");
	taskSel
		.attr("fill", "transparent")
		.attr("stroke", "black")
		.attr("stroke-width", "1px")
		.attr("d", (t: TaskDraw) => taskBracketsPath(t, t.row, T.scale));
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

let fixedTriangle: d3.Selection<SVGPathElement, any, HTMLElement, any> = null;
let focusTriangle: d3.Selection<SVGGElement, any, HTMLElement, any> = null;
let taskGroup: d3.Selection<SVGGElement, any, HTMLElement, any> = null;

let update = () => {
	updateFocus(focusTriangle, t);
	updateTasks(taskGroup, t);
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
	taskGroup = svg.append("g");

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
	taskGroup.append("path")
		.attr("fill", "transparent")
		.attr("stroke", "black")
		.attr("stroke-width", "2px")
		.attr("d",
			`M0,${s*0.5}L0,${s*t.dpad}L${s*t.tspan},${s*t.dpad}L${s*t.tspan},${s*0.5}Z`+
			`M0,${s*0.5}L${s*t.tspan},${s*t.dpad}`+
			`M0,${s*t.dpad}L${s*t.tspan},${s*0.5}`);

	svg.on("mousemove", mousemove);
	svg.on("mouseleave", mouseleave);
	update();
};

window.addEventListener("load", cumulative_init);
