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

import { type FullConfig } from '@playwright/test';
import * as fs from 'fs-extra';
import fetch from 'node-fetch';

async function fetchMetrics(config: FullConfig) {
    await fetchPerformanceMetrics(config.metadata.performanceMetrics, config.metadata.totalTime);
}

export default fetchMetrics;

export interface MetricsFetchConfig {
    metricsEndpoint: string;
    outputFileNamePrefix: string;
    outputFileNamePostfix: string;
    outputFilePath: string;
}

export async function fetchPerformanceMetrics({
    metricsEndpoint,
    outputFileNamePrefix,
    outputFileNamePostfix,
    outputFilePath }: MetricsFetchConfig,
    totalTime?: string
) {
    const now = new Date();
    const dateString = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
    const timeString = `${now.getHours()}-${now.getMinutes()}-${now.getSeconds()}`;
    const timestamp = `${dateString}T${timeString}`;
    const fileName = outputFileNamePrefix + timestamp + outputFileNamePostfix;
    const targetFile = `${outputFilePath}/${fileName}`;

    fs.ensureDirSync(outputFilePath);
    if (fs.existsSync(targetFile)) {
        console.warn('Output file already exists, deleting it...');
        fs.rmSync(targetFile);
    }

    try {
        const response = await fetch(metricsEndpoint);
        let data = await response.text();
        if (totalTime) {
            data += `

playwright_total_time ${totalTime}`;
        }

        fs.writeFileSync(targetFile, data);
    } catch (error) {
        console.error('Error while fetching metrics', error);
        process.exit(-1);
    }
}

