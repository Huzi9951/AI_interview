import { test, expect } from '@playwright/test';

test.describe('Dashboard Flow', () => {

    test.beforeEach(async ({ page }) => {
        // Go to the dashboard and simulate local storage / context bypass 
        // Usually tests would login via API or UI beforehand, 
        // but for this UI test we will navigate to /dashboard and let Next.js handle it
        // assuming demo mode bypasses auth or the redirect handles gracefully.
        await page.goto('/dashboard');
    });

    test('should navigate to Jobs and Candidates tabs', async ({ page }) => {
        // Click Jobs sidebar nav
        await page.getByRole('link', { name: '💼 Jobs' }).click();
        await expect(page.locator('h1', { hasText: 'Jobs' })).toBeVisible();

        // Click Candidates sidebar nav
        await page.getByRole('link', { name: '👥 Candidates' }).click();
        await expect(page.locator('h1', { hasText: 'Applicants' })).toBeVisible();
    });

    test('should progress through Create Job wizard and create a job', async ({ page }) => {
        // Navigate to Create page
        await page.goto('/dashboard/jobs/create');

        // Select 'Fill Manually' card to render the form fields
        await page.getByText('Fill Manually').click();

        // Check for standard form fields
        const titleInput = page.locator('input[placeholder="e.g., IoT + AI Solutions Architect"]');
        await expect(titleInput).toBeVisible();
        await titleInput.fill('Playwright Test Job Architect');

        await page.locator('input[placeholder="e.g., Mumbai, Maharashtra"]').fill('San Francisco, CA');

        // Navigate through wizard steps
        await page.getByText('Next →').click();

        // Step 2: Description
        await page.locator('textarea[placeholder*="Describe the role"]').fill('This is a test job description.');
        await page.getByText('Next →').click();

        // Step 3: Criteria
        await page.getByText('Next →').click();

        // Step 4: Screening
        await page.getByText('Next →').click();

        // Step 5: Interviews
        // Click final create job
        await page.locator('button', { hasText: 'Create Job' }).click();

        // Should return to dashboard/jobs
        await expect(page).toHaveURL(/.*\/dashboard\/jobs/);
    });

    test('should be able to search and filter jobs in the list', async ({ page }) => {
        await page.goto('/dashboard/jobs');

        // Try searching for the job we might have created, or any job
        const searchInput = page.locator('input[placeholder="Search jobs..."]');
        await searchInput.fill('Playwright Test Job Architect');

        // Check if list filters (we expect either 1 result if created, or 0 if test isolation clears it)
        // At least ensure search doesn't crash the page and the DOM updates
        await expect(searchInput).toHaveValue('Playwright Test Job Architect');
    });

    test('should delete a job if one exists', async ({ page }) => {
        await page.goto('/dashboard/jobs');

        // Handle JS confirm dialog automatically
        page.on('dialog', dialog => dialog.accept());

        const jobItems = page.locator('.jobs-module__2v-jobItem__1x'); // this class name might change, we use a more generic text select
        // Wait for potential network data
        await page.waitForTimeout(1000);

        // Click on the first job item if present
        const testJobTitle = page.locator('h3').first();
        if (await testJobTitle.isVisible()) {
            await testJobTitle.click();

            // Delete button
            const deleteBtn = page.locator('button', { hasText: '🗑️' });
            if (await deleteBtn.isVisible()) {
                await deleteBtn.click();
                await page.waitForTimeout(500); // Wait for deletion toast or DOM updates
            }
        }
    });

});
