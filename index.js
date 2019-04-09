let $ = document.getElementById.bind(document);

let spaceSeparatedInts = (value) => value.trim() == "" ? [] : value.trim().replace(/\s+/g, " ").split(" ").map((v)=>parseInt(v));

let update = function() {
	let formula = spaceSeparatedInts($("formula").value);
	let clauses = [];
	while (formula.length) {
		let e = formula.indexOf(0);
		if (e == -1)
			e = formula.length;
		if (e)
			clauses.push(formula.slice(0, e));
		formula = formula.slice(e+1);
	}
	let [xorder, yorder, nvar] = suggestOrder(clauses);
	makeGrid(nvar, xorder, yorder, clauses);
}

let makeGrid = function(nvar, xorder, yorder, clauses) {
	var numbers = [];
	for (let i=0; i<Math.pow(2, nvar); i++)
		numbers.push(i);
	console.log("numbers", numbers);

	var pickBits = function(n) {
		let r = 0;
		for (let i=0; i < this.length; i++) {
			r <<= 1;
			r |= 1 & (n >> (this[i]-1));
		}
		return r * 32 + 1;
	};

	var color = function(n) {
		let clauseColors = [
			"rgba(95, 173, 86, 1)",
			"rgba(242, 193, 78, 1)",
			"rgba(247, 129, 84, 1)",
			"rgba(77, 144, 120, 1)",
			"rgba(180, 67, 108, 1)"
		];
		for (let clauseIndex in clauses) {
			let clause = clauses[clauseIndex];
			let sat = false;
			for (let lit of clause) {
				if (lit > 0) {
					if (1 == (1 & (n >> (lit-1)))) {
						sat = true; break;
					}
				} else {
					if (0 == (1 & (n >> (-1-lit)))) {
						sat = true; break;
					}
				}
			}
			if (!sat)
				return clauseColors[clauseIndex];
		}
	};

	var grid = d3.select("#display")
		.attr("width","510px")
		.attr("height","510px");

	var rects = grid.selectAll("rect")
		.data(numbers);
	rects.exit().remove();
	rects.enter().append("rect")
		.attr("x", pickBits.bind(xorder))
		.attr("y", pickBits.bind(yorder))
		.attr("width", 30)
		.attr("height", 30)
		.style("fill", color);
	rects.transition()
        .duration(500)
		.attr("x", pickBits.bind(xorder))
		.attr("y", pickBits.bind(yorder))
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

window.addEventListener("load", function() {
	$("update").addEventListener("click", update);
});

let divisionsUnderOrder = function(clause, xorder, yorder, xunassigned, yunassigned) {
	let m = {};
	let l = clause.length;
	for (var lit of clause)
		m[lit<0 ? -lit : lit] = true;

	for (var v of xorder.concat(yorder))
		if (m[v]) l--;

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
	return [xmin+ymin, xmin+ymin+xmul+ymul];
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
			return [item[2], item[3], vars.length];
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
