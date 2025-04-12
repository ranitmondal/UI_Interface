import { test, expect, BrowserContext, Page } from "@playwright/test";

test.describe.serial("CRUD Operations", () => {
    let context: BrowserContext;
    let page: Page;

    test.beforeAll(async ({ browser }) => {
        context = await browser.newContext();
        page = await context.newPage();
        await page.goto("/StudentGrades.aspx");
        // Navigate to the desired school
        await page.locator("div.next-navbar-school").waitFor({ state: "visible" });
        await page.locator("span#ctl00_lblSchoolName").click();
        await page.getByRole("menuitem", { name: "Aeries Continuation School (" }).click();
        await expect(page.getByRole("link", { name: "Aeries Continuation School" })).toBeVisible();
    });

    test.afterAll(async () => {
        await context.close();
    });

    test("Add new record", async () => {
        await page.getByRole("link", { name: "Add New Record" }).click();
        await page.getByLabel("Section Search").getByText("Pick a Section").click();
        await page.getByRole("option").first().click();
        await page.getByRole("button", { name: "Continue" }).click();

        // Fill grade inputs
        const grades = ["90", "80", "70", "50", "80", "84", "40", "90"];
        for (let i = 1; i <= 8; i++) {
            await page
                .locator(`[name*='txtM${i}']`)
                .first()
                .fill(grades[i - 1]);
        }
        await page.locator("[id*='subGRD_UpdatePanel1']").locator("[title='Save Record']").click();
        await page
            .locator("[id*='subGRD_UpdatePanel1']")
            .locator("[id*='EditRcd']")
            .waitFor({ state: "visible" });

        //View record
        const perText = await page.locator("td[data-tcfc='GRD.PD']").innerText();
        expect(perText).toContain("1");
        const crsIDText = await page.locator("td[data-tcfc='GRD.CN']").innerText();
        expect(crsIDText).toContain("3043");
        const courseText = await page.locator("td[data-tcfc='CRS.CO']").innerText();
        expect(courseText).toContain("Literature");
    });

    test("Edit record", async () => {
        await page.locator("[id*='subGRD_UpdatePanel1']").locator("[id*='EditRcd']").click();
        await page.locator("[name*='txtM1']").fill("56");
        await page.locator("[id*='subGRD_UpdatePanel1']").locator("[title='Save Record']").click();
        await page
            .locator("[id*='subGRD_UpdatePanel1']")
            .locator("[id*='EditRcd']")
            .waitFor({ state: "visible" });

        //View edit record
        const prgText = await page.locator("td[data-tcfc='GRD.M1']").innerText();
        expect(prgText).toContain("56");
    });

    test("Delete record", async () => {
        await page
            .locator("[id*='subGRD_UpdatePanel1']")
            .locator("[id*='EditRcd']")
            .waitFor({ state: "visible" });
        await page.locator("[id*='subGRD_UpdatePanel1']").locator("[id*='EditRcd']").click();
        await page
            .locator("[id*='subGRD_UpdatePanel1']")
            .locator("[title='Delete Record']")
            .click();
        await page.getByRole("button", { name: "OK" }).click();
        //Verify record should be deleted
        await expect(page.locator("body")).not.toContainText("Literature");
    });
}); 