import Gio from 'gi://Gio'
import { overview } from 'resource:///org/gnome/shell/ui/main.js'
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js'
import { AppIconsDecorator } from './decorator.js'

export default class NotificationBadgeExtension extends Extension {
    static settings
    #iconsDecorator
    #destroySignal
    enable() {
        NotificationBadgeExtension.settings = this.getSettings()
        const systemSettings = new Gio.Settings({ schemaId: 'org.gnome.desktop.notifications' })
        const signalId = systemSettings.connect('changed::show-banners', this.#onDNDChanged.bind(this))
        this.#destroySignal = () => systemSettings.disconnect(signalId)
        this.#onDNDChanged(systemSettings)
    }

    disable() {
        this.#destroySignal?.call(this)
        this.#destroySignal = undefined
        this.#toggle(false)
        NotificationBadgeExtension.settings = undefined
    }

    #onDNDChanged(settings) {
        this.#toggle(settings.get_boolean('show-banners'))
    }

    #toggle(enable) {
        if (enable) {
            if (!this.#iconsDecorator && !overview.isDummy) {
                this.#iconsDecorator = new AppIconsDecorator()
            }
        } else {
            this.#iconsDecorator?.destroy()
            this.#iconsDecorator = undefined
        }
    }
}
