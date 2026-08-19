import { Application as BaseApplication, Musket } from '@h3ravel/musket'

export class Application extends BaseApplication {

    registerMusketListeners(musket: Musket<this>): void {
        musket.afterHandle.on(() => {
            process.exit(0)
        })
    }
}