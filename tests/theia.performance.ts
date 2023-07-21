// *****************************************************************************
// Copyright (C) 2023 STMicroelectronics and others.
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
import { TheiaApp, TheiaTextEditor, TheiaWorkspace } from '@theia/playwright';

test.describe('Theia App', () => {

    test('should be fast in opening, changing and saving a text file', async ({ browser }) => {
        const page = await browser.newPage();
        const ws = new TheiaWorkspace(['tests/resources/sample-files1']);
        const app = await TheiaApp.loadApp(page, TheiaApp, ws);
        const textEditor = await app.openEditor('sample.txt', TheiaTextEditor);

        expect(await textEditor.isTabVisible()).toBe(true);
        expect(await textEditor.isDisplayed()).toBe(true);
        expect(await textEditor.isActive()).toBe(true);

        await textEditor.replaceLineWithLineNumber('this is just a sample file', 1);
        expect(await textEditor.isDirty()).toBe(true);

        await textEditor.save();
        expect(await textEditor.isDirty()).toBe(false);
        await textEditor.close();
    });

});
