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

import * as events from 'events';
import * as fs from 'fs-extra';
import * as readline from 'readline';
import yargs from 'yargs';

(async () => {
    const options: PerformanceReportParams = yargs(process.argv)
        .option('ghPagesPath', {
            describe: 'The path where the history of previous gh pages publications are located.',
            default: 'gh-pages',
            type: 'string'
        })
        .option('publishPath', {
            describe: 'The path to which the new gh pages files including history should end up.',
            default: 'public',
            type: 'string'
        })
        .option('performancePublishPath', {
            describe: 'The path relative to `publishPath` for the performance data and report.',
            default: 'performance',
            type: 'string'
        })
        .option('performanceMetricsPath', {
            describe: 'The path where the latest performance metrics are located.',
            default: 'performance-metrics',
            type: 'string'
        })
        .parseSync();
    preparePerformanceReport(options);
})();

interface PerformanceReportParams {
    /** The path where the history of previous gh pages publications are located. */
    ghPagesPath: string;
    /** The path to which the new gh pages files including history should end up. */
    publishPath: string;
    /** The path relative to `publishPath` for the performance data and report. */
    performancePublishPath: string;
    /** The path where the latest performance metrics are located. */
    performanceMetricsPath: string;
}

export async function preparePerformanceReport({
    publishPath,
    ghPagesPath,
    performancePublishPath,
    performanceMetricsPath
}: PerformanceReportParams) {
    // copy history from the current gh-pages folder to new publish path
    console.log('Copying history');
    fs.emptyDirSync(publishPath);
    fs.copySync(ghPagesPath, publishPath, { filter: (src, dest) => !src.includes('.git') });
    // copy latest performance metrics into performance publish path
    console.log('Copying performance metrics');
    fs.ensureDirSync(`${publishPath}/${performancePublishPath}`);
    fs.copySync(performanceMetricsPath, `${publishPath}/${performancePublishPath}`);
    // generate performance report
    console.log('Generating performance report');
    generatePerformanceReport(`${publishPath}/${performancePublishPath}`);
}

interface ValueHistoryEntry {
    entryLabel: string;
    value: number;
}
interface ValueHistory {
    valueLabel: string;
    history: ValueHistoryEntry[];
}

export async function generatePerformanceReport(path: string) {
    const reportPath = path + '/index.html';
    if (fs.existsSync(path + '/index.html')) {
        fs.removeSync(reportPath);
    }

    const values = await readValuesFromHistory(path, ['process_cpu_seconds_total', 'playwright_total_time']);
    const charts: string[] = [];
    for (const [valueLabel, valueHistory] of values) {
        const data = valueHistory.history.map(entry => ({ x: entry.entryLabel, y: entry.value }));
        charts.push(`
        <div class="chart">
        <h2>${valueLabel}</h2>
        <canvas id="${valueLabel}" style="width:100%;max-height: 500px;"></canvas>
        <script>
        const ctx${valueLabel} = document.getElementById('${valueLabel}');
        new Chart(ctx${valueLabel}, {
            type: 'line',
            data: {
            datasets: [{
                label: '${valueLabel}',
                data: ${JSON.stringify(data)}
            }]
            }
        });
        </script>
        </div>
        `);
    }

    const html = `
        <!doctype html>
        <head>
        <meta charset="utf-8">
        <title>Theia Performance Report</title>
        <meta name="description" content="Theia Performance Report">
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        </head>
        
        <body>
        <h1>Theia Performance Report</h1>
        <div class="charts">
        ${charts.join(' ')}
        </div>    
        </script>
        </body>
        </html>
    `;

    fs.writeFileSync(reportPath, html);
}

export async function readValuesFromHistory(path: string, values: string[]): Promise<Map<string, ValueHistory>> {
    const valueHistoryMap = initializeValueHistoryMap(values);
    const files = fs.readdirSync(path).sort();
    for (const file of files) {
        if (file.endsWith('index.html')) {
            continue;
        }
        const entryLabel = file.substring(0, file.indexOf('.'));
        const entries = await readEntries(path + '/' + file, values);
        entries.forEach(entry =>
            valueHistoryMap.get(entry.valueLabel)?.history.push({ entryLabel, value: entry.entryValue })
        );
    }
    return valueHistoryMap;
}

export function initializeValueHistoryMap(values: string[]) {
    const valueHistoryMap = new Map<string, ValueHistory>();
    for (const value of values) {
        const history: ValueHistoryEntry[] = [];
        valueHistoryMap.set(value, { valueLabel: value, history });
    }
    return valueHistoryMap;
}

export async function readEntries(path: string, values: string[]): Promise<{ valueLabel: string, entryValue: number }[]> {
    const entries: { valueLabel: string, entryValue: number }[] = [];
    try {
        const rl = readline.createInterface({ input: fs.createReadStream(path), crlfDelay: Infinity });
        rl.on('line', (line) => {
            for (const valueLabel of values) {
                if (line.startsWith(valueLabel + ' ')) {
                    const entryValue = Number.parseFloat(line.split(' ')[1]);
                    entries.push({ valueLabel, entryValue });
                }
            }
        });
        await events.once(rl, 'close');
    } catch (err) {
        console.error(err);
    }
    return entries;
}
