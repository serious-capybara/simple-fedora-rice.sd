import GObject from 'gi://GObject'
import { overview } from 'resource:///org/gnome/shell/ui/main.js'
import { InjectionManager } from 'resource:///org/gnome/shell/extensions/extension.js'
import { AppIcon, AppSearchProvider, FolderIcon } from 'resource:///org/gnome/shell/ui/appDisplay.js'
import { DashItemContainer } from 'resource:///org/gnome/shell/ui/dash.js'
import { Destroyable } from './util.js'
import { NotificationIndicator } from './indicator.js'
import { NotificationsMonitor } from './notification.js'

export class AppIconsDecorator extends Destroyable {
    static { GObject.registerClass(AppIconsDecorator) }
    #notificationsMonitor = new NotificationsMonitor()
    #methodInjections = new InjectionManager()
    #indicators = new Map()
    constructor() {
        super()
        this.#patchExternalIcons()
        for (const item of overview.dash?._box?.get_children()) {
            if (item instanceof DashItemContainer && item.child instanceof AppIcon) {
                this.#decorateIcon(item.child)
            }
        }
        const { appDisplay } = overview._overview.controls
        appDisplay.connectObject('view-loaded', this.#decorateViewIcons.bind(this), this)
        this.#decorateViewIcons(appDisplay)
    }

    destroy() {
        super.destroy() // Disconnect signals
        this.#indicators.forEach(i => i.destroy())
        this.#indicators.clear()
        this.#methodInjections.clear()
        this.#notificationsMonitor.destroy()
    }

    #decorateIcon(appIcon) {
        if (this.#indicators.has(appIcon))
            return
        const counter = this.#notificationsMonitor.getCounter(appIcon.id)
        const indicator = new NotificationIndicator(appIcon, counter)
        this.#indicators.set(appIcon, indicator)
        appIcon.connectObject('destroy', () => {
            this.#indicators.delete(appIcon)
            indicator.destroy()
        }, this)
    }

    #decorateViewIcons(view) {
        for (const item of view.getAllItems()) {
            if (item instanceof AppIcon) {
                this.#decorateIcon(item)
            } else if (item instanceof FolderIcon) {
                this.#decorateViewIcons(item.view)
            }
        }
    }

    #patchExternalIcons() {
        const tryAddIndicator = (icon) => {
            if (icon instanceof AppIcon)
                this.#decorateIcon(icon)
        }
        this.#methodInjections.overrideMethod(AppSearchProvider.prototype, 'createResultObject', (originalMethod) => {
            return function (resultMeta) {
                const result = originalMethod.call(this, resultMeta)
                tryAddIndicator(result)
                return result
            }
        })
        this.#methodInjections.overrideMethod(DashItemContainer.prototype, 'setChild', (originalMethod) => {
            return function (actor) {
                tryAddIndicator(actor)
                return originalMethod.call(this, actor)
            }
        })
    }
}
