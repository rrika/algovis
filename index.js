let $ = document.getElementById.bind(document);

let spaceSeparatedInts = (value) => value.trim() == "" ? [] : value.trim().replace(/\s+/g, " ").split(" ").map((v)=>parseInt(v));

let gridLayer = null;
let frameLayer = null;
let arrowLayer = null;

window.addEventListener("load", function() {
	$("update1").addEventListener("click", update1);
	$("update2").addEventListener("click", update2);
	$("prev").addEventListener("click", prev);
	$("next").addEventListener("click", next);

	var svg = d3.select("#display")
		.attr("width","512px")
		.attr("height","512px");
	gridLayer = svg.append("g");
	frameLayer = svg.append("g");
	arrowLayer = svg.append("g");
});

let step = 0;

let prev = function() {
	if (step) step--;
	update_stepped();
};

let next = function() {
	step++;
	update_stepped();
};

let update_stepped = function() {
	let clauses = [];
	let frames = [];
	let arrows = [];
	let fakevar = [];
	update_stepped_2(clauses, frames, arrows, fakevar);
	let [xorder, yorder, vars] = suggestOrder(clauses, true);
	updateGrid(gridLayer, vars, xorder, yorder, clauses);
	updateFrames(frameLayer, xorder, yorder, frames)
	$("step_desc").innerText = "Step "+step;
};

let update_stepped_2 = function(clauses, frames, arrows, fakevar) {
	if (step == 0) return;

	clauses.push([1, 2]);
	clauses.push([-2, 4]);
	clauses.push([-1, 2, 3]);
	clauses.push([2, -4, -5]);
	clauses.push([1, -2, -3, -4, 5]);
	if (step == 1) return;

	frames.push([-2, 1, -4]);
	if (step == 2) return;

	frames.push([-2, -1, -4]);
	arrows.push([[-2, -4], [1], [-1]]);
	if (step == 3) return;

	fakevar.push((clause, n) => {
		if (clause.indexOf(1) == -1 && clause.indexOf(-1) == -1)
			return clause.concat([-n]);
		else
			return clause.concat([n]);
	});
	if (step == 4) return;
};

let most_recent_xorder = null;
let most_recent_yorder = null;
let most_recent_formula = null;

let update1 = () => update_cnf(reuseOrder);
let update2 = () => update_cnf(useIfBetter(suggestOrder));

let update_cnf = function(getOrder) {
	let f = $("formula").value;
	let changed = f != most_recent_formula;
	most_recent_formula = f;
	let formula = spaceSeparatedInts(f);
	let clauses = [];
	while (formula.length) {
		let e = formula.indexOf(0);
		if (e == -1)
			e = formula.length;
		if (e)
			clauses.push(formula.slice(0, e));
		formula = formula.slice(e+1);
	}
	let [xorder, yorder, vars] = getOrder(clauses, changed);
	most_recent_xorder = xorder;
	most_recent_yorder = yorder;
	console.log(xorder, yorder);
	updateGrid(gridLayer, vars, xorder, yorder, clauses);
}

var pickBits = function(vars, xorder, yorder) {
	let nvar = vars.length;
	vars.sort((a, b) => a-b);
	let varToBit = {};
	for (let i in vars) {
		varToBit[vars[i]] = i;
	}
	let pick = function(n) {
		let r = 0;
		for (let i=0; i < this.length; i++) {
			r <<= 1;
			r |= 1 & (n >> varToBit[this[i]]);
		}
		return r * 32 + 1;
	};
	let px = pick.bind(xorder);
	let py = pick.bind(yorder);
	let matchingClauses = (clauses, n) => {
		let m = [];
		for (let clauseIndex in clauses) {
			let clause = clauses[clauseIndex];
			let sat = false;
			for (let lit of clause) {
				if (lit > 0) {
					if (1 == (1 & (n >> varToBit[lit]))) {
						sat = true; break;
					}
				} else {
					if (0 == (1 & (n >> varToBit[-lit]))) {
						sat = true; break;
					}
				}
			}
			if (!sat)
				m.push(clauseIndex);
		}
		return m;
	};
	return [px, py, matchingClauses];
};

let clauseRects = function(xorder, yorder, clause) {
	// only supports up to 31 vars because of JS integers ops I guess
	let c = {};
	for (let l of clause) c[l] = 1;
	let x1 = 0, y1 = 0, x0 = 0, y0 = 0;
	for (let v of xorder) { x0 <<= 1; x1 <<= 1; x0 |= c[v]?1:0; x1 |= c[-v]?1:0; }
	for (let v of yorder) { y0 <<= 1; y1 <<= 1; y0 |= c[v]?1:0; y1 |= c[-v]?1:0; }
	let xm = x0 | x1;
	let ym = y0 | y1;
	let xs = xm ? (1+((xm-1) & (~xm))) : (1 << xorder.length);
	let ys = ym ? (1+((ym-1) & (~ym))) : (1 << yorder.length);
	let out = [];
	console.log(xorder, yorder, clause);
	console.log(x0, x1, xm, xs, y0, y1, ym, ys);
	for (let cy = y1; cy < (1 << yorder.length);) {
		for (let cx = x1; cx < (1 << xorder.length);) {
			out.push([cx, cy, xs, ys]);
			cx |= xm; cx += xs; cx &= ~xm; cx |= x1;
		}
		cy |= ym; cy += ys; cy &= ~ym; cy |= y1;
	}
	return out;
};

