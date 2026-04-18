# Browser QA Testing

## Overview

Unit tests verify functions. API tests verify endpoints. Neither tells you whether a user can actually log in, fill a form, or navigate your app without hitting a blank screen or a cryptic error. Browser-level QA testing fills this gap by driving a real browser through the same flows your users follow — clicking buttons, filling inputs, waiting for network responses, and validating what appears on screen.

**Why this matters:** The most common production incidents aren't logic bugs caught by unit tests — they're broken builds that render blank pages, API integrations that fail silently, modals that can't be dismissed, or forms that submit empty data. These only surface when a real browser renders real DOM, executes real JavaScript, and makes real network requests.

## When to Use

- After frontend component development is complete and you need to verify the integrated experience
- After user flow changes (new pages, modified navigation, updated forms)
- Before any release or deployment — as the final quality gate
- When visual regression is suspected (CSS changes, dependency upgrades, design system updates)
- When accessibility compliance needs verification (WCAG audits)
- After backend API changes that affect frontend behavior
- When a bug report describes browser-specific behavior you can't reproduce with unit tests

## 方法原则

- 先验证最小关键路径，再扩展到次要路径；不要一上来铺满低价值场景
- 浏览器 QA 的输出必须可作为证据使用，失败时要留下截图、trace、控制台或网络记录
- 对复杂改动谨慎推进，先锁定一条可复现路径，再扩大覆盖面
- 视觉、交互、网络、可访问性检查都应服务当前目标，而不是机械堆清单

## 最小关键路径

每轮浏览器 QA 至少先选 1-3 条“失败就不能放行”的路径，通常包括：

1. 进入应用或核心页面
2. 完成一次主要业务动作
3. 看到可验证的成功结果或明确错误反馈

如果这是一个 bug 修复，最小关键路径必须先覆盖“原始失败如何复现”和“修复后如何证明不再复发”。

## Tool Selection

### Playwright (Recommended)

Best overall choice for AI-driven QA workflows:

```
Strengths:
  - Multi-browser (Chromium, Firefox, WebKit) with one API
  - Auto-wait for elements (no manual sleep/waitFor)
  - Built-in screenshot, video, and trace capture
  - Network interception and mocking
  - Native accessibility testing via @axe-core/playwright

Install: npm init playwright@latest
```

### Cypress

Better for teams already invested in the Cypress ecosystem:

```
Strengths:
  - Excellent interactive test runner with time-travel debugging
  - Rich plugin ecosystem
  - Good for component testing in isolation

Limitations:
  - Chromium-family only (no Safari/WebKit)
  - Cannot test multiple browser tabs or origins in one test
```

### Puppeteer

Use only when you need raw Chrome DevTools Protocol access:

```
Strengths:
  - Direct CDP access for advanced scenarios (performance profiling, coverage)
  - Lightweight if you only need Chrome

Limitations:
  - Chrome/Chromium only
  - No built-in test runner — you must bring your own
  - More boilerplate than Playwright for common tasks
```

**Decision rule:** Default to Playwright unless the project already uses Cypress. Use Puppeteer only for Chrome-specific DevTools scenarios.

### Browser Configuration

```typescript
// playwright.config.ts — recommended baseline
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
    { name: 'mobile-safari', use: { ...devices['iPhone 13'] } },
  ],
  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
});
```

## QA Testing Workflow

### Step 1: Environment Preparation

Before any browser test can run, the application must be running and data must be in a known state.

```
Pre-flight checklist:
  □ Application builds without errors
  □ Dev server or preview server is running and responding
  □ Test database is seeded with known data (or API mocks are configured)
  □ Environment variables are set (API URLs, feature flags)
  □ No port conflicts on the target URL
```

**Seed data strategy:** Either use a test database with fixtures, or intercept network requests and return mock responses. Never rely on production data for QA tests.

