import { expect, test } from '@playwright/test';

test('an owner registers, the platform admin approves the depot', async ({ page }) => {
  const adminEmail = process.env.PLATFORM_ADMIN_EMAIL;
  const adminPassword = process.env.PLATFORM_ADMIN_PASSWORD;

  test.skip(
    adminEmail === undefined || adminPassword === undefined,
    'PLATFORM_ADMIN_EMAIL and PLATFORM_ADMIN_PASSWORD are required for this end-to-end test',
  );

  const suffix = `${Date.now()}`;
  const depotName = `E2E Depot ${suffix}`;
  const email = `e2e-owner-${suffix}@example.com`;
  const phone = `012${suffix.slice(-7)}`;

  await page.goto('/register');
  await page.getByLabel('Depot name').fill(depotName);
  await page.getByLabel('Owner name').fill('E2E Owner');
  await page.getByLabel('Phone number').fill(phone);
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('Password1');
  await page.getByLabel('Confirm password').fill('Password1');
  await page.getByRole('button', { name: 'Register depot' }).click();

  await expect(page).toHaveURL(/\/pending\?registered=1$/);
  await expect(
    page.getByRole('heading', { name: 'Thank you. Your depot is registered.' }),
  ).toBeVisible();

  await page.goto('/login');
  await page.getByLabel('Email or phone').fill(adminEmail ?? '');
  await page.getByLabel('Password').fill(adminPassword ?? '');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page).toHaveURL(/\/platform\/depots$/);
  await expect(page.getByRole('heading', { name: 'Depot review', level: 2 })).toBeVisible();

  const pendingRow = page.getByRole('row').filter({ hasText: depotName });
  await expect(pendingRow).toBeVisible();
  await pendingRow.getByRole('button', { name: 'Approve', exact: true }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Approve this depot?' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Approve depot' }).click();

  await expect(dialog).toBeHidden();
  await page.getByRole('button', { name: 'Approved', exact: true }).click();

  const approvedRow = page.getByRole('row').filter({ hasText: depotName });
  await expect(approvedRow).toBeVisible();
  await expect(approvedRow.getByText('Approved', { exact: true })).toBeVisible();
});
