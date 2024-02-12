// *****************************************************************************
// Copyright (C) 2021 logi.cals GmbH, EclipseSource and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// This Source Code may also be made available under the following Secondary
// Licenses when the conditions for such availability set forth in the Eclipse
// Public License v. 2.0 are satisfied: GNU General Public License, version 2
// with the GNU Classpath Exception which is available at
// https://www.gnu.org/software/classpath/license.html.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
// *****************************************************************************

import { expect, test } from '@playwright/test';
import { DefaultPreferences, PreferenceIds, TheiaApp, TheiaAppLoader, TheiaPreferenceView, TheiaTextEditor, TheiaWorkspace } from '@theia/playwright';
import { initializeExplorer } from './util';

let textEditor: TheiaTextEditor;
let app: TheiaApp;

test.beforeAll(async ({ playwright, browser }) => {
    const ws = new TheiaWorkspace(['tests/resources/sample-files1']);
    app = await TheiaAppLoader.load({
        playwright, useElectron: {
            electronAppPath: 'theia/examples/electron'
        }, browser
    }, ws);

    // set auto-save preference to off
    const preferenceView = await app.openPreferences(TheiaPreferenceView);
    await preferenceView.setOptionsPreferenceById(PreferenceIds.Editor.AutoSave, DefaultPreferences.Editor.AutoSave.Off);
    await preferenceView.close();

    await initializeExplorer(app);
    textEditor = await app.openEditor('sample.txt', TheiaTextEditor);
});

test.afterAll(async () => {
    await app.page.close();
});

test.describe('Theia Text Editor', () => {

    test('should be visible and active after opening "sample.txt"', async () => {
        expect(await textEditor.isTabVisible()).toBe(true);
        expect(await textEditor.isDisplayed()).toBe(true);
        expect(await textEditor.isActive()).toBe(true);
    });

    test('should be dirty after changing the file contents and clean after save', async () => {
        await textEditor.replaceLineWithLineNumber('this is just a sample file', 1);
        expect(await textEditor.isDirty()).toBe(true);

        await textEditor.save();
        expect(await textEditor.isDirty()).toBe(false);
        await textEditor.close();
    });

});
