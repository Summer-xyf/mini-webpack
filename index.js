
import fs from 'fs'
import path from 'path'
import ejs from 'ejs'
import parser from '@babel/parser'
import traverse from '@babel/traverse'
import { transformFromAst } from 'babel-core'

import { jsonLoader } from './jsonLoader.js'

import { SyncHook } from "tapable";
import { ChangeOutPutPath } from './changeOutPutPath.js'

let id = 0;

const webpackConfig = {
    module: {
        rules: [
            {
                test: /\.json$/,
                use: jsonLoader
            }
        ]
    },
    plugins: [new ChangeOutPutPath()]
}

const hooks = {
    emitFile: new SyncHook(["context"])
}
function createAsset(filePath) {

    // 1.获取文件内容
    // ast => 抽象语法树
    let source = fs.readFileSync(filePath, { encoding: "utf-8" })
    // console.log(source);

    // loadjson
    const loaders = webpackConfig.module.rules

    loaders.forEach(({ test, use }) => {
        if (test.test(filePath)) {
            source = use(source)
        }
    })

    // 2.获取依赖关系
    const ast = parser.parse(source, { sourceType: "module" })
    // console.log(ast);
    const deps = []
    traverse.default(ast, {
        ImportDeclaration({ node }) {
            // console.log(node.source.value);
            deps.push(node.source.value)
        }
    })

    // 代码转换es -> cjs
    const { code } = transformFromAst(ast, null, {
        presets: ["env"]
    })


    return {
        filePath,
        code,
        deps,
        mapping: {},
        id: id++
    }
}

// const asset = createAsset()
// console.log(asset);

// 合成图对象
function createGraph() {
    const mainAsset = createAsset("./example/main.js")

    const queue = [mainAsset]

    for (const asset of queue) {
        asset.deps.forEach(relativePath => {
            // console.log(relativePath);
            const child = createAsset(path.resolve("./example", relativePath))
            asset.mapping[relativePath] = child.id
            queue.push(child)
        })
    }

    return queue
}

function initPlugin() {
    const plugins = webpackConfig.plugins
    plugins.forEach(plugin => {
        plugin.apply(hooks)
    })
}
initPlugin()

const graph = createGraph()
// console.log(graph);

function build(graph) {
    const template = fs.readFileSync('./bundle.ejs', { encoding: "utf-8" })

    const data = graph.map(asset => {
        const { id, code, mapping } = asset
        return {
            id,
            code,
            mapping
        }
    })

    const code = ejs.render(template, { data })

    let outputpath = "./dist/bundle.js"
    const context = {
        changeOutPut: (path) => {
            outputpath = path
        }
    }

    hooks.emitFile.call(context)
    fs.writeFileSync(outputpath, code)
}

build(graph)