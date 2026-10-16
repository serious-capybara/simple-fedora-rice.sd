import GLib from 'gi://GLib'
import Clutter from 'gi://Clutter'
import St from 'gi://St'
import Meta from 'gi://Meta'
import NotificationBadgeExtension from './extension.js'

export class NotificationIndicator {
    #source
    #counter
    #BadgeBin
    #marginsUpdateId = 0
    constructor(source, counter) {
        this.#source = source
        this.#counter = counter
        counter.connectObject('changed', () => this.#updateCount(), this)
        this.#updateCount()
    }

    destroy() {
        if (this.#marginsUpdateId) {
            const laters = global.compositor.get_laters()
            laters.remove(this.#marginsUpdateId)
            this.#marginsUpdateId = 0
        }
        this.#disableBadge()
        this.#counter?.disconnectObject(this)
        this.#counter = undefined
        this.#source = undefined
    }

    #updateCount() {
        if (this.#source && this.#counter) {
            this.#setCount(this.#counter.count)
        } else
            this.#setCount(0)
    }

    #setCount(count) {
        if (count > 0) {
            const text = this.#countToText(count)
            this.#updateBadge(text)
        } else if (this.#BadgeBin) {
            this.#disableBadge()
        }
    }

    #countToText(count) {
        if (count <= 9999) {
            return count.toString()
        } else if (count < 1e5) {
            const thousands = count / 1e3
            return `${thousands.toFixed(1).toString()}k`
        } else if (count < 1e6) {
            const thousands = count / 1e3
            return `${thousands.toFixed(0).toString()}k`
        } else if (count < 1e8) {
            const millions = count / 1e6
            return `${millions.toFixed(1).toString()}m`
        } else if (count < 1e9) {
            const millions = count / 1e6
            return `${millions.toFixed(0).toString()}m`
        } else {
            const billions = count / 1e9
            return `${billions.toFixed(1).toString()}b`
        }
    }

    #updateBadge(text) {
        if (this.#BadgeBin) {
            this.#BadgeBin.child.text = text
            return
        }
        if (!this.#source)
            return
        this.#BadgeBin = new St.Bin({
            child: new St.Label({ styleClass: 'app-notification-badge', text }),
            xAlign: Clutter.ActorAlign.END,
            yAlign: Clutter.ActorAlign.START,
            xExpand: true,
            yExpand: true,
        })
        const container = this.#source._iconContainer
        container.add_child(this.#BadgeBin)
        container.connectObject('notify::allocation', () => this.#queueMarginsUpdate(), this.#BadgeBin)
        this.#queueMarginsUpdate()
        const themeContext = St.ThemeContext.get_for_stage(global.stage)
        const settings = NotificationBadgeExtension.settings
        const doStyleUpdate = () => this.#updateStyle(themeContext, settings)
        themeContext.connectObject('changed', doStyleUpdate, this.#BadgeBin)
        settings.connectObject('changed::use-custom-color', doStyleUpdate, 'changed::color-background', doStyleUpdate, 'changed::color-foreground', doStyleUpdate, this.#BadgeBin)
        this.#source.icon._iconBin.connectObject('notify::child', doStyleUpdate, this.#BadgeBin)
        doStyleUpdate()
    }

    #disableBadge() {
        this.#BadgeBin?.destroy()
        this.#BadgeBin = undefined
    }

    #queueMarginsUpdate() {
        if (this.#marginsUpdateId)
            return // Return if already queued
        const laters = global.compositor.get_laters()
        this.#marginsUpdateId = laters.add(Meta.LaterType.RESIZE, () => {
            this.#updateMargins()
            this.#marginsUpdateId = 0
            return GLib.SOURCE_REMOVE
        })
    }

    #updateMargins() {
        if (!this.#source || !this.#BadgeBin)
            return
        const { iconSize } = this.#source.icon
        const { allocation } = this.#source._iconContainer
        if (!allocation.is_initialized())
            return
        const hMargin = Math.max(allocation.get_width() - iconSize, 0) / 2
        const side = this.#isRTL() ? 'left' : 'right'
        let style = `margin-${side}: ${hMargin}px`
        if (!this.#source.icon.label) {
            const vMargin = Math.max(allocation.get_height() - iconSize, 0) / 2
            style += `; margin-top: ${vMargin}px`
        }
        this.#BadgeBin.style = style
    }

    #updateStyle(theme, settings) {
        if (!this.#source || !this.#BadgeBin)
            return
        let style = `font-size: ${this.#getFontSize(theme)}px`
        if (settings.get_boolean('use-custom-color')) {
            const colorBG = settings.get_string('color-background')
            const colorFG = settings.get_string('color-foreground')
            style += `; background-color: ${colorBG}; color: ${colorFG}`
        }
        this.#BadgeBin.child.style = style
    }

    #getFontSize(theme) {
        const font = theme.get_font()
        let fontSize = (font.get_size() / 1024) * 0.9
        // If the fontSize was expressed in points, convert to pixels
        if (!font.get_size_is_absolute())
            fontSize /= 0.75
        const sizeMultiplier = this.#source.icon.iconSize / 48
        return Math.round(fontSize * sizeMultiplier)
    }

    #isRTL() {
        return this.#BadgeBin.get_text_direction() === Clutter.TextDirection.RTL
    }
}