let updateFrames = function(frameLayer, xorder, yorder, frames) {
	let updateFrame = (f) => {
		let s = f.selectAll("rect").data((f) => clauseRects(xorder, yorder, f));
		s.enter().append("rect")
			.attr("x", (r)=>2+r[0]*32)
			.attr("y", (r)=>2+r[1]*32)
			.attr("width", (r)=>-4+r[2]*32)
			.attr("height", (r)=>-4+r[3]*32)
			.style("stroke", "gray")
			.style("stroke-width", "3px")
			.style("fill", "none");
		s
			.attr("x", (r)=>2+r[0]*32)
			.attr("y", (r)=>2+r[1]*32)
			.attr("width", (r)=>-4+r[2]*32)
			.attr("height", (r)=>-4+r[3]*32)
			.style("stroke", "gray")
			.style("stroke-width", "3px")
			.style("fill", "none");
	};

	var frameSel = frameLayer.selectAll("g").data(frames);
	frameSel.exit().remove();
	frameSel.enter().append("g").call(updateFrame);
	frameSel.call(updateFrame);
}

let updateGrid = function(grid, vars, xorder, yorder, clauses) {
	let nvar = vars.length;

	var numbers = [];
	for (let i=0; i<Math.pow(2, nvar); i++)
		numbers.push(i);

	var [pbx, pby, matchingClauses] = pickBits(vars, xorder, yorder);

	var color = function(n) {
		let clauseColors = [
			"rgba(95, 173, 86, 1)",
			"rgba(242, 193, 78, 1)",
			"rgba(247, 129, 84, 1)",
			"rgba(77, 144, 120, 1)",
			"rgba(180, 67, 108, 1)",
			"rgba(173, 86, 95, 1)",
			"rgba(193, 78, 242, 1)",
			"rgba(129, 84, 247, 1)",
			"rgba(144, 120, 77, 1)",
			"rgba(67, 108, 180, 1)",
			"rgba(86, 95, 173, 1)",
			"rgba(78, 242, 193, 1)",
			"rgba(84, 247, 129, 1)",
			"rgba(120, 77, 144, 1)",
			"rgba(108, 180, 67, 1)"
		];
		let m = matchingClauses(clauses, n);
		if (m.length)
			return clauseColors[m[0]];
		else
			return "black";
	};

	var rects = grid.selectAll("rect")
		.data(numbers);
	rects.exit().remove();
	rects.enter().append("rect")
		.attr("x", pbx)
		.attr("y", pby)
		.attr("width", 30)
		.attr("height", 30)
		.style("fill", color);
	rects.transition()
        .duration(500)
		.attr("x", pbx)
		.attr("y", pby)
		.attr("width", 30)
		.attr("height", 30)
		.style("fill", color);
		// .style("stroke", "#222")
		// .on('click', function(d) {
	    //    d.click ++;
	    //    if ((d.click)%4 == 0 ) { d3.select(this).style("fill","#fff"); }
		//    if ((d.click)%4 == 1 ) { d3.select(this).style("fill","#2C93E8"); }
		//    if ((d.click)%4 == 2 ) { d3.select(this).style("fill","#F56C4E"); }
		//    if ((d.click)%4 == 3 ) { d3.select(this).style("fill","#838690"); }
	    // });
};

let divisionsUnderOrder = function(clause, xorder, yorder, xunassigned, yunassigned) {
	let m = {};
	let l = clause.length;
	for (var lit of clause)
		m[lit<0 ? -lit : lit] = true;

	for (var v of xorder.concat(yorder))
		if (m[v]) l--;

	console.assert(xunassigned > 0 || yunassigned > 0 || l == 0, "vars not in order despite no unassigned slots");

	let axisScore = (name, order, unassigned, other_unassigned) => {
		let i = order.length;
		let sum = 0;
		while (--i >= 0 && !m[order[i]]); // skip trailing 'false'
		let trail = order.length-(i+1);
		while (--i >= 0) sum += !m[order[i]]; // count remaining 'false'

		let maxones = Math.min(unassigned, l);
		let minones = Math.max(0, l-other_unassigned);
		//console.log(name, sum+"+"+trail+"?/"+order.length+":ones("+minones+":"+maxones+")/"+unassigned, " total ones", l, unassigned + other_unassigned);
		if (maxones == 0)
			return [sum, sum];
		else if (minones == 0)
			return [sum, sum+trail+unassigned-1]
		else
			return [sum+trail, sum+trail+unassigned-1]
	};

	let [xmin, xmul] = axisScore("x", xorder, xunassigned, yunassigned);
	let [ymin, ymul] = axisScore("y", yorder, yunassigned, xunassigned);
	//console.log("xyxy", xmin, ymin, xmul, ymul);
	return [xmin+ymin, xmul+ymul];
};

