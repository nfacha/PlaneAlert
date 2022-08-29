import {PlaneAlert} from "../index";
import {Browser} from "puppeteer";

export class ScreenshotUtils {
    public static async takeScreenshot(icao24: string | null): Promise<boolean> {
        PlaneAlert.log.debug(`Getting plane screenshot for ${icao24}`);
        return new Promise((resolve, reject) => {
            const adsbExchangeLink = 'https://globe.adsbexchange.com/?icao=' + icao24 + '&hideButtons&screenshot&hideSideBar';
            const puppeteer = require('puppeteer');
            puppeteer
                .launch({
                    defaultViewport: {
                        width: 1920,
                        height: 1080,
                    },
                })
                .then(async (browser: Browser) => {
                    const page = await browser.newPage();
                    await page.setJavaScriptEnabled(true);
                    await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.108 Safari/537.36');
                    await page.goto(adsbExchangeLink, {waitUntil: 'networkidle2'});
                    await page.waitForSelector('#airplanePhoto');
                    await page.screenshot({path: `/tmp/${icao24}.png`});
                    await browser.close();
                    PlaneAlert.log.debug(`Plane screenshot for ${icao24} taken`);
                    resolve(true);
                }).catch((err: any) => {
                PlaneAlert.log.error(`Error taking plane screenshot for ${this.name} (${icao24}): ${err}`);
                resolve(false);
            });
        });
    }
}
