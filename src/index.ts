import type { Plugin } from "vite"
import ts from "typescript"
import fs from "fs"
import type { RegisterOptions } from "typescript-paths"
import { convertLogLevel, createHandler, createLogger, LogLevel } from "typescript-paths"

const PLUGIN_NAME = "tsconfig-paths"

export type PluginOptions = Omit<RegisterOptions, "loggerID">

export function tsConfigPaths({
	tsConfigPath,
	respectCoreModule,
	logLevel = "info",
	colors = true,
}: PluginOptions = {}): Plugin {
	let log: ReturnType<typeof createLogger>
	let handler: ReturnType<typeof createHandler>
	let root = ""
	return {
		name: PLUGIN_NAME,
		enforce: "pre",
		configResolved(config) {
			root = config.root
			log = createLogger({ logLevel: convertLogLevel(logLevel), colors, ID: PLUGIN_NAME })
			log(LogLevel.Debug, `typescript version: ${ts.version}`)
			handler = createHandler({
				log,
				tsConfigPath,
				respectCoreModule,
				searchPath: root,
				falllback: moduleName => (fs.existsSync(moduleName) ? moduleName : undefined),
			})
		},
		handleHotUpdate(ctx) {
			if (ctx.file.endsWith(".json")) {
				handler = createHandler({
					log,
					tsConfigPath,
					respectCoreModule,
					searchPath: root,
					falllback: moduleName => (fs.existsSync(moduleName) ? moduleName : undefined),
				})
			}
		},
		resolveId(request: string, importer?: string) {
			if (!importer || request.startsWith("\0")) {
				return null
			}

			// remove vite suffix
			let suffix = ""
			const m = request.match(/\?.+$/)
			if (m) {
				suffix = m[0]
				request = request.slice(0, m.index)
			}

			const moduleName = handler?.(request, importer)
			if (!moduleName) {
				return this.resolve(request + suffix, importer, {
					skipSelf: true,
				})
			}

			log(LogLevel.Debug, `${request} -> ${moduleName}`)

			return moduleName + suffix
		},
	}
}

export default tsConfigPaths