let suggestOrder = function(clauses) {

	let bounds = function(xorder, yorder) {
		//console.log("determine bounds", xorder, yorder, "clauses", JSON.stringify(clauses));
		let lower = 0;
		let upper = 0;
		for (let clause of clauses) {
			let [score, mul] = divisionsUnderOrder(clause,
				xorder,
				yorder,
				x_unassigned-xorder.length,
				y_unassigned-yorder.length);
			lower += Math.pow(2, score);
			upper += Math.pow(2, mul);
			//console.log("clause", JSON.stringify(clause), "range", JSON.stringify([score, mul]));
		}
		return [lower, upper];
	};

	let vars = {};
	for (let clause of clauses)
		for (let lit of clause)
			vars[lit<0 ? -lit : lit] = true;
	vars = Object.keys(vars).map((v) => parseInt(v));

	let x_unassigned = Math.round(vars.length/2+0.25);
	let y_unassigned = Math.round(vars.length/2-0.25);

	let queue = [[NaN, NaN, [], [], vars]];
	let lowest_high_bound = 2 << vars.length;
	do {
		let item = queue.pop();
		//console.log("#queue", queue.length, "current=", JSON.stringify(item));
		if (item[4].length == 0)
			return [item[2], item[3], vars];
		if (item[0] > lowest_high_bound)
		{
			//console.log("skipping bc of bound");
			continue;
		}
		let append_axis = (item[2].length > item[3].length) ? 1 : 0;
		let cvars = item[4];
		for (let i in cvars) {
			i = parseInt(i);
			let thisvar = cvars[i];
			let othervars = cvars.slice(0, i).concat(cvars.slice(i+1));
			let newxy = [
				item[2].slice(0),
				item[3].slice(0)
			];
			newxy[append_axis].push(thisvar);
			let [l, u] = bounds(newxy[0], newxy[1]);
			lowest_high_bound = Math.min(lowest_high_bound, u);
			//console.log(JSON.stringify(newxy), l, u, lowest_high_bound);
			if (l <= lowest_high_bound)
				queue.push([l, u, newxy[0], newxy[1], othervars]);
			else
				;
				//console.log("not queueing bc of bound", l, lowest_high_bound);
		}
		queue.sort((a, b) => b[0]-a[0]);
	} while (queue.length > 0);

};

let reuseOrder = function(clauses) {
	if (most_recent_xorder == null || most_recent_yorder == null)
		return suggestOrder(clauses);

	// check if all variables present in cached order
	let vars_in_cached_orders = {};
	for (let v of most_recent_xorder)
		vars_in_cached_orders[v] = true;
	for (let v of most_recent_yorder)
		vars_in_cached_orders[v] = true;
	let new_vars = [];
	for (let clause of clauses) {
		for (let lit of clause) {
			let v = lit > 0 ? lit : -lit;
			if (!vars_in_cached_orders[v])
			{
				new_vars.push(v);
				vars_in_cached_orders[v] = true;
			}
		}
	}

	let nxo = most_recent_xorder.slice(0);
	let nyo = most_recent_yorder.slice(0);

	// patch in missing variables at front of most_recent_*order
	while (new_vars.length) {
		let nv = new_vars.splice(0, 1);
		if (nxo.length <= nyo.length)
			nxo.splice(0, 0, [nv]);
		else
			nyo.splice(0, 0, [nv]);
	}

	let vars = Object.keys(vars_in_cached_orders).map((v) => parseInt(v));
	return [nxo, nyo, vars];
};

let useIfBetter = function(getOrder) {
	return (clauses, changed) => {
		if (most_recent_xorder == null || most_recent_yorder == null)
			return getOrder(clauses);

		let score = (xorder, yorder) => {
			let s = 0;
			for (let clause of clauses) {
				let [score, mul] = divisionsUnderOrder(clause, xorder, yorder, 0, 0);
				// console.log(score, mul)
				// console.assert(score == mul);
				s += Math.pow(2, score);
			}
			return s;
		};

		let [oxo, oyo, ovars] = reuseOrder(clauses);
		let [nxo, nyo, nvars] = getOrder(clauses);
		// ovars and nvars shouldn't differ
		let oldScore = score(oxo, oyo);
		let newScore = score(nxo, nyo);
		if (!changed && newScore >= oldScore)
			return [nxo, nyo, nvars];
		if (newScore > oldScore)
			return [nxo, nyo, nvars];
		else
			return [oxo, oyo, ovars];
	};
};
