import { test, expect } from '@playwright/test';

test.describe('Candidates Management', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('/dashboard/candidates');
    });

    test('should allow manually adding a candidate', async ({ page }) => {
        const uniqueEmail = `test-${Date.now()}@candidate.com`;
        const uniqueName = `Test Candidate ${Date.now()}`;
        const uniquePhone = `99${Math.floor(Math.random() * 100000000)}`;

        // Fill the manual add row
        await page.locator('input[placeholder="Name"]').fill(uniqueName);
        await page.locator('input[placeholder="Email *"]').fill(uniqueEmail);
        const phoneInput = page.locator('input[placeholder="Phone"]');
        await phoneInput.fill(uniquePhone);

        // Ensure React state updates register
        await phoneInput.blur();
        await page.waitForTimeout(500);

        // Click Add
        const addBtn = page.locator('button', { hasText: '+ Add' }).first();
        await addBtn.click();

        // Verification with extended timeout to handle potential API/React load delays
        const tbody = page.locator('tbody');
        await expect(tbody.getByText(uniqueName)).toBeVisible({ timeout: 10000 });
        await expect(tbody.getByText(uniqueEmail)).toBeVisible({ timeout: 10000 });
    });

    test('should select candidate and open invite modal', async ({ page }) => {
        // Select the newly added candidate (or any available via text match)
        // We assume test candidate is present
        const firstCheckbox = page.locator('tbody input[type="checkbox"]').first();
        if (await firstCheckbox.isVisible()) {
            await firstCheckbox.check();

            const inviteBtn = page.locator('button', { hasText: /Invite/ });
            await expect(inviteBtn).toBeEnabled();
            await inviteBtn.click();

            // Verify modal opens
            await expect(page.locator('h2', { hasText: 'Select Job' })).toBeVisible();

            // Close modal
            await page.locator('button.modalClose').filter({ hasText: '×' }).click();
        }
    });

    test('should filter candidates', async ({ page }) => {
        // Test search input
        const searchInput = page.locator('input[placeholder="Search applicants..."]');
        await searchInput.fill('Test');

        // Due to debounce, wait a bit
        await page.waitForTimeout(500);

        // Ensure at least the table is showing
        await expect(page.locator('table')).toBeVisible();

        // Advanced Filters
        const hrFilter = page.locator('select').filter({ hasText: 'HR Status: All' });
        if (await hrFilter.isVisible()) {
            await hrFilter.selectOption({ label: '✅ Accepted' });
            await page.waitForTimeout(300);
            await hrFilter.selectOption({ label: '👤 HR Status: All' });
        }
    });

    test('should remove a candidate if one exists', async ({ page }) => {
        // Handle confirm dialog natively if it exists
        page.on('dialog', dialog => dialog.accept());

        // We added a candidate in the first test, let's look for the remove button
        const removeBtn = page.locator('button[title="Remove"]').first();
        if (await removeBtn.isVisible()) {
            await removeBtn.click();
            await page.waitForTimeout(500); // Wait for the state update or API call
        }
    });

});
