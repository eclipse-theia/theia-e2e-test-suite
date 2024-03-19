#!/usr/bin/env python3
__copyright__ = """
  Copyright (c) 2023 Ericsson

  All rights reserved. This program and the accompanying materials are made
  available under the terms of the Eclipse Public License 2.0 which
  accompanies this distribution, and is available at
  https://www.eclipse.org/legal/epl-2.0/
 
  SPDX-License-Identifier: EPL-2.0
"""
__license__ = "EPL-2.0"

import re
import json
import os
import subprocess
import shutil

import tqdm

REPO_URL = 'git@github.com:eclipse-theia/theia-e2e-test-suite.git'
FOLDER_PATH = 'performance'  # Change this to the folder path you want to checkout
BRANCH = 'gh-pages'  # Change this to the branch you want to checkout
OUTPUT_FOLDER = 'traces'


def is_git_installed():
    try:
        subprocess.run(['git', '--version'], stdout=subprocess.PIPE,
                       stderr=subprocess.PIPE, check=True)
        return True
    except FileNotFoundError:
        return False


def checkout_files_from_github(repo_url, branch, folder_path):
    if not is_git_installed():
        print("Git is not installed. Please install Git and try again.")
        return

    # Clone the GitHub repository
    subprocess.run(['git', 'clone', repo_url])

    # Get the repository name from the URL
    repo_name = repo_url.split('/')[-1].split('.')[0]

    # Change directory to the cloned repository
    os.chdir(repo_name)

    subprocess.run(['git', 'checkout', branch])
    # List all files in the specified folder
    return repo_name, os.listdir(folder_path)


repo_name, files = checkout_files_from_github(REPO_URL, BRANCH, FOLDER_PATH)
if not os.path.exists(OUTPUT_FOLDER):
    os.mkdir(OUTPUT_FOLDER)
for file in tqdm.tqdm(files):
    if file == 'index.html':
        continue

    input_trace = FOLDER_PATH + '/' + file
    output_trace = '../'+OUTPUT_FOLDER + '/' + file[:-4] + '.json'
    # theia_measurements{id="backend", name="deployPlugin", startTime="943.3257030000095", owner="backend"} 1.7780040000216104
    regex_pattern = re.compile(
        r'(\S+)\{id="(\S+)", name="(\S+)", startTime="(\S+)", owner="(\S+)"\} (\S+)')
    with open(input_trace, 'r', encoding='utf8') as content:
        last_name = None
        last_type = None
        last_label = None
        events = []
        for line in content.readlines():

            if line.startswith('# HELP'):
                data = line.split(' ', 3)
                last_name = data[1]
                last_label = data[2]
            elif line.startswith('# TYPE'):
                data = line.split(' ', 3)
                last_name = data[1]
                last_type = data[2]
            else:
                groups = regex_pattern.match(line)
                if groups:
                    source_item = groups.group(1)
                    # only copy theia events
                    if source_item.startswith('the'):
                        unique_id = groups.group(2)
                        name = groups.group(3)
                        startTime = float(groups.group(4))
                        owner = groups.group(5)
                        duration = float(groups.group(6))
                        event = {}
                        event['ts'] = startTime*1000
                        event['name'] = name
                        event['pid'] = owner
                        event['ph'] = 'B'
                        event['args'] = {"msg": source_item, "id": unique_id}
                        events.append(event)
                        event = {}
                        event['ts'] = (startTime+duration)*1000
                        event['name'] = name
                        event['pid'] = owner
                        event['ph'] = 'E'
                        event['args'] = {"msg": source_item, "id": unique_id}
                        events.append(event)
        with open(output_trace, "w", encoding='utf8') as trace_file:
            # important to put the indent, multi-line json parses faster in trace compass
            trace_file.write(json.dumps(events, indent=1))
shutil.rmtree(repo_name)
print(f'Completed, traces available in {OUTPUT_FOLDER}')

