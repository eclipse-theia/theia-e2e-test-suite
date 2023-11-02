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
import requests
import json
import tqdm

prefix = "https://github.com/eclipse-theia/theia-e2e-test-suite/blob/gh-pages/"
source_page = prefix + "performance"
response = requests.get(source_page)
if response.status_code != 200:
    print(f"Error: {response.status_code}")
    exit(0)
data = json.loads(response.content)
items = data['payload']['tree']['items']
for item in tqdm.tqdm(items):
    input_trace = prefix + item['path']
    output_trace = item['name'] + '.json'
    # theia_measurements{id="backend", name="deployPlugin", startTime="943.3257030000095", owner="backend"} 1.7780040000216104
    regex_pattern  = re.compile(r'(\S+)\{id="(\S+)", name="(\S+)", startTime="(\S+)", owner="(\S+)"\} (\S+)')
    response = requests.get(input_trace)
    if response.status_code == 200:
        last_name = None
        last_type = None
        last_label = None
        events = []
        data = json.loads(response.content)
        blob = data['payload']['blob']
        for line in blob['rawLines']:
            
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
                        event['ts']=startTime*1000
                        event['name']= name
                        event['pid']=owner
                        event['ph'] = 'B'
                        event['args'] = {"msg": source_item, "id":unique_id}
                        events.append(event)
                        event = {}
                        event['ts']=(startTime+duration)*1000
                        event['name']= name
                        event['pid']=owner
                        event['ph'] = 'E'
                        event['args'] = {"msg": source_item, "id":unique_id}
                        events.append(event)
        with open(output_trace, "w") as trace_file:
            # important to put the indent, multi-line json parses faster in trace compass
            trace_file.write(json.dumps(events, indent=1))
    else:
        print(f"Error: {response.status_code}")

