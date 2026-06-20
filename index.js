import r from "node:fs"
import t from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import a from "chalk"

const __dirname = t.dirname(fileURLToPath(import.meta.url))
const e = t.basename(__dirname)
const c = Date.now()
let s = 0, l = 0

let apps = {}

try {
  let files = []
  function walk(dir) {
    for (let entry of r.readdirSync(dir, { withFileTypes: true })) {
      let p = t.join(dir, entry.name)
      if (entry.isDirectory()) walk(p)
      else if (entry.name.endsWith(".js")) files.push(p)
    }
  }
  walk(t.join(__dirname, "apps"))

  await Promise.all(files.map(async (file) => {
    try {
      let name = t.basename(file, ".js")
      let mod = await import(pathToFileURL(file).href)
      apps[name] = mod.default || mod[Object.keys(mod)[0]]
      s++
    } catch (err) {
      let name = t.basename(file)
      if (err?.code === "ERR_MODULE_NOT_FOUND") {
      } else {
        logger.error(`[${e}] 载入 ${name} 错误：`, err)
      }
      l++
    }
  }))
} catch (err) {
  logger.error(`[${e}] 载入插件时发生错误/(ㄒoㄒ)/~~`, err)
}

let o = Date.now() - c
let line = "-".repeat(30)
let colors = [a.cyanBright.bold, a.greenBright.bold, a.magentaBright.bold, a.yellowBright.bold]
//启动状态来源：偷取的Yunzai-DF-plugin，感谢Yunzai-DF-plugin
logger.info(line)
let msgs = [`${e} 加载完成 (*^▽^*)`, `成功: ${s} 个`, l > 0 ? `失败: ${l}` : `没有失败 (～￣▽￣)~`]
msgs.forEach((msg, i) => logger.info(colors[i % colors.length](msg)))
logger.info(`✅  总耗时: ${o} ms`)
logger.info(line)

export { apps }
