/********************************************************************************
 * Copyright (C) 2022 STMicroelectronics and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/
import { expect, test } from '@playwright/test';
import { TheiaApp, TheiaAppLoader } from '@theia/playwright';

let app: TheiaApp;

test.beforeAll(async ({ playwright, browser }) => {
    app = await TheiaAppLoader.load({
        playwright, useElectron: { electronAppPath: 'theia/examples/electron', }, browser
    });
});

test.afterAll(async () => {
    await app.page.close();
});


test.describe('Theia app', () => {
    test('should show main content panel', async () => {
        expect(await app.isMainContentPanelVisible()).toBe(true);
    });

    test('should show status bar', async () => {
        expect(await app.statusBar.isVisible()).toBe(true);
    });

    test('should have menu bar items', async () => {
        expect((await app.menuBar.visibleMenuBarItems()).length > 0).toBe(true);
    });

});
