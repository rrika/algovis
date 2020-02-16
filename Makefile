TSC=node_modules/typescript/bin/tsc
watch:
	$(TSC) --lib es2015,dom -w vis.ts
