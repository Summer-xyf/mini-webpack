export class ChangeOutPutPath {
    apply(hooks) {
        hooks.emitFile.tap('changeoutputpath', (context) => {
            console.log(555);
            context.changeOutPut("./dist/build.js")
        })
    }
}