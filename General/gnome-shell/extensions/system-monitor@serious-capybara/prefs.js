/*
 * SPDX-FileCopyrightText: 2023 Florian Müllner <fmuellner@gnome.org>
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const PANEL_POSITIONS = ['left', 'center', 'right'];

export default class SystemMonitorPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        window._settings = settings;

        const page = new Adw.PreferencesPage({
            title: _('General'),
            icon_name: 'preferences-system-symbolic',
        });
        window.add(page);

        const panelGroup = new Adw.PreferencesGroup({
            title: _('Panel'),
            description: _('Choose where the indicator appears on the top bar'),
        });
        page.add(panelGroup);

        const positionRow = new Adw.ComboRow({
            title: _('Position'),
            subtitle: _('Left, center, or right of the panel'),
            model: new Gtk.StringList({
                strings: [_('Left'), _('Center'), _('Right')],
            }),
        });
        panelGroup.add(positionRow);

        const selected = PANEL_POSITIONS.indexOf(settings.get_string('panel-position'));
        positionRow.selected = selected >= 0 ? selected : PANEL_POSITIONS.indexOf('left');

        positionRow.connect('notify::selected', () => {
            const value = PANEL_POSITIONS[positionRow.selected];
            if (value)
                settings.set_string('panel-position', value);
        });

        settings.connect('changed::panel-position', () => {
            const index = PANEL_POSITIONS.indexOf(settings.get_string('panel-position'));
            if (index >= 0 && positionRow.selected !== index)
                positionRow.selected = index;
        });

        const indexRow = new Adw.SpinRow({
            title: _('Index'),
            subtitle: _('Order among other icons on that side. 0 is first, raise it to sit after another button, −1 is last.'),
            adjustment: new Gtk.Adjustment({
                lower: -1,
                upper: 64,
                step_increment: 1,
                page_increment: 1,
            }),
            digits: 0,
        });
        panelGroup.add(indexRow);
        settings.bind('panel-index', indexRow, 'value', Gio.SettingsBindFlags.DEFAULT);

        const spacingRow = new Adw.SpinRow({
            title: _('Item Spacing'),
            subtitle: _('Spacing between monitor items in pixels'),
            adjustment: new Gtk.Adjustment({
                lower: 0,
                upper: 20,
                step_increment: 1,
                page_increment: 1,
            }),
            digits: 0,
        });
        panelGroup.add(spacingRow);
        settings.bind('item-spacing', spacingRow, 'value', Gio.SettingsBindFlags.DEFAULT);

        const metricsGroup = new Adw.PreferencesGroup({
            title: _('Metrics'),
            description: _('Choose which stats to show in the panel'),
        });
        page.add(metricsGroup);

        const metricRows = [
            ['show-cpu', _('CPU'), _('Show CPU usage')],
            ['show-memory', _('Memory'), _('Show memory usage')],
            ['show-swap', _('Swap'), _('Show swap usage')],
            ['show-upload', _('Upload'), _('Show network upload')],
            ['show-download', _('Download'), _('Show network download')],
        ];

        for (const [key, title, subtitle] of metricRows) {
            const row = new Adw.SwitchRow({title, subtitle});
            metricsGroup.add(row);
            settings.bind(key, row, 'active', Gio.SettingsBindFlags.DEFAULT);
        }
    }
}
