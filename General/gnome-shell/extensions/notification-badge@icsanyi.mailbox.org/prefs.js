import GLib from 'gi://GLib'
import Gio from 'gi://Gio'
import Gdk from 'gi://Gdk'
import Gtk from 'gi://Gtk'
import Adw from 'gi://Adw'
import { ExtensionPreferences, gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js'

export default class NotificationBadgePreferences extends ExtensionPreferences {
    async fillPreferencesWindow(window) {
        const page = new Adw.PreferencesPage()
        const settings = this.getSettings()
        page.add(this.createBehaviorGroup(settings))
        page.add(this.createAppearanceGroup(settings))
        window.add(page)
    }

    createBehaviorGroup(settings) {
        const group = new Adw.PreferencesGroup({
            title: _('Behavior'),
        })
        const onlyCountUnseenRow = new Adw.SwitchRow({
            title: _('Only count unseen notifications'),
            subtitle: _('Count only those notifications that have not been marked as seen.'),
        })
        settings.bind('only-count-unseen', onlyCountUnseenRow, 'active', Gio.SettingsBindFlags.DEFAULT)
        group.add(onlyCountUnseenRow)
        return group
    }

    createAppearanceGroup(settings) {
        const group = new Adw.PreferencesGroup({
            title: _('Appearance'),
        })
        const customizeColorsRow = new Adw.ExpanderRow({
            title: _('Customize colors'),
            subtitle: _('Use custom colors instead of the system accent colors.'),
            showEnableSwitch: true,
            expanded: true,
        })
        settings.bind('use-custom-color', customizeColorsRow, 'enable-expansion', Gio.SettingsBindFlags.DEFAULT)
        group.add(customizeColorsRow)
        const colorDialog = new Gtk.ColorDialog()
        customizeColorsRow.add_row(createColorButtonRow(settings, 'color-background', _('Background color'), _('Color of the notification badge.'), colorDialog))
        customizeColorsRow.add_row(createColorButtonRow(settings, 'color-foreground', _('Number color'), _('Color of the number on the badge.'), colorDialog))
        return group
    }
}

function createColorButtonRow(settings, property, title, subtitle, dialog) {
    const row = new Adw.ActionRow({ title, subtitle })
    const button = new Gtk.ColorDialogButton({ dialog })
    bindColor(settings, property, button)
    row.add_suffix(button)
    return row
}

// Gio.Settings.bind_with_mapping is unusable in JS the proper way, so use this hack
// https://gitlab.gnome.org/GNOME/gjs/-/work_items/397
function bindColor(settings, property, button) {
    settings.bind_with_mapping(property, button, 'rgba', Gio.SettingsBindFlags.DEFAULT, (_, value) => {
        const colorString = value.get_string()[0]
        const color = new Gdk.RGBA()
        // Parse the string and set the property on the button directly
        if (color.parse(colorString))
            button.rgba = color
        // Signal that it succeeded, it will try to set the rgba property to NULL,
        // which the ColorDialogButton will reject with a warning
        return true
    }, color => new GLib.Variant('s', color.to_string()))
}
