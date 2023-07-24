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

import { defineConfig, devices } from '@playwright/test';
import { MetricsFetchConfig } from '../scripts/fetch-metrics';

export default defineConfig({
    testDir: '../lib/tests',
    testMatch: ['**/*.performance.js'],
    globalTeardown: require.resolve('../scripts/fetch-metrics.ts'),
    workers: 1,
    timeout: 60 * 1000,
    use: {
        baseURL: 'http://localhost:3000',
        viewport: { width: 1920, height: 1080 }
    },
    metadata: {
        // custom metadata to configure /scripts/ci-global-tear-down.ts
        performanceMetrics: <MetricsFetchConfig>{
            metricsEndpoint: 'http://localhost:3000/metrics',
            outputFileNamePrefix: '',
            outputFileNamePostfix: '.txt',
            outputFilePath: 'performance-metrics'
        }
    },
    preserveOutput: 'failures-only',
    reporter: [
        ['list']
    ],
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
        {
            name: 'Chrome',
            use: {
                ...devices['Desktop Chrome'],
                channel: 'chrome'
            },
        }
    ]
});
