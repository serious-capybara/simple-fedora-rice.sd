import GLib from 'gi://GLib'
import GObject from 'gi://GObject'
import Gio from 'gi://Gio'
import { messageTray } from 'resource:///org/gnome/shell/ui/main.js'
import { NotificationApplicationPolicy } from 'resource:///org/gnome/shell/ui/messageTray.js'
import NotificationBadgeExtension from './extension.js'
import { Destroyable } from './util.js'

export class NotificationsMonitor {
    #notificationCounters = new Map()
    constructor() {
        messageTray.connectObject('source-added', (_, source) => {
            this.#connectSource(source)
        }, this)
        for (const source of messageTray.getSources()) {
            this.#connectSource(source)
        }
    }

    destroy() {
        messageTray.disconnectObject(this)
        this.#notificationCounters.forEach(c => c.destroy())
        this.#notificationCounters.clear()
    }

    /** Gets the notification counter of the given app. */
    getCounter(appId, canonicalId) {
        let counter = this.#notificationCounters.get(appId)
        if (!counter) {
            counter = new NotificationCounter(canonicalId ?? toCanonicalId(appId))
            this.#notificationCounters.set(appId, counter)
        }
        return counter
    }

    #connectSource(source) {
        const policy = source.policy
        if (policy instanceof NotificationApplicationPolicy) {
            // Add '.desktop' to the end of the ID to match `Shell.App.id`
            const appId = `${policy.id}.desktop`
            const counter = this.getCounter(appId, policy._canonicalId)
            counter.addSource(source)
        }
    }
}

export class NotificationCounter extends Destroyable {
    static { GObject.registerClass({ Signals: { changed: {} } }, NotificationCounter) }
    #sources = new Set()
    #canonicalId
    #initialized = false
    #enabled = false
    #onlyCountUnseen = false
    #updateId = 0
    #count = 0
    get count() {
        return this.#count
    }

    constructor(canonicalId) {
        super()
        this.#canonicalId = canonicalId
    }

    destroy() {
        super.destroy() // Disconnect signals
        if (this.#updateId) {
            GLib.source_remove(this.#updateId)
            this.#updateId = 0
        }
        this.#sources.clear()
    }

    addSource(source) {
        if (this.#sources.has(source))
            return
        // Connect and update settings
        if (!this.#initialized)
            this.#initSettings()
        this.#sources.add(source)
        source.connectObject('destroy', this.removeSource.bind(this), 'notify::count', () => this.#queueUpdate(), this)
        this.#queueUpdate()
    }

    removeSource(source) {
        if (this.#sources.has(source)) {
            this.#sources.delete(source)
            this.#queueUpdate()
        }
    }

    #queueUpdate() {
        if (this.#updateId)
            return // Return if already queued
        this.#updateId = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this.#updateCount()
            this.#updateId = 0
            return GLib.SOURCE_REMOVE
        })
    }

    #updateCount() {
        let count = 0
        if (this.#enabled) {
            this.#sources.forEach(this.#onlyCountUnseen
                ? s => count += s.unseenCount
                : s => count += s.count)
        }
        if (this.#count !== count) {
            this.#count = count
            this.emit('changed')
        }
    }

    #initSettings() {
        // Extension settings
        const settings = NotificationBadgeExtension.settings
        settings.connectObject('changed::only-count-unseen', this.#onSettings.bind(this), this)
        this.#onSettings(settings)
        // Per-app settings
        const appSettings = new Gio.Settings({
            schemaId: 'org.gnome.desktop.notifications.application',
            path: `/org/gnome/desktop/notifications/application/${this.#canonicalId}/`,
        })
        appSettings.connectObject('changed::show-banners', this.#onAppSettings.bind(this), this)
        this.#onAppSettings(appSettings)
        this.#initialized = true
    }

    #onSettings(settings) {
        this.#onlyCountUnseen = settings.get_boolean('only-count-unseen')
        this.#queueUpdate()
    }

    #onAppSettings(settings) {
        this.#enabled = settings.get_boolean('show-banners')
        this.#queueUpdate()
    }
}

function toCanonicalId(id) {
    // Remove .desktop from the end of the app id
    if (id.endsWith('.desktop'))
        id = id.substring(0, id.length - 8)
    // Keys are restricted to lowercase alphanumeric characters and dash,
    // and two dashes cannot be in succession
    return id.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/--+/g, '-')
}
