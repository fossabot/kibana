/*
 * Licensed to Elasticsearch B.V. under one or more contributor
 * license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright
 * ownership. Elasticsearch B.V. licenses this file to you under
 * the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { getSortedObjectsForExport } from './get_sorted_objects_for_export';

describe('getSortedObjectsForExport()', () => {
  const savedObjectsClient = {
    errors: {} as any,
    find: jest.fn(),
    bulkGet: jest.fn(),
    create: jest.fn(),
    bulkCreate: jest.fn(),
    delete: jest.fn(),
    get: jest.fn(),
    update: jest.fn(),
  };

  afterEach(() => {
    savedObjectsClient.find.mockReset();
    savedObjectsClient.bulkGet.mockReset();
    savedObjectsClient.create.mockReset();
    savedObjectsClient.bulkCreate.mockReset();
    savedObjectsClient.delete.mockReset();
    savedObjectsClient.get.mockReset();
    savedObjectsClient.update.mockReset();
  });

  test('exports selected types and sorts them', async () => {
    savedObjectsClient.find.mockResolvedValueOnce({
      total: 2,
      saved_objects: [
        {
          id: '2',
          type: 'search',
          references: [
            {
              type: 'index-pattern',
              id: '1',
            },
          ],
        },
        {
          id: '1',
          type: 'index-pattern',
          references: [],
        },
      ],
    });
    const response = await getSortedObjectsForExport({
      savedObjectsClient,
      exportSizeLimit: 500,
      types: ['index-pattern', 'search'],
    });
    expect(response).toMatchInlineSnapshot(`
Array [
  Object {
    "id": "1",
    "references": Array [],
    "type": "index-pattern",
  },
  Object {
    "id": "2",
    "references": Array [
      Object {
        "id": "1",
        "type": "index-pattern",
      },
    ],
    "type": "search",
  },
]
`);
    expect(savedObjectsClient.find).toMatchInlineSnapshot(`
[MockFunction] {
  "calls": Array [
    Array [
      Object {
        "perPage": 500,
        "sortField": "_id",
        "sortOrder": "asc",
        "type": Array [
          "index-pattern",
          "search",
        ],
      },
    ],
  ],
  "results": Array [
    Object {
      "type": "return",
      "value": Promise {},
    },
  ],
}
`);
  });

  test('export selected types throws error when exceeding exportSizeLimit', async () => {
    savedObjectsClient.find.mockResolvedValueOnce({
      total: 2,
      saved_objects: [
        {
          id: '2',
          type: 'search',
          references: [
            {
              type: 'index-pattern',
              id: '1',
            },
          ],
        },
        {
          id: '1',
          type: 'index-pattern',
          references: [],
        },
      ],
    });
    await expect(
      getSortedObjectsForExport({
        savedObjectsClient,
        exportSizeLimit: 1,
        types: ['index-pattern', 'search'],
      })
    ).rejects.toThrowErrorMatchingInlineSnapshot(`"Can't export more than 1 objects"`);
  });

  test('exports selected objects and sorts them', async () => {
    savedObjectsClient.bulkGet.mockResolvedValueOnce({
      saved_objects: [
        {
          id: '2',
          type: 'search',
          references: [
            {
              type: 'index-pattern',
              id: '1',
            },
          ],
        },
        {
          id: '1',
          type: 'index-pattern',
          references: [],
        },
      ],
    });
    const response = await getSortedObjectsForExport({
      exportSizeLimit: 10000,
      savedObjectsClient,
      types: ['index-pattern', 'search'],
      objects: [
        {
          type: 'index-pattern',
          id: '1',
        },
        {
          type: 'search',
          id: '2',
        },
      ],
    });
    expect(response).toMatchInlineSnapshot(`
Array [
  Object {
    "id": "1",
    "references": Array [],
    "type": "index-pattern",
  },
  Object {
    "id": "2",
    "references": Array [
      Object {
        "id": "1",
        "type": "index-pattern",
      },
    ],
    "type": "search",
  },
]
`);
    expect(savedObjectsClient.bulkGet).toMatchInlineSnapshot(`
[MockFunction] {
  "calls": Array [
    Array [
      Array [
        Object {
          "id": "1",
          "type": "index-pattern",
        },
        Object {
          "id": "2",
          "type": "search",
        },
      ],
    ],
  ],
  "results": Array [
    Object {
      "type": "return",
      "value": Promise {},
    },
  ],
}
`);
  });

  test('export selected objects throws error when exceeding exportSizeLimit', async () => {
    const exportOpts = {
      exportSizeLimit: 1,
      savedObjectsClient,
      types: ['index-pattern', 'search'],
      objects: [
        {
          type: 'index-pattern',
          id: '1',
        },
        {
          type: 'search',
          id: '2',
        },
      ],
    };
    await expect(getSortedObjectsForExport(exportOpts)).rejects.toThrowErrorMatchingInlineSnapshot(
      `"Can't export more than 1 objects"`
    );
  });
});
