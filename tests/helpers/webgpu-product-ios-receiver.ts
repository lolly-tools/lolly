// SPDX-License-Identifier: MPL-2.0
/** The real mobile product through an owned physical iPhone console, never a simulator. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { OwnedIosDevice, type IosInstallLease } from '../../scripts/lib/webgpu-ios-device.ts';
import { requireSourceSha, validateReceiptFiles, type IosProductReceipt } from '../../scripts/lib/webgpu-ios-product.ts';
import { productReceiverBrowser, type ProductQualificationBrowser } from './webgpu-product-receiver.ts';

export async function iosProductReceiverBrowser(env: NodeJS.ProcessEnv = process.env): Promise<ProductQualificationBrowser> {
  const receiptPath = env.LOLLY_WEBGPU_PRODUCT_RECEIPT, leasePath = env.LOLLY_WEBGPU_IOS_LEASE;
  assert.ok(receiptPath && leasePath, 'The physical product requires its prepared receipt and successful owned-install lease.');
  const receipt = JSON.parse(readFileSync(receiptPath, 'utf8')) as IosProductReceipt;
  const lease = JSON.parse(readFileSync(leasePath, 'utf8')) as IosInstallLease;
  assert.equal(receipt.platform, 'ios'); assert.equal(lease.version, 1); assert.equal(lease.installed, true);
  assert.equal(lease.runId, receipt.runId); assert.equal(lease.identifier, receipt.identifier); assert.equal(lease.appSha256, receipt.appSha256);
  assert.equal(env.LOLLY_WEBGPU_PRODUCT_PROBE, receipt.runId);
  requireSourceSha(env.LOLLY_WEBGPU_SOURCE_SHA ?? '', String(receipt.sources.sourceSha));
  assert.equal(lease.ownership.state, 'installed-verified'); assert.equal(lease.ownership.needsInspection, false);
  assert.equal(lease.ownership.appUrl, lease.appUrl); assert.ok(lease.appUrl);
  await validateReceiptFiles(receipt, dirname(receiptPath));
  const device = new OwnedIosDevice(receipt, lease.device.identifier);
  device.allowInstalledConsole({ ...lease, appUrl: lease.appUrl });
  let launches = 0;
  return productReceiverBrowser(env, { platform: 'ios',
    launch: () => device.launch(leasePath + '.console-' + ++launches + '.json', env),
    runtime: ready => ready.runtime.startsWith('unavailable:')
      ? `WKWebView version ${ready.runtime}; iOS ${lease.device.osVersion} (${lease.device.osBuild}); physical ${lease.device.productType}`
      : `WKWebView ${ready.runtime}; iOS ${lease.device.osVersion} (${lease.device.osBuild}); physical ${lease.device.productType}`,
    close: child => device.closeConsole(child),
  });
}