```typescript
// Example: API mocking with Playwright
test.beforeEach(async ({ page }) => {
  await page.route('**/api/tasks', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 1, title: 'Test task', done: false },
        { id: 2, title: 'Completed task', done: true },
      ]),
    })
  );
});
```

### Step 2: Core User Flow Testing

Test the critical paths a real user follows. Prioritize by business impact:

```
Priority 1 (Must pass — blocks release):
  - Authentication (login, logout, session persistence)
  - Primary CRUD operations (create, read, update, delete core entities)
  - Payment/checkout flows (if applicable)
  - Navigation between main sections

Priority 2 (Should pass — file bugs if broken):
  - Search and filtering
  - Settings and preferences
  - Notification flows
  - Export/import operations

Priority 3 (Nice to have):
  - Edge case interactions
  - Rarely used features
  - Admin-only flows
```

先把 Priority 1 做成稳定、可重复、可留证据的路径；在它们还不稳定时，不要把精力优先花在长尾流程上。

```typescript
// Example: Complete login → dashboard → action flow
test('user can log in and create a task', async ({ page }) => {
  await page.goto('/login');

  await page.getByLabel('Email').fill('user@test.com');
  await page.getByLabel('Password').fill('testpass123');
  await page.getByRole('button', { name: 'Sign in' }).click();

  // Verify redirect to dashboard
  await expect(page).toHaveURL('/dashboard');
  await expect(page.getByRole('heading', { name: 'My Tasks' })).toBeVisible();

  // Create a new task
  await page.getByRole('button', { name: 'New Task' }).click();
  await page.getByLabel('Task title').fill('Write QA tests');
  await page.getByRole('button', { name: 'Save' }).click();

  // Verify task appears in list
  await expect(page.getByText('Write QA tests')).toBeVisible();
});
```

### Step 3: Interaction Testing

Test form submissions, navigation, and state changes that go beyond happy-path flows:

```typescript
// Form validation testing
test('form shows validation errors for invalid input', async ({ page }) => {
  await page.goto('/register');

  // Submit empty form
  await page.getByRole('button', { name: 'Create account' }).click();

  // Check validation messages appear
  await expect(page.getByText('Email is required')).toBeVisible();
  await expect(page.getByText('Password must be at least 8 characters')).toBeVisible();

  // Check invalid email
  await page.getByLabel('Email').fill('not-an-email');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByText('Enter a valid email address')).toBeVisible();
});

// Navigation and back-button behavior
test('browser back button returns to previous page', async ({ page }) => {
  await page.goto('/tasks');
  await page.getByText('Task 1').click();
  await expect(page).toHaveURL(/\/tasks\/\d+/);

  await page.goBack();
  await expect(page).toHaveURL('/tasks');
});
```

### Step 4: Visual Verification

Use screenshots to detect visual regressions:

```typescript
// Full-page screenshot comparison
test('dashboard matches visual baseline', async ({ page }) => {
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');

  await expect(page).toHaveScreenshot('dashboard.png', {
    maxDiffPixelRatio: 0.01,  // Allow 1% pixel difference
    fullPage: true,
  });
});

// Component-level screenshot
test('task card renders correctly', async ({ page }) => {
  await page.goto('/tasks');
  const card = page.getByTestId('task-card').first();

  await expect(card).toHaveScreenshot('task-card.png');
});
```

**Update baselines** when intentional visual changes are made: `npx playwright test --update-snapshots`

### Step 4.5: Failure Regression Evidence

当测试失败时，至少保留一类可以复盘的证据：

- 截图，证明页面状态与预期不符
- trace 或录像，证明交互链路在哪里中断
- console error / network failure，证明是前端异常、接口失败还是环境问题

没有证据的“浏览器测过了”不构成可审查的结论。

### Step 5: Accessibility Audit

Integrate axe-core for automated WCAG compliance checking:

