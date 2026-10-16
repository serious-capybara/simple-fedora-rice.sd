import GObject from 'gi://GObject'
import { registerDestroyableType } from 'resource:///org/gnome/shell/misc/signalTracker.js'

export class Destroyable extends GObject.Object {
    static {
        GObject.registerClass({ Signals: { destroy: {} } }, Destroyable)
        registerDestroyableType(Destroyable)
    }

    destroy() {
        this.emit('destroy')
    }
}
