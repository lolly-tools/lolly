// SPDX-License-Identifier: MPL-2.0
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function terminalContent(root: string): Promise<void> {
  await mkdir(join(root, 'catalog/tools'), { recursive: true });
  await mkdir(join(root, 'catalog/assets'), { recursive: true });
  const tools = ['batch-fixture', 'slow-fixture'];
  await writeFile(
    join(root, 'catalog/tools/index.json'),
    JSON.stringify({
      tools: tools.map((id) => ({ id, name: id, status: 'community', formats: ['svg'] })),
    })
  );
  await writeFile(join(root, 'catalog/assets/index.json'), JSON.stringify({ assets: [] }));
  for (const id of tools) {
    const dir = join(root, 'tools', id);
    await mkdir(dir, { recursive: true });
    await writeFile(
      join(dir, 'tool.json'),
      JSON.stringify({
        id,
        name: id,
        version: '1.0.0',
        engineVersion: '^1.0.0',
        status: 'community',
        inputs: [
          { id: 'label', type: 'text', default: 'Default' },
          { id: 'width', type: 'number', default: 3 },
          { id: 'contact', type: 'text', bindToProfile: 'firstname' },
        ],
        ...(id === 'slow-fixture' ? { hooks: { onInit: true } } : {}),
        render: { formats: ['svg'], width: 100, height: 50, c2pa: false },
      })
    );
    await writeFile(
      join(dir, 'template.html'),
      '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50" viewBox="0 0 100 50"><rect width="{{width}}" height="10"/><title>{{label}}</title></svg>'
    );
    if (id === 'slow-fixture')
      await writeFile(
        join(dir, 'hooks.js'),
        '({ onInit: async () => { await new Promise(resolve => setTimeout(resolve, 10000)); return {}; } })'
      );
  }
}