```typescript
import AxeBuilder from '@axe-core/playwright';

test('home page has no accessibility violations', async ({ page }) => {
  await page.goto('/');

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  expect(results.violations).toEqual([]);
});

// Targeted audit on specific component
test('modal dialog meets accessibility standards', async ({ page }) => {
  await page.goto('/tasks');
  await page.getByRole('button', { name: 'New Task' }).click();

  const modal = page.getByRole('dialog');
  const results = await new AxeBuilder({ page })
    .include(await modal.elementHandle())
    .analyze();

  expect(results.violations).toEqual([]);
});
```

**Manual keyboard checks to include:**

```
□ Tab order follows visual order
□ Focus is visible on all interactive elements
□ Escape closes modals and dropdowns
□ Enter/Space activates buttons and links
□ Arrow keys work in menus and listboxes
```

### Step 6: Console and Network Monitoring

Enforce a zero-error policy in the browser console and verify network behavior:

```typescript
// Collect console errors during test
test('page loads without console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');

  // Filter out known third-party noise if needed
  const realErrors = errors.filter(e => !e.includes('third-party-sdk'));
  expect(realErrors).toHaveLength(0);
});

// Verify no failed network requests
test('all API requests succeed', async ({ page }) => {
  const failedRequests: string[] = [];
  page.on('response', response => {
    if (response.status() >= 400) {
      failedRequests.push(`${response.status()} ${response.url()}`);
    }
  });

  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');

  expect(failedRequests).toHaveLength(0);
});

// Verify specific API calls are made
test('dashboard fetches tasks on load', async ({ page }) => {
  const apiCalls: string[] = [];
  page.on('request', req => {
    if (req.url().includes('/api/')) apiCalls.push(req.url());
  });

  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');

  expect(apiCalls.some(url => url.includes('/api/tasks'))).toBe(true);
});
```

### Step 7: Regression Test Generation

When a bug is found during QA, immediately convert it into an automated test:

```typescript
// Bug found: clicking "Delete" on last task causes blank screen
// → Convert to regression test:

test('deleting the last task shows empty state instead of blank screen', async ({ page }) => {
  // Setup: single task
  await page.route('**/api/tasks', route =>
    route.fulfill({ body: JSON.stringify([{ id: 1, title: 'Only task', done: false }]) })
  );

  await page.goto('/tasks');
  await page.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('button', { name: 'Confirm' }).click();

  // Should show empty state, not blank screen
  await expect(page.getByText('No tasks yet')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create Task' })).toBeVisible();
});
```

## Common Test Scenario Templates

### Login/Registration

```typescript
test.describe('Authentication', () => {
  test('successful login redirects to dashboard', async ({ page }) => { /* ... */ });
  test('wrong password shows error message', async ({ page }) => { /* ... */ });
  test('session persists across page reload', async ({ page }) => { /* ... */ });
  test('logout clears session and redirects to login', async ({ page }) => { /* ... */ });
  test('registration with valid data creates account', async ({ page }) => { /* ... */ });
  test('registration with duplicate email shows error', async ({ page }) => { /* ... */ });
});
```

### CRUD Operations

```typescript
test.describe('Task CRUD', () => {
  test('create: new task appears in list', async ({ page }) => { /* ... */ });
  test('read: task detail page shows all fields', async ({ page }) => { /* ... */ });
  test('update: edited task saves and reflects changes', async ({ page }) => { /* ... */ });
  test('delete: removed task disappears with confirmation', async ({ page }) => { /* ... */ });
  test('bulk: select-all and batch delete works', async ({ page }) => { /* ... */ });
});
```

### Responsive Layout

```typescript
const viewports = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
];

for (const vp of viewports) {
  test(`dashboard layout is correct at ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto('/dashboard');
    await expect(page).toHaveScreenshot(`dashboard-${vp.name}.png`);
  });
}
```

### Error State Display

```typescript
test.describe('Error handling', () => {
  test('API failure shows error message with retry button', async ({ page }) => {
    await page.route('**/api/tasks', route => route.fulfill({ status: 500 }));
    await page.goto('/tasks');

    await expect(page.getByText('Something went wrong')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
  });

  test('404 page shows helpful navigation', async ({ page }) => {
    await page.goto('/nonexistent-page');
    await expect(page.getByText('Page not found')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Go home' })).toBeVisible();
  });
});
```

## QA Report Format

After a QA run, produce a structured report:

```markdown
## QA Report — [Feature/Page Name] — [Date]

### Environment
- URL: http://localhost:3000
- Browser: Chromium 120, Firefox 121, WebKit 17.4
- Viewport: 1440×900 (desktop), 375×812 (mobile)

### Summary
- Total tests: 24
- ✅ Passed: 21
- ❌ Failed: 2
- ⚠️ Flaky: 1

### Failed Tests
| Test | Browser | Error | Screenshot |
|------|---------|-------|------------|
| Login form validation | WebKit | "Email required" message not visible | ![](/screenshots/login-webkit-001.png) |
| Task delete on mobile | Mobile Chrome | Confirm button outside viewport | ![](/screenshots/delete-mobile-001.png) |

### Accessibility Audit
- Violations found: 3
  1. Missing alt text on user avatar (img element) — Critical
  2. Color contrast ratio 3.8:1 on secondary text — Moderate
  3. Missing aria-label on icon-only button — Moderate

### Console Errors
- None (clean)

### Network Issues
- None (all requests 2xx)

### Recommendations
1. [Critical] Fix WebKit form validation display — blocks release
2. [Critical] Fix mobile viewport overflow on delete confirmation
3. [Moderate] Add missing alt text and aria-labels
4. [Low] Improve secondary text contrast ratio
```

## Integration with Other Skills

### With `frontend-ui-engineering`

Development → QA feedback loop:

```
Build component → Run QA → Fix issues → Re-run QA → Approve
```

QA tests validate everything the frontend skill specifies: accessibility, responsive behavior, loading/error/empty states.

### With `test-driven-development`

TDD covers unit and integration layers. Browser QA adds the E2E layer:

```
Unit tests (TDD)    → Function-level correctness
Integration tests   → Module interaction
Browser QA tests    → User-facing experience (this skill)
```

### With `verification-before-completion`

QA test results serve as concrete verification evidence:

```
Verification evidence:
  - 24/24 browser tests passing
  - Zero console errors
  - Zero accessibility violations
  - Screenshots attached for visual confirmation
```

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "Unit tests are enough" | Unit tests can't catch a broken layout, a missing button, or a form that submits empty data. |
| "Manual QA is faster" | Manual QA is faster once. Automated QA is faster every time after that — and it doesn't forget edge cases. |
| "E2E tests are too slow" | A focused suite of 20-30 critical-path tests runs in under 2 minutes. That's faster than debugging a production incident. |
| "We'll add browser tests later" | Later never comes. The cost of writing tests increases as the app grows. Start with the critical paths now. |
| "It works on my machine" | Browser tests run in consistent environments. They catch the cross-browser and viewport issues you won't see on your dev setup. |

## Red Flags

- No browser tests exist for user-facing features
- QA is only done manually before releases (no automation)
- Tests use arbitrary `sleep()` / `waitForTimeout()` instead of proper element assertions
- Screenshot baselines haven't been updated in months (everything is ignored)
- Accessibility audits have never been run
- Console errors are ignored ("it's just a warning")
- Tests only run in one browser (skipping Firefox/WebKit/mobile)
- No test data seeding — tests depend on production data or shared environments

## Verification

After QA testing is complete:

- [ ] All Priority 1 (critical path) tests pass across target browsers
- [ ] Zero unhandled console errors in the browser
- [ ] Accessibility audit shows zero critical violations
- [ ] Visual screenshots are captured and reviewed
- [ ] Failed tests have filed bugs with reproduction steps
- [ ] Regression tests are written for any bugs discovered
- [ ] QA report is generated with pass/fail summary and evidence
